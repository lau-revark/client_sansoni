import Link from "next/link";
import { Card, Pagination } from "@/components/app-shell";
import { FilterBar } from "@/components/filter-bar";
import { CustomersTable, OrdersTable, PaymentsTable } from "@/components/tables";
import { requireUser } from "@/lib/auth";
import { carryParams, filtersFromParams, firstParam, type SearchParams } from "@/lib/filters";
import { getCustomers, getOrders, getPayments, getScopedCities, getScopedEvents, PAGE_SIZE, type CustomerPaymentFilter } from "@/lib/reporting";

export const dynamic = "force-dynamic";

const VIEWS = [
  { view: "customers", payment: "", label: "All customers" },
  { view: "customers", payment: "full", label: "Paid in full" },
  { view: "customers", payment: "instalment", label: "On instalment plan" },
  { view: "orders", payment: "", label: "Sales" },
  { view: "payments", payment: "", label: "Payments collected" },
];

export default async function RecordsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { filters } = filtersFromParams(params, user);
  const view = firstParam(params.view) ?? "customers";
  const payment = (firstParam(params.payment) ?? "") as CustomerPaymentFilter | "";
  const search = firstParam(params.q) ?? "";
  const page = Math.max(1, Number(firstParam(params.page)) || 1);

  const [events, cities] = await Promise.all([getScopedEvents(filters.speakerId), getScopedCities(filters.speakerId)]);
  const here = (extra: Record<string, string | number | undefined>) =>
    `/dashboard/records${carryParams(params, { view, payment: payment || undefined, q: search || undefined, ...extra })}`;
  const csvHref = `/api/export${carryParams(params, {
    dataset: view,
    payment: view === "customers" ? payment || undefined : undefined,
    q: view === "customers" ? search || undefined : undefined,
  })}`;

  let table: React.ReactNode;
  let total = 0;
  if (view === "orders") {
    const res = await getOrders(filters, { page });
    total = res.total;
    table = <OrdersTable rows={res.rows} />;
  } else if (view === "payments") {
    const res = await getPayments(filters, { page });
    total = res.total;
    table = <PaymentsTable rows={res.rows} />;
  } else {
    const res = await getCustomers(filters, { page, search, payment: payment || "all" });
    total = res.total;
    table = <CustomersTable rows={res.rows} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/dashboard${carryParams(params)}`} className="text-sm text-ink-2 hover:text-accent">← Back to dashboard</Link>
        <h1 className="mt-2 text-2xl font-bold text-ink">Browse permitted records</h1>
      </div>

      <FilterBar events={events} cities={cities} />

      <Card>
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((v) => {
            const active = v.view === view && v.payment === payment;
            return (
              <Link
                key={v.label}
                href={`/dashboard/records${carryParams(params, { view: v.view, payment: v.payment || undefined, page: undefined, q: undefined })}`}
                className={`rounded-full px-3.5 py-1.5 text-sm ${active ? "bg-navy text-white" : "border border-line text-ink-2 hover:bg-canvas"}`}
              >
                {v.label}
              </Link>
            );
          })}
        </div>

        {view === "customers" && (
          <form className="mt-4 flex gap-2" action="/dashboard/records">
            {Object.entries({ ...Object.fromEntries(new URLSearchParams(carryParams(params))), view, payment }).map(([k, v]) =>
              v ? <input key={k} type="hidden" name={k} value={v} /> : null,
            )}
            <input
              name="q"
              defaultValue={search}
              placeholder="Search permitted records…"
              className="w-full max-w-md rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white">Search</button>
          </form>
        )}

        {table}
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} hrefFor={(p) => here({ page: p })} />
        <div className="mt-4 text-sm">
          <a href={csvHref} className="text-ink-2 hover:text-accent hover:underline">Export CSV</a>
        </div>
      </Card>
    </div>
  );
}
