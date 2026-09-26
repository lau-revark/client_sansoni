import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["admin", "viewer"]);
export const orderStatus = pgEnum("order_status", ["pending", "completed", "failed", "cancelled"]);
export const paymentType = pgEnum("payment_type", ["full", "instalment"]);
export const paymentKind = pgEnum("payment_kind", ["charge", "refund"]);
export const paymentStatus = pgEnum("payment_status", ["scheduled", "succeeded", "failed"]);

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** A speaker/brand whose sales are reported on (e.g. "Aaron Sansoni"). Portal access is scoped by speaker. */
export const speakers = pgTable("speakers", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

/** A live event in a city. Sales made through the event's QR codes are attributed to its city. */
export const events = pgTable(
  "events",
  {
    id: id(),
    speakerId: uuid("speaker_id").notNull().references(() => speakers.id),
    name: text("name").notNull(),
    city: text("city").notNull(),
    venue: text("venue"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("events_speaker_idx").on(t.speakerId)],
);

/** Something sold at an event. Maps to a Maxio product / price point once connected. */
export const offers = pgTable("offers", {
  id: id(),
  speakerId: uuid("speaker_id").notNull().references(() => speakers.id),
  name: text("name").notNull(),
  description: text("description"),
  currency: text("currency").notNull().default("AUD"),
  priceCents: integer("price_cents").notNull(),
  /** Instalment option: N payments of instalmentCents. Null = pay-in-full only. */
  instalmentCount: integer("instalment_count"),
  instalmentCents: integer("instalment_cents"),
  instalmentIntervalDays: integer("instalment_interval_days").default(30),
  maxioProductHandle: text("maxio_product_handle"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

/** A QR code / checkout link: one event + one offer, optionally tagged with the rep who shares it. */
export const checkoutLinks = pgTable(
  "checkout_links",
  {
    id: id(),
    code: text("code").notNull(),
    eventId: uuid("event_id").notNull().references(() => events.id),
    offerId: uuid("offer_id").notNull().references(() => offers.id),
    label: text("label"),
    repName: text("rep_name"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("checkout_links_code_idx").on(t.code)],
);

/** Every time a QR code is opened — the top of the funnel. */
export const scans = pgTable(
  "scans",
  {
    id: id(),
    checkoutLinkId: uuid("checkout_link_id").notNull().references(() => checkoutLinks.id),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("scans_link_idx").on(t.checkoutLinkId)],
);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    maxioCustomerId: text("maxio_customer_id"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("customers_email_idx").on(t.email)],
);

/** One checkout. "Sales" counts completed orders once, regardless of quantity. */
export const orders = pgTable(
  "orders",
  {
    id: id(),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    eventId: uuid("event_id").notNull().references(() => events.id),
    offerId: uuid("offer_id").notNull().references(() => offers.id),
    checkoutLinkId: uuid("checkout_link_id").references(() => checkoutLinks.id),
    status: orderStatus("status").notNull().default("pending"),
    paymentType: paymentType("payment_type").notNull(),
    quantity: integer("quantity").notNull().default(1),
    currency: text("currency").notNull().default("AUD"),
    /** Full contract value (price × quantity), including future instalments. */
    totalCents: integer("total_cents").notNull(),
    repName: text("rep_name"),
    maxioSubscriptionId: text("maxio_subscription_id"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("orders_event_idx").on(t.eventId),
    index("orders_customer_idx").on(t.customerId),
    index("orders_completed_idx").on(t.completedAt),
  ],
);

/** Money movements. Revenue collected = succeeded charges − succeeded refunds. Scheduled rows are future instalments. */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id").notNull().references(() => orders.id),
    kind: paymentKind("kind").notNull().default("charge"),
    status: paymentStatus("status").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("AUD"),
    instalmentNumber: integer("instalment_number"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    /** Provider transaction id — unique so webhook replays can't double count. */
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("payments_order_idx").on(t.orderId),
    index("payments_paid_idx").on(t.paidAt),
    uniqueIndex("payments_external_idx").on(t.externalId),
  ],
);

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("viewer"),
    /** Null = sees every speaker. Otherwise only records attributed to this speaker are shown. */
    speakerId: uuid("speaker_id").references(() => speakers.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/** Raw inbound webhooks, stored before processing so they can be replayed and deduplicated. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    topic: text("topic").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("webhook_events_provider_external_idx").on(t.provider, t.externalId)],
);
