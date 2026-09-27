import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { db, schema } from "@/db";
import { processCheckout } from "@/lib/checkout";
import { getByCity, getCustomers, getDaily, getSummary } from "@/lib/reporting";

const all = { start: null, end: null, speakerId: null };
let speakerA: string;
let speakerB: string;

async function buy(code: string, email: string, paymentType: "full" | "instalment", quantity = 1, token = "tok_ok") {
  return processCheckout({ code, firstName: "Test", lastName: email.split("@")[0], email, phone: null, quantity, paymentType, paymentToken: token });
}

beforeAll(async () => {
  await migrate(db as unknown as PgliteDatabase, { migrationsFolder: "./drizzle" });
  const [a, b] = await db.insert(schema.speakers).values([{ name: "Speaker A" }, { name: "Speaker B" }]).returning();
  speakerA = a.id;
  speakerB = b.id;
  const [offerA] = await db.insert(schema.offers).values({ speakerId: a.id, name: "Program", priceCents: 1000_00, instalmentCount: 4, instalmentCents: 300_00 }).returning();
  const [offerB] = await db.insert(schema.offers).values({ speakerId: b.id, name: "Other", priceCents: 50_00 }).returning();
  const [syd, per, mel] = await db
    .insert(schema.events)
    .values([
      { speakerId: a.id, name: "Live", city: "Sydney", startsAt: new Date() },
      { speakerId: a.id, name: "Live", city: "Perth", startsAt: new Date() },
      { speakerId: b.id, name: "Other", city: "Melbourne", startsAt: new Date() },
    ])
    .returning();
  await db.insert(schema.checkoutLinks).values([
    { code: "syd", eventId: syd.id, offerId: offerA.id },
    { code: "per", eventId: per.id, offerId: offerA.id },
    { code: "mel", eventId: mel.id, offerId: offerB.id },
  ]);

  expect((await buy("syd", "ann@x.com", "full", 2)).ok).toBe(true); // 2 units, $2,000
  expect((await buy("syd", "bob@x.com", "instalment")).ok).toBe(true); // $300 now, $900 scheduled
  expect((await buy("per", "ann@x.com", "instalment")).ok).toBe(true); // same customer, both payment types
  expect((await buy("per", "cat@x.com", "full", 1, "tok_decline")).ok).toBe(false); // declined — not a sale
  expect((await buy("mel", "dan@x.com", "full")).ok).toBe(true); // other speaker
});

describe("summary metrics", () => {
  it("matches the SourceForm definitions", async () => {
    const s = await getSummary({ ...all, speakerId: speakerA });
    expect(s.signups).toBe(2); // ann, bob — unique customers
    expect(s.paidInFull).toBe(1); // ann
    expect(s.onInstalmentPlan).toBe(2); // ann (also) and bob
    expect(s.totalSales).toBe(3); // orders, not units
    expect(s.unitsSold).toBe(4);
    expect(s.revenueCollectedCents).toBe(2000_00 + 300_00 + 300_00);
    expect(s.outstandingInstalmentsCents).toBe(2 * 3 * 300_00);
    expect(s.failedPayments).toBe(1);
  });

  it("scopes to the viewer's speaker", async () => {
    const b = await getSummary({ ...all, speakerId: speakerB });
    expect(b).toMatchObject({ signups: 1, totalSales: 1, revenueCollectedCents: 50_00 });
    const everyone = await getSummary(all);
    expect(everyone.totalSales).toBe(4);
  });

  it("subtracts refunds from revenue", async () => {
    const [order] = await db.select().from(schema.orders).limit(1);
    await db.insert(schema.payments).values({ orderId: order.id, kind: "refund", status: "succeeded", amountCents: 100_00, paidAt: new Date() });
    const s = await getSummary(all);
    expect(s.revenueCollectedCents).toBe(2000_00 + 300_00 + 300_00 + 50_00 - 100_00);
    await db.delete(schema.payments).where((await import("drizzle-orm")).eq(schema.payments.kind, "refund"));
  });

  it("respects the date range", async () => {
    const future = new Date(Date.now() + 86_400_000);
    const s = await getSummary({ start: future, end: null, speakerId: null });
    expect(s).toMatchObject({ signups: 0, totalSales: 0, revenueCollectedCents: 0 });
  });
});

describe("breakdowns", () => {
  it("groups units and revenue by event city", async () => {
    const rows = await getByCity({ ...all, speakerId: speakerA });
    expect(rows).toEqual([
      { city: "Perth", units: 1, revenueCents: 300_00 },
      { city: "Sydney", units: 3, revenueCents: 2300_00 },
    ]);
  });

  it("lists customers with combined cities and payment status", async () => {
    const { rows, total } = await getCustomers({ ...all, speakerId: speakerA });
    expect(total).toBe(2);
    const ann = rows.find((r) => r.email === "ann@x.com")!;
    expect(ann).toMatchObject({ cities: "Perth, Sydney", quantity: 3, totalPaidCents: 2300_00, paymentStatus: "Paid in full + Instalment plan" });
    const onPlan = await getCustomers({ ...all, speakerId: speakerA }, { payment: "instalment" });
    expect(onPlan.total).toBe(2);
    const search = await getCustomers({ ...all, speakerId: speakerA }, { search: "BOB" });
    expect(search.rows.map((r) => r.email)).toEqual(["bob@x.com"]);
  });
});

describe("daily breakdown", () => {
  it("splits by day and city and adds up to the summary", async () => {
    const f = { ...all, speakerId: speakerA };
    const rows = await getDaily(f);
    const summary = await getSummary(f);
    expect(new Set(rows.map((r) => r.city))).toEqual(new Set(["Perth", "Sydney"]));
    expect(rows.reduce((t, r) => t + r.sales, 0)).toBe(summary.totalSales);
    expect(rows.reduce((t, r) => t + r.units, 0)).toBe(summary.unitsSold);
    expect(rows.reduce((t, r) => t + r.revenueCents, 0)).toBe(summary.revenueCollectedCents);
  });

  it("buckets by the reporting timezone, not UTC", async () => {
    const [order] = await db.select().from(schema.orders).limit(1);
    // 00:30 on 1 Mar 2026 in Sydney (AEDT) is still 28 Feb in UTC.
    const at = new Date("2026-02-28T13:30:00Z");
    await db.insert(schema.payments).values({ orderId: order.id, status: "succeeded", amountCents: 1_00, paidAt: at, externalId: "tz-test" });
    const rows = await getDaily({ start: at, end: new Date("2026-03-01T13:00:00Z"), speakerId: null }, "Australia/Sydney");
    expect(rows.map((r) => [r.date, r.revenueCents])).toEqual([["2026-03-01", 1_00]]);
  });

  it("filters to one city", async () => {
    const rows = await getDaily({ ...all, speakerId: speakerA, city: "Perth" });
    expect(rows.every((r) => r.city === "Perth")).toBe(true);
    expect((await getSummary({ ...all, speakerId: speakerA, city: "Perth" })).totalSales).toBe(1);
  });
});

