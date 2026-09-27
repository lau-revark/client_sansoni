/**
 * Demo data: one speaker, two events (Perth, Sydney), ~350 buyers, a mix of paid-in-full and instalment plans.
 * Usage: npm run db:seed   (idempotent-ish: refuses to run if data already exists)
 */
import bcrypt from "bcryptjs";
import { db, schema } from "../src/db";

// Small deterministic PRNG so every seed produces the same numbers.
let s = 42;
const rand = () => ((s = (s * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)];

const FIRST = ["Olivia", "Jack", "Charlotte", "Noah", "Amelia", "William", "Isla", "Oliver", "Mia", "Thomas", "Grace", "James", "Chloe", "Lucas", "Zoe", "Ethan", "Ruby", "Liam", "Harper", "Henry", "Priya", "Arjun", "Mei", "Daniel", "Sophie", "Marco", "Aisha", "Ben", "Leah", "Sam"];
const LAST = ["Smith", "Nguyen", "Brown", "Wilson", "Taylor", "Johnson", "White", "Martin", "Anderson", "Thompson", "Walker", "Harris", "Lee", "Ryan", "Robinson", "Kelly", "King", "Patel", "Singh", "Chen", "Rossi", "Murphy", "Hughes", "Khan"];
const REPS = ["Josh", "Tahlia", "Marcus", null];

async function main() {
  const existing = await db.select().from(schema.speakers).limit(1);
  if (existing.length) {
    console.log("Database already seeded — run `npm run db:reset` to start over.");
    return;
  }

  const [speaker] = await db.insert(schema.speakers).values({ name: "Aaron Sansoni" }).returning();

  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme-admin";
  const viewerPassword = process.env.SEED_VIEWER_PASSWORD ?? "changeme-team";
  await db.insert(schema.users).values([
    { email: "admin@example.com", name: "Admin", role: "admin", passwordHash: await bcrypt.hash(adminPassword, 10) },
    { email: "team@example.com", name: "Sansoni Team", role: "viewer", speakerId: speaker.id, passwordHash: await bcrypt.hash(viewerPassword, 10) },
  ]);

  const [fortuna] = await db
    .insert(schema.offers)
    .values({
      speakerId: speaker.id,
      name: "Fortuna One — 12 month program",
      description: "Mentoring, live masterminds and the full Fortuna toolkit.",
      priceCents: 5_997_00,
      instalmentCount: 6,
      instalmentCents: 1_097_00,
      instalmentIntervalDays: 30,
    })
    .returning();

  const now = Date.now();
  const day = 86_400_000;
  const eventDefs = [
    { name: "Wealth Mastery Live", city: "Perth", daysAgo: 40, buyers: 80 },
    { name: "Wealth Mastery Live", city: "Sydney", daysAgo: 12, buyers: 272 },
  ];

  let n = 0;
  for (const def of eventDefs) {
    const startsAt = new Date(now - def.daysAgo * day);
    const [event] = await db.insert(schema.events).values({ speakerId: speaker.id, name: def.name, city: def.city, startsAt }).returning();
    const links = await db
      .insert(schema.checkoutLinks)
      .values(REPS.map((rep, i) => ({ code: `${def.city.toLowerCase()}-${i + 1}`, eventId: event.id, offerId: fortuna.id, repName: rep, label: rep ? `${rep}'s table` : "Stage screen" })))
      .returning();

    for (let i = 0; i < def.buyers; i++) {
      n++;
      const link = pick(links);
      const first = pick(FIRST);
      const last = pick(LAST);
      const completedAt = new Date(startsAt.getTime() + (9 + rand() * 9) * 3_600_000 + Math.floor(rand() * 2) * day);
      const instalment = rand() < 0.09;
      const quantity = rand() < 0.08 ? 2 : 1;

      await db.insert(schema.scans).values(
        Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({ checkoutLinkId: link.id, createdAt: new Date(completedAt.getTime() - 60_000) })),
      );
      const [customer] = await db
        .insert(schema.customers)
        .values({ firstName: first, lastName: last, email: `${first}.${last}.${n}@example.com`.toLowerCase(), phone: rand() < 0.9 ? `+614${String(Math.floor(rand() * 1e8)).padStart(8, "0")}` : null, createdAt: completedAt })
        .returning();

      const perPayment = (instalment ? fortuna.instalmentCents! : fortuna.priceCents) * quantity;
      const count = instalment ? fortuna.instalmentCount! : 1;
      const [order] = await db
        .insert(schema.orders)
        .values({
          customerId: customer.id,
          eventId: event.id,
          offerId: fortuna.id,
          checkoutLinkId: link.id,
          status: "completed",
          paymentType: instalment ? "instalment" : "full",
          quantity,
          totalCents: perPayment * count,
          repName: link.repName,
          maxioSubscriptionId: `seed_sub_${n}`,
          completedAt,
          createdAt: completedAt,
        })
        .returning();

      await db.insert(schema.payments).values(
        Array.from({ length: count }, (_, k) => {
          const dueAt = new Date(completedAt.getTime() + k * 30 * day);
          const due = dueAt.getTime() <= now;
          const failed = due && k > 0 && rand() < 0.1;
          return {
            orderId: order.id,
            status: !due ? ("scheduled" as const) : failed ? ("failed" as const) : ("succeeded" as const),
            amountCents: perPayment,
            instalmentNumber: instalment ? k + 1 : null,
            dueAt,
            paidAt: due && !failed ? dueAt : null,
            externalId: due && !failed ? `seed_txn_${n}_${k}` : null,
            failureReason: failed ? "Insufficient funds" : null,
            createdAt: dueAt,
          };
        }),
      );
    }
  }

  console.log(`Seeded ${n} buyers across ${eventDefs.length} events.`);
  console.log(`Admin login: admin@example.com / ${adminPassword}`);
  console.log(`Team login:  team@example.com / ${viewerPassword}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
