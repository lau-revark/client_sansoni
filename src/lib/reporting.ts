import { sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { REPORTING_TZ } from "./dates";

/**
 * Metric definitions (shown to users in "Understanding your totals"):
 * - Signups: unique customers with at least one completed order in range.
 * - Paid in full / On instalment plan: unique customers by the payment type of their completed orders.
 *   A customer who used both options appears in both.
 * - Total sales: completed orders, counted once each regardless of quantity.
 * - Revenue collected: succeeded charges minus succeeded refunds, dated by when the money moved.
 *   Future (scheduled) instalments and failed payments are excluded.
 * - City: the city of the event the order was placed at.
 *
 * Orders are placed in the range by their completion time; payments by their paid time.
 */

export interface ReportFilters {
  start: Date | null;
  end: Date | null;
  /** Null = all speakers (admin). */
  speakerId: string | null;
  eventId?: string | null;
  city?: string | null;
}

export type CustomerPaymentFilter = "all" | "full" | "instalment";

type Row = Record<string, unknown>;

async function rows<T extends Row>(query: SQL): Promise<T[]> {
  const res = (await db.execute(query)) as unknown as { rows: T[] };
  return res.rows;
}

function scope(f: ReportFilters): SQL {
  const parts: SQL[] = [sql`true`];
  if (f.speakerId) parts.push(sql`e.speaker_id = ${f.speakerId}`);
  if (f.eventId) parts.push(sql`e.id = ${f.eventId}`);
  if (f.city) parts.push(sql`e.city = ${f.city}`);
  return sql.join(parts, sql` and `);
}

function inRange(column: SQL, f: ReportFilters): SQL {
  const parts: SQL[] = [sql`true`];
  if (f.start) parts.push(sql`${column} >= ${f.start.toISOString()}`);
  if (f.end) parts.push(sql`${column} < ${f.end.toISOString()}`);
  return sql.join(parts, sql` and `);
}

/** Completed orders in range, within the viewer's scope. Aliases: o (orders), e (events). */
function completedOrders(f: ReportFilters, joins: SQL = sql``): SQL {
  return sql`
    from orders o
    join events e on e.id = o.event_id
    ${joins}
    where o.status = 'completed'
      and ${inRange(sql`o.completed_at`, f)}
      and ${scope(f)}`;
}

/** Money that actually moved in range. Aliases: p (payments), o, e. */
function collectedPayments(f: ReportFilters, joins: SQL = sql``): SQL {
  return sql`
    from payments p
    join orders o on o.id = p.order_id
    join events e on e.id = o.event_id
    ${joins}
    where p.status = 'succeeded'
      and ${inRange(sql`p.paid_at`, f)}
      and ${scope(f)}`;
}

const signedAmount = sql`case when p.kind = 'refund' then -p.amount_cents else p.amount_cents end`;

export interface Summary {
  signups: number;
  paidInFull: number;
  onInstalmentPlan: number;
  totalSales: number;
  unitsSold: number;
  revenueCollectedCents: number;
  outstandingInstalmentsCents: number;
  failedPayments: number;
  scans: number;
}

export async function getSummary(f: ReportFilters): Promise<Summary> {
  const [orderStats] = await rows<{
    signups: number;
    paid_in_full: number;
    on_instalment: number;
    total_sales: number;
    units: number;
  }>(sql`
    select
      count(distinct o.customer_id)::int as signups,
      count(distinct o.customer_id) filter (where o.payment_type = 'full')::int as paid_in_full,
      count(distinct o.customer_id) filter (where o.payment_type = 'instalment')::int as on_instalment,
      count(*)::int as total_sales,
      coalesce(sum(o.quantity), 0)::int as units
    ${completedOrders(f)}`);

  const [revenue] = await rows<{ cents: number }>(sql`
    select coalesce(sum(${signedAmount}), 0)::float8 as cents ${collectedPayments(f)}`);

  // Outstanding balance on plans sold in range: every scheduled instalment still to be collected.
  const [outstanding] = await rows<{ cents: number }>(sql`
    select coalesce(sum(p.amount_cents), 0)::float8 as cents
    from payments p
    where p.status = 'scheduled'
      and p.order_id in (select o.id ${completedOrders(f)})`);

  const [failed] = await rows<{ n: number }>(sql`
    select count(*)::int as n
    from payments p
    join orders o on o.id = p.order_id
    join events e on e.id = o.event_id
    where p.status = 'failed'
      and ${inRange(sql`p.created_at`, f)}
      and ${scope(f)}`);

  const [scanCount] = await rows<{ n: number }>(sql`
    select count(*)::int as n
    from scans s
    join checkout_links l on l.id = s.checkout_link_id
    join events e on e.id = l.event_id
    where ${inRange(sql`s.created_at`, f)}
      and ${scope(f)}`);

  return {
    signups: orderStats.signups,
    paidInFull: orderStats.paid_in_full,
    onInstalmentPlan: orderStats.on_instalment,
    totalSales: orderStats.total_sales,
    unitsSold: orderStats.units,
    revenueCollectedCents: Number(revenue.cents),
    outstandingInstalmentsCents: Number(outstanding.cents),
    failedPayments: failed.n,
    scans: scanCount.n,
  };
}

export interface CityRow {
  city: string;
  units: number;
  revenueCents: number;
}

export async function getByCity(f: ReportFilters): Promise<CityRow[]> {
  const units = await rows<{ city: string; units: number }>(sql`
    select e.city, coalesce(sum(o.quantity), 0)::int as units
    ${completedOrders(f)}
    group by e.city`);
  const revenue = await rows<{ city: string; cents: number }>(sql`
    select e.city, coalesce(sum(${signedAmount}), 0)::float8 as cents
    ${collectedPayments(f)}
    group by e.city`);

  const byCity = new Map<string, CityRow>();
  for (const u of units) byCity.set(u.city, { city: u.city, units: u.units, revenueCents: 0 });
  for (const r of revenue) {
    const row = byCity.get(r.city) ?? { city: r.city, units: 0, revenueCents: 0 };
    row.revenueCents = Number(r.cents);
    byCity.set(r.city, row);
  }
  return [...byCity.values()].sort((a, b) => a.city.localeCompare(b.city));
}

export interface DailyRow {
  /** Calendar day (YYYY-MM-DD) in the reporting timezone. */
  date: string;
  city: string;
  sales: number;
  units: number;
  paidInFull: number;
  onInstalmentPlan: number;
  revenueCents: number;
}

/**
 * One row per day and city. Sales are placed on the day the checkout completed; revenue on the day
 * the money was received, so a day can show revenue (a later instalment) with no new sales.
 * Paid in full / instalment count unique customers within that day and city.
 */
export async function getDaily(f: ReportFilters, tz = REPORTING_TZ): Promise<DailyRow[]> {
  const sales = await rows<{ day: string; city: string; sales: number; units: number; full: number; instalment: number }>(sql`
    select to_char(o.completed_at at time zone ${tz}, 'YYYY-MM-DD') as day, e.city,
           count(*)::int as sales,
           coalesce(sum(o.quantity), 0)::int as units,
           count(distinct o.customer_id) filter (where o.payment_type = 'full')::int as full,
           count(distinct o.customer_id) filter (where o.payment_type = 'instalment')::int as instalment
    ${completedOrders(f)}
    group by 1, 2`);
  const revenue = await rows<{ day: string; city: string; cents: number }>(sql`
    select to_char(p.paid_at at time zone ${tz}, 'YYYY-MM-DD') as day, e.city,
           coalesce(sum(${signedAmount}), 0)::float8 as cents
    ${collectedPayments(f)}
    group by 1, 2`);

  const byKey = new Map<string, DailyRow>();
  const get = (date: string, city: string) => {
    const key = `${date}|${city}`;
    let row = byKey.get(key);
    if (!row) {
      row = { date, city, sales: 0, units: 0, paidInFull: 0, onInstalmentPlan: 0, revenueCents: 0 };
      byKey.set(key, row);
    }
    return row;
  };
  for (const s of sales) Object.assign(get(s.day, s.city), { sales: s.sales, units: s.units, paidInFull: s.full, onInstalmentPlan: s.instalment });
  for (const r of revenue) get(r.day, r.city).revenueCents = Number(r.cents);
  return [...byKey.values()].sort((a, b) => b.date.localeCompare(a.date) || a.city.localeCompare(b.city));
}

/** Cities the viewer may filter by. */
export async function getScopedCities(speakerId: string | null): Promise<string[]> {
  const res = await rows<{ city: string }>(sql`
    select distinct e.city from events e
    where ${speakerId ? sql`e.speaker_id = ${speakerId}` : sql`true`}
    order by e.city`);
  return res.map((r) => r.city);
}

export interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  cities: string;
  quantity: number;
  totalPaidCents: number;
  paymentStatus: string;
  createdAt: string;
}

