import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { desc, eq, sql } from "drizzle-orm";
import { Card } from "@/components/app-shell";
import { db, schema } from "@/db";
import { formatDate } from "@/lib/format";
import { checkoutUrl } from "@/lib/urls";
import { createCheckoutLink, toggleCheckoutLink } from "../../actions";

export const dynamic = "force-dynamic";

const input = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent";
const label = "block text-sm font-medium text-ink-2";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1);
  if (!event) notFound();

  const [offers, links] = await Promise.all([
    db.select().from(schema.offers).where(eq(schema.offers.speakerId, event.speakerId)).orderBy(schema.offers.name),
    db
      .select({
        link: schema.checkoutLinks,
        offerName: schema.offers.name,
        scans: sql<number>`(select count(*)::int from scans s where s.checkout_link_id = ${schema.checkoutLinks.id})`,
        sales: sql<number>`(select count(*)::int from orders o where o.checkout_link_id = ${schema.checkoutLinks.id} and o.status = 'completed')`,
      })
      .from(schema.checkoutLinks)
      .innerJoin(schema.offers, eq(schema.offers.id, schema.checkoutLinks.offerId))
      .where(eq(schema.checkoutLinks.eventId, id))
      .orderBy(desc(schema.checkoutLinks.createdAt)),
  ]);

  const withQr = await Promise.all(
    links.map(async (l) => ({ ...l, url: checkoutUrl(l.link.code), svg: await QRCode.toString(checkoutUrl(l.link.code), { type: "svg", margin: 1 }) })),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/events" className="text-sm text-ink-2 hover:text-accent">← All events</Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">{event.name}</h1>
        <p className="text-ink-2">{event.city}{event.venue ? ` · ${event.venue}` : ""} · {formatDate(event.startsAt)}</p>
        <Link href={`/dashboard?event=${event.id}`} className="mt-2 inline-block text-sm text-accent hover:underline">View this event's sales →</Link>
      </div>

      <Card title="New QR code">
        {offers.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Create an offer first on the <Link className="text-accent underline" href="/admin/events">events page</Link>.</p>
        ) : (
          <form action={createCheckoutLink} className="mt-4 grid gap-3 sm:grid-cols-4 sm:items-end">
            <input type="hidden" name="eventId" value={event.id} />
            <label className={`${label} sm:col-span-2`}>
              Offer
              <select name="offerId" required className={input}>
                {offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label className={label}>Label (optional)<input name="label" placeholder="Back of room, table 3" className={input} /></label>
            <label className={label}>Rep (optional)<input name="repName" placeholder="Rep name" className={input} /></label>
            <button className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white sm:col-span-4 sm:justify-self-start">Generate QR code</button>
          </form>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {withQr.map(({ link, offerName, scans, sales, url, svg }) => (
          <Card key={link.id} className={link.active ? "" : "opacity-60"}>
            <div className="mx-auto w-44 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            <p className="mt-3 font-medium text-ink">{offerName}</p>
            <p className="text-sm text-muted">{[link.label, link.repName && `Rep: ${link.repName}`].filter(Boolean).join(" · ") || "No label"}</p>
            <p className="tabular mt-2 text-sm text-ink-2">{scans} scans · {sales} sales{link.active ? "" : " · Disabled"}</p>
            <a href={url} target="_blank" className="mt-1 block break-all text-xs text-accent hover:underline">{url}</a>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
              <a className="hover:text-accent hover:underline" href={`/api/qr/${link.code}`}>PNG</a>
              <a className="hover:text-accent hover:underline" href={`/api/qr/${link.code}?format=svg`}>SVG</a>
              <form action={toggleCheckoutLink}>
                <input type="hidden" name="id" value={link.id} />
                <button className="hover:text-accent hover:underline">{link.active ? "Disable" : "Enable"}</button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
