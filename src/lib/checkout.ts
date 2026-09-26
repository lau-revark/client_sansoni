import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getPaymentProvider } from "./payments";

export const checkoutInput = z.object({
  code: z.string().min(1),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z
    .string()
    .trim()
    .max(30)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  quantity: z.coerce.number().int().min(1).max(10),
  paymentType: z.enum(["full", "instalment"]),
  paymentToken: z.string().min(1, "Payment details are missing"),
});

export type CheckoutInput = z.infer<typeof checkoutInput>;

export async function loadCheckoutLink(code: string) {
  const [row] = await db
    .select({ link: schema.checkoutLinks, offer: schema.offers, event: schema.events })
    .from(schema.checkoutLinks)
    .innerJoin(schema.offers, eq(schema.offers.id, schema.checkoutLinks.offerId))
    .innerJoin(schema.events, eq(schema.events.id, schema.checkoutLinks.eventId))
    .where(and(eq(schema.checkoutLinks.code, code), eq(schema.checkoutLinks.active, true), eq(schema.offers.active, true)))
    .limit(1);
  return row ?? null;
}

export function priceFor(
  offer: typeof schema.offers.$inferSelect,
  paymentType: "full" | "instalment",
  quantity: number,
) {
  if (paymentType === "instalment") {
    if (!offer.instalmentCount || !offer.instalmentCents) throw new Error("This offer has no instalment plan");
    return {
      dueNowCents: offer.instalmentCents * quantity,
      totalCents: offer.instalmentCents * offer.instalmentCount * quantity,
      instalments: offer.instalmentCount,
    };
  }
  return { dueNowCents: offer.priceCents * quantity, totalCents: offer.priceCents * quantity, instalments: 1 };
}

export type CheckoutResult = { ok: true; orderId: string } | { ok: false; error: string };

export async function processCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const provider = getPaymentProvider();
  const found = await loadCheckoutLink(input.code);
  if (!found) return { ok: false, error: "This checkout link is no longer active." };
  const { link, offer, event } = found;
  const price = priceFor(offer, input.paymentType, input.quantity);

  // Upsert the customer by email so repeat buyers stay one record.
  const [customer] = await db
    .insert(schema.customers)
    .values({ firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone })
    .onConflictDoUpdate({
      target: schema.customers.email,
      set: { firstName: input.firstName, lastName: input.lastName, phone: sql`coalesce(excluded.phone, ${schema.customers.phone})` },
    })
    .returning();

  const [order] = await db
    .insert(schema.orders)
    .values({
      customerId: customer.id,
      eventId: event.id,
      offerId: offer.id,
      checkoutLinkId: link.id,
      status: "pending",
      paymentType: input.paymentType,
      quantity: input.quantity,
      currency: offer.currency,
      totalCents: price.totalCents,
      repName: link.repName,
    })
    .returning();

  const result = await provider.purchase({
    orderId: order.id,
    customer: { firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone },
    offer: { name: offer.name, currency: offer.currency, maxioProductHandle: offer.maxioProductHandle },
    paymentType: input.paymentType,
    quantity: input.quantity,
    amountDueNowCents: price.dueNowCents,
    paymentToken: input.paymentToken,
  });

  if (!result.ok) {
    await db.transaction(async (tx) => {
      await tx.update(schema.orders).set({ status: "failed" }).where(eq(schema.orders.id, order.id));
      await tx.insert(schema.payments).values({
        orderId: order.id,
        status: "failed",
        amountCents: price.dueNowCents,
        currency: offer.currency,
        instalmentNumber: input.paymentType === "instalment" ? 1 : null,
        failureReason: result.reason,
      });
    });
    return { ok: false, error: `Payment didn't go through: ${result.reason}` };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.orders)
      .set({ status: "completed", completedAt: now, maxioSubscriptionId: result.subscriptionId })
      .where(eq(schema.orders.id, order.id));
    if (result.customerId && !customer.maxioCustomerId) {
      await tx.update(schema.customers).set({ maxioCustomerId: result.customerId }).where(eq(schema.customers.id, customer.id));
    }
    const interval = (offer.instalmentIntervalDays ?? 30) * 86_400_000;
    await tx.insert(schema.payments).values(
      Array.from({ length: price.instalments }, (_, i) => ({
        orderId: order.id,
        status: i === 0 ? ("succeeded" as const) : ("scheduled" as const),
        amountCents: price.dueNowCents,
        currency: offer.currency,
        instalmentNumber: input.paymentType === "instalment" ? i + 1 : null,
        dueAt: new Date(now.getTime() + i * interval),
        paidAt: i === 0 ? now : null,
        externalId: i === 0 ? result.transactionId : null,
      })),
    );
  });

  return { ok: true, orderId: order.id };
}