export const PAGE_SIZE = 50;

export async function getCustomers(
  f: ReportFilters,
  opts: { page?: number; search?: string; payment?: CustomerPaymentFilter; limit?: number | null } = {},
): Promise<{ rows: CustomerRow[]; total: number }> {
  const payment = opts.payment ?? "all";
  const search = opts.search?.trim();
  const limit = opts.limit === undefined ? PAGE_SIZE : opts.limit;
  const page = Math.max(1, opts.page ?? 1);

  const filters: SQL[] = [sql`true`];
  if (payment !== "all") filters.push(sql`${payment} = any(c_orders.types)`);
  if (search) {
    const like = `%${search.toLowerCase()}%`;
    filters.push(sql`(lower(c.first_name || ' ' || c.last_name) like ${like} or lower(c.email) like ${like} or coalesce(c.phone, '') like ${like})`);
  }

  const base = sql`
    with c_orders as (
      select o.customer_id,
             string_agg(distinct e.city, ', ' order by e.city) as cities,
             sum(o.quantity)::int as quantity,
             array_agg(distinct o.payment_type::text) as types
      ${completedOrders(f)}
      group by o.customer_id
    ),
    c_paid as (
      select o.customer_id, sum(${signedAmount})::float8 as cents
      ${collectedPayments(f)}
      group by o.customer_id
    )
    select c.id, c.first_name || ' ' || c.last_name as name, c.phone, c.email, c.created_at,
           coalesce(c_orders.cities, 'Unknown') as cities,
           c_orders.quantity,
           coalesce(c_paid.cents, 0) as total_paid_cents,
           c_orders.types
    from c_orders
    join customers c on c.id = c_orders.customer_id
    left join c_paid on c_paid.customer_id = c.id
    where ${sql.join(filters, sql` and `)}`;

  const [{ n }] = await rows<{ n: number }>(sql`select count(*)::int as n from (${base}) t`);
  const paging = limit === null ? sql`` : sql`limit ${limit} offset ${(page - 1) * limit}`;
  const data = await rows<{
    id: string;
    name: string;
    phone: string | null;
    email: string;
    created_at: string | Date;
    cities: string;
    quantity: number;
    total_paid_cents: number;
    types: string[] | string;
  }>(sql`${base} order by c.created_at desc, c.id ${paging}`);

  return {
    total: n,
    rows: data.map((r) => {
      const types = parsePgArray(r.types);
      return {
        id: r.id,
        name: r.name,
        phone: r.phone,
        email: r.email,
        cities: r.cities,
        quantity: r.quantity,
        totalPaidCents: Number(r.total_paid_cents),
        paymentStatus: types.length > 1 ? "Paid in full + Instalment plan" : types[0] === "full" ? "Paid in full" : "Instalment plan",
        createdAt: new Date(r.created_at).toISOString(),
      };
    }),
  };
}

