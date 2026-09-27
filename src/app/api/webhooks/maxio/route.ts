import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { verifyMaxioSignature } from "@/lib/payments/maxio";

/**
 * Maxio webhook receiver. Maxio posts application/x-www-form-urlencoded bodies such as
 *   id=123&event=payment_success&payload[subscription][id]=456&payload[transaction][id]=789&payload[transaction][amount_in_cents]=50000
 *
 * Every delivery is stored first (deduplicated on Maxio's webhook id), then applied.
 * TODO: confirm field names against real payloads from Sansoni's Maxio site before go-live.
 */
export async function POST(req: Request) {
  const sharedKey = process.env.MAXIO_WEBHOOK_SHARED_KEY;
  if (!sharedKey) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const raw = await req.text();
  if (!verifyMaxioSignature(raw, req.headers.get("x-chargify-webhook-signature-hmac-sha-256"), sharedKey)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const fields = Object.fromEntries(new URLSearchParams(raw));
  const webhookId = fields["id"];
  const topic = fields["event"];
  if (!webhookId || !topic) return NextResponse.json({ error: "Malformed payload" }, { status: 400 });

  const inserted = await db
    .insert(schema.webhookEvents)
    .values({ provider: "maxio", externalId: webhookId, topic, payload: fields })
    .onConflictDoNothing()
    .returning({ id: schema.webhookEvents.id });
  if (inserted.length === 0) return NextResponse.json({ ok: true, duplicate: true });

  try {
    await applyMaxioEvent(topic, fields);
    await db.update(schema.webhookEvents).set({ processedAt: new Date() }).where(eq(schema.webhookEvents.id, inserted[0].id));
  } catch (err) {
    await db
      .update(schema.webhookEvents)
      .set({ error: err instanceof Error ? err.message : String(err) })
      .where(eq(schema.webhookEvents.id, inserted[0].id));
    // 500 so Maxio retries; the stored row lets us replay manually too.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

async function applyMaxioEvent(topic: string, f: Record<string, string>) {
  const subscriptionId = f["payload[subscription][id]"];
  const transactionId = f["payload[transaction][id]"];
  const amount = Number(f["payload[transaction][amount_in_cents]"] ?? 0);
  if (!subscriptionId) return;

  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.maxioSubscriptionId, subscriptionId)).limit(1);
  if (!order) return; // Not a sale made through this app.

  if (topic === "payment_success" && transactionId) {
    // Settle the earliest outstanding instalment; fall back to recording a new charge.
    const [next] = await db
      .select()
      .from(schema.payments)
      .where(and(eq(schema.payments.orderId, order.id), eq(schema.payments.status, "scheduled")))
      .orderBy(asc(schema.payments.dueAt))
      .limit(1);
    if (next) {
      await db
        .update(schema.payments)
        .set({ status: "succeeded", paidAt: new Date(), externalId: transactionId, amountCents: amount || next.amountCents })
        .where(eq(schema.payments.id, next.id));
    } else {
      await db
        .insert(schema.payments)
        .values({ orderId: order.id, status: "succeeded", amountCents: amount, paidAt: new Date(), externalId: transactionId })
        .onConflictDoNothing();
    }
  } else if (topic === "payment_failure") {
    await db.insert(schema.payments).values({
      orderId: order.id,
      status: "failed",
      amountCents: amount,
      failureReason: f["payload[transaction][memo]"] ?? "Payment failed",
      externalId: transactionId ?? null,
    }).onConflictDoNothing();
  } else if (topic === "refund_success") {
    await db
      .insert(schema.payments)
      .values({
        orderId: order.id,
        kind: "refund",
        status: "succeeded",
        amountCents: Number(f["payload[refund_amount_in_cents]"] ?? amount),
        paidAt: new Date(),
        externalId: f["payload[payment_id]"] ? `refund_${f["payload[payment_id]"]}` : null,
      })
      .onConflictDoNothing();
  }
}
