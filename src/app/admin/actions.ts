"use server";

import { randomBytes } from "node:crypto";
import { and, eq, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { zonedMidnight } from "@/lib/dates";

const dollarsToCents = (v: unknown) => (v === "" || v == null ? null : Math.round(Number(v) * 100));

const eventInput = z.object({
  speakerId: z.string().uuid(),
  name: z.string().trim().min(1),
  city: z.string().trim().min(1),
  venue: z.string().trim().optional(),
  startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createEvent(form: FormData) {
  await requireAdmin();
  const input = eventInput.parse(Object.fromEntries(form));
  const [y, m, d] = input.startsOn.split("-").map(Number);
  const [event] = await db
    .insert(schema.events)
    .values({ speakerId: input.speakerId, name: input.name, city: input.city, venue: input.venue || null, startsAt: zonedMidnight(y, m, d) })
    .returning();
  redirect(`/admin/events/${event.id}`);
}

const offerInput = z
  .object({
    speakerId: z.string().uuid(),
    name: z.string().trim().min(1),
    description: z.string().trim().optional(),
    price: z.preprocess(dollarsToCents, z.number().int().positive()),
    instalmentCount: z.preprocess((v) => (v === "" ? null : Number(v)), z.number().int().min(2).max(36).nullable()),
    instalmentAmount: z.preprocess(dollarsToCents, z.number().int().positive().nullable()),
    maxioProductHandle: z.string().trim().optional(),
  })
  .refine((o) => (o.instalmentCount === null) === (o.instalmentAmount === null), {
    message: "Set both instalment count and amount, or neither",
  });

export async function createOffer(form: FormData) {
  await requireAdmin();
  const o = offerInput.parse(Object.fromEntries(form));
  await db.insert(schema.offers).values({
    speakerId: o.speakerId,
    name: o.name,
    description: o.description || null,
    priceCents: o.price,
    instalmentCount: o.instalmentCount,
    instalmentCents: o.instalmentAmount,
    maxioProductHandle: o.maxioProductHandle || null,
  });
  revalidatePath("/admin/events");
}

const linkInput = z.object({
  eventId: z.string().uuid(),
  offerId: z.string().uuid(),
  label: z.string().trim().optional(),
  repName: z.string().trim().optional(),
});

export async function createCheckoutLink(form: FormData) {
  await requireAdmin();
  const input = linkInput.parse(Object.fromEntries(form));
  // Short, unambiguous, unguessable code for the QR URL.
  const code = randomBytes(6).toString("base64url").replace(/[-_]/g, "x");
  await db.insert(schema.checkoutLinks).values({
    code,
    eventId: input.eventId,
    offerId: input.offerId,
    label: input.label || null,
    repName: input.repName || null,
  });
  revalidatePath(`/admin/events/${input.eventId}`);
}

export async function toggleCheckoutLink(form: FormData) {
  await requireAdmin();
  const id = z.string().uuid().parse(form.get("id"));
  const [link] = await db
    .update(schema.checkoutLinks)
    .set({ active: not(schema.checkoutLinks.active) })
    .where(and(eq(schema.checkoutLinks.id, id)))
    .returning();
  revalidatePath(`/admin/events/${link.eventId}`);
}