export interface OrderRow {
  id: string;
  completedAt: string;
  customer: string;
  email: string;
  event: string;
  city: string;
  offer: string;
  paymentType: string;
  quantity: number;
  totalCents: number;
  repName: string | null;
}

export async function getOrders(f: ReportFilters, opts: { page?: number; limit?: number | null } = {}) {
  const limit = opts.limit === undefined ? PAGE_SIZE : opts.limit;
  const page = Math.max(1, opts.page ?? 1);
  const [{ n }] = await rows<{ n: number }>(sql`select count(*)::int as n ${completedOrders(f)}`);
  const paging = limit === null ? sql`` : sql`limit ${limit} offset ${(page - 1) * limit}`;
  const data = await rows<Row>(sql`
    select o.id, o.completed_at, c.first_name || ' ' || c.last_name as customer, c.email,
           e.name as event, e.city, ofr.name as offer, o.payment_type, o.quantity, o.total_cents, o.rep_name
    ${completedOrders(f, sql`join customers c on c.id = o.customer_id join offers ofr on ofr.id = o.offer_id`)}
    order by o.completed_at desc, o.id ${paging}`);
  return {
    total: n,
    rows: data.map(
      (r): OrderRow => ({
        id: String(r.id),
        completedAt: new Date(r.completed_at as string).toISOString(),
        customer: String(r.customer),
        email: String(r.email),
        event: String(r.event),
        city: String(r.city),
        offer: String(r.offer),
        paymentType: r.payment_type === "full" ? "Paid in full" : "Instalment plan",
        quantity: Number(r.quantity),
        totalCents: Number(r.total_cents),
        repName: (r.rep_name as string | null) ?? null,
      }),
    ),
  };
}

