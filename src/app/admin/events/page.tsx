import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Card } from "@/components/app-shell";
import { db, schema } from "@/db";
import { formatDate, formatMoney } from "@/lib/format";
import { createEvent, createOffer } from "../actions";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent";
const label = "block text-sm font-medium text-ink-2";

export default async function EventsPage() {
  const [speakers, events, offers] = await Promise.all([
    db.select().from(schema.speakers).orderBy(schema.speakers.name),
    db
      .select({
        event: schema.events,
        sales: sql<number>`(select count(*)::int from orders o where o.event_id = ${schema.events.id} and o.status = 'completed')`,
        links: sql<number>`(select count(*)::int from checkout_links l where l.event_id = ${schema.events.id})`,
      })
      .from(schema.events)
      .orderBy(desc(schema.events.startsAt)),
    db.select({ offer: schema.offers, speaker: schema.speakers.name }).from(schema.offers).innerJoin(schema.speakers, eq(schema.speakers.id, schema.offers.speakerId)).orderBy(schema.offers.name),
  ]);

  const speakerSelect = (
    <label className={label}>
      Speaker
      <select name="speakerId" required className={input}>
        {speakers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink">Events & QR codes</h1>

      <Card title="Events">
        <div className="mt-4 divide-y divide-line">
          {events.length === 0 && <p className="py-6 text-sm text-muted">No events yet.</p>}
          {events.map(({ event, sales, links }) => (
            <Link key={event.id} href={`/admin/events/${event.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-canvas">
              <div>
                <p className="font-medium text-ink">{event.name}</p>
                <p className="text-sm text-muted">{event.city}{event.venue ? ` · ${event.venue}` : ""} · {formatDate(event.startsAt)}</p>
              </div>
              <p className="tabular text-sm text-ink-2">{links} QR codes · {sales} sales →</p>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="New event">
          <form action={createEvent} className="mt-4 space-y-3">
            {speakerSelect}
            <label className={label}>Event name<input name="name" required placeholder="Wealth Mastery Live" className={input} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>City<input name="city" required placeholder="Sydney" className={input} /></label>
              <label className={label}>Date<input name="startsOn" type="date" required className={input} /></label>
            </div>
            <label className={label}>Venue (optional)<input name="venue" className={input} /></label>
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Create event</button>
          </form>
        </Card>

        <Card title="New offer">
          <form action={createOffer} className="mt-4 space-y-3">
            {speakerSelect}
            <label className={label}>Offer name<input name="name" required placeholder="Fortuna Mentorship — 12 months" className={input} /></label>
            <label className={label}>Price in full (AUD)<input name="price" type="number" min="1" step="0.01" required className={input} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>Instalments (optional)<input name="instalmentCount" type="number" min="2" max="36" placeholder="e.g. 6" className={input} /></label>
              <label className={label}>Each instalment (AUD)<input name="instalmentAmount" type="number" min="1" step="0.01" className={input} /></label>
            </div>
            <label className={label}>Maxio product handle (optional)<input name="maxioProductHandle" className={input} /></label>
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white">Create offer</button>
          </form>
        </Card>
      </div>

      <Card title="Offers">
        <div className="mt-4 divide-y divide-line text-sm">
          {offers.length === 0 && <p className="py-6 text-muted">No offers yet.</p>}
          {offers.map(({ offer, speaker }) => (
            <div key={offer.id} className="flex flex-wrap justify-between gap-2 py-3">
              <div>
                <p className="font-medium text-ink">{offer.name}</p>
                <p className="text-muted">{speaker}{offer.maxioProductHandle ? ` · Maxio: ${offer.maxioProductHandle}` : ""}</p>
              </div>
              <p className="tabular text-ink-2">
                {formatMoney(offer.priceCents, offer.currency)}
                {offer.instalmentCount && offer.instalmentCents ? ` or ${offer.instalmentCount} × ${formatMoney(offer.instalmentCents, offer.currency)}` : ""}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
