# Aaron Sansoni Group — Event Sales

Replacement for sourceform.co. People at events scan a QR code, check out on their phone, and payment is taken through Maxio. The team gets live sales reporting.

## What's here

| Area | Path | Notes |
|---|---|---|
| QR checkout (public) | `/c/[code]` | Mobile-first. Pay in full or instalment plan. Scans are logged for the funnel. |
| Dashboard | `/dashboard` | Mirrors sourceform: signups, paid in full, on instalment plan, total sales, revenue collected, customers table, units and revenue by city. Also shows QR scans, scan→sale conversion, instalments still to collect and failed payments. Date presets, custom dates, event filter, live auto-refresh (30s) with pause. |
| Records | `/dashboard/records` | Underlying records for every metric, with search, paging and CSV export. |
| Admin | `/admin/events` | Events, offers, QR code generation (PNG/SVG download) with per-code scans and sales. |
| CSV | `/api/export?dataset=customers\|orders\|payments\|city` | Uses the same filters as the dashboard. |
| Maxio webhooks | `/api/webhooks/maxio` | HMAC-verified, deduplicated, stored raw before processing. |

Access: `admin` users see every speaker and can manage events. `viewer` users are locked to their speaker ("Only records connected to your access are shown").

Metric definitions live at the top of `src/lib/reporting.ts` and are covered by `tests/reporting.test.ts`.

## Run locally

```bash
npm install
npm run db:reset     # creates an embedded Postgres in ./.data and seeds demo data
npm run dev          # http://localhost:3000
```

Demo logins (from the seed): `admin@example.com` / `changeme-admin`, `team@example.com` / `changeme-team`.
Try the checkout at http://localhost:3000/c/sydney-1.

Leaving `DATABASE_URL` unset uses PGlite (Postgres compiled to WASM), so no database install is needed. For production, set `DATABASE_URL` to a real Postgres (Supabase, Neon, RDS) and run `npm run db:migrate`.

```bash
npm test           # vitest: date ranges, CSV, metric definitions against a real Postgres engine
npm run typecheck
```

## Configuration

See `.env.example`. In production:

- `AUTH_SECRET` is required.
- Mock payments are refused unless `PAYMENT_PROVIDER=maxio` (or `ALLOW_MOCK_PAYMENTS=true` for a staging demo).

## Connecting Maxio (next step)

1. Set `MAXIO_SUBDOMAIN`, `MAXIO_API_KEY`, `MAXIO_WEBHOOK_SHARED_KEY` and `PAYMENT_PROVIDER=maxio`.
2. Implement `maxioProvider.purchase` in `src/lib/payments/maxio.ts` (create subscription with a Chargify.js token).
3. Replace the test-mode card box in `src/app/c/[code]/checkout-form.tsx` with Chargify.js hosted fields, so card data never touches our server.
4. Point Maxio webhooks at `https://<host>/api/webhooks/maxio` (events: `payment_success`, `payment_failure`, `refund_success`). Confirm field names against real payloads.
5. Set each offer's Maxio product handle in Admin.
