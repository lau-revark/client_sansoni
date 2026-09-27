import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { loadCheckoutLink } from "@/lib/checkout";
import { formatDate } from "@/lib/format";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

const BOT = /bot|crawl|spider|preview|facebookexternalhit|slackbot|whatsapp/i;

export default async function CheckoutPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const found = await loadCheckoutLink(code);
  if (!found) notFound();
  const { link, offer, event } = found;

  // Top of the funnel. Link-preview bots are ignored so sharing a link doesn't inflate scans.
  const ua = (await headers()).get("user-agent") ?? "";
  if (!BOT.test(ua)) {
    await db.insert(schema.scans).values({ checkoutLinkId: link.id, userAgent: ua.slice(0, 300) });
  }

  return (
    <main className="min-h-screen bg-canvas">
      <div className="bg-navy px-4 pb-16 pt-8 text-white">
        <div className="mx-auto max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">Aaron Sansoni Group</p>
          <h1 className="mt-2 text-2xl font-bold">{offer.name}</h1>
          <p className="mt-1 text-sm text-white/70">{event.name} · {event.city} · {formatDate(event.startsAt)}</p>
          {offer.description && <p className="mt-3 text-sm text-white/80">{offer.description}</p>}
        </div>
      </div>
      <div className="mx-auto -mt-10 max-w-lg px-4 pb-12">
        <CheckoutForm
          code={code}
          currency={offer.currency}
          priceCents={offer.priceCents}
          instalmentCount={offer.instalmentCount}
          instalmentCents={offer.instalmentCents}
          mockPayments={(process.env.PAYMENT_PROVIDER ?? "mock") === "mock"}
        />
      </div>
    </main>
  );
}