export interface PaymentRow {
  id: string;
  paidAt: string;
  customer: string;
  email: string;
  city: string;
  kind: string;
  instalmentNumber: number | null;
  amountCents: number;
  externalId: string | null;
}

export async function getPayments(f: ReportFilters, opts: { page?: number; limit?: number | null } = {}) {
  const limit = opts.limit === undefined ? PAGE_SIZE : opts.limit;
  const page = Math.max(1, opts.page ?? 1);
  const [{ n }] = await rows<{ n: number }>(sql`select count(*)::int as n ${collectedPayments(f)}`);
  const paging = limit === null ? sql`` : sql`limit ${limit} offset ${(page - 1) * limit}`;
  const data = await rows<Row>(sql`
    select p.id, p.paid_at, c.first_name || ' ' || c.last_name as customer, c.email, e.city,
           p.kind, p.instalment_number, ${signedAmount} as amount_cents, p.external_id
    ${collectedPayments(f, sql`join customers c on c.id = o.customer_id`)}
    order by p.paid_at desc, p.id ${paging}`);
  return {
    total: n,
    rows: data.map(
      (r): PaymentRow => ({
        id: String(r.id),
        paidAt: new Date(r.paid_at as string).toISOString(),
        customer: String(r.customer),
        email: String(r.email),
        city: String(r.city),
        kind: r.kind === "refund" ? "Refund" : "Charge",
        instalmentNumber: (r.instalment_number as number | null) ?? null,
        amountCents: Number(r.amount_cents),
        externalId: (r.external_id as string | null) ?? null,
      }),
    ),
  };
}

/** Events the viewer may filter by. */
export async function getScopedEvents(speakerId: string | null) {
  return rows<{ id: string; name: string; city: string; starts_at: string }>(sql`
    select e.id, e.name, e.city, e.starts_at from events e
    where ${speakerId ? sql`e.speaker_id = ${speakerId}` : sql`true`}
    order by e.starts_at desc`);
}

/** node-postgres parses text[] into arrays; PGlite may return the raw literal. */
function parsePgArray(v: string[] | string | null): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return v.replace(/^\{|\}$/g, "").split(",").filter(Boolean);
}
