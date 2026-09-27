import { Card, Pagination } from "@/components/app-shell";
import { CityChart } from "@/components/city-chart";
import { FilterBar } from "@/components/filter-bar";
import { StatCard } from "@/components/stat-card";
import { DailyChart } from "@/components/daily-chart";
import { CustomersTable, DailyTable } from "@/components/tables";
import { requireUser } from "@/lib/auth";
import { carryParams, filtersFromParams, firstParam, type SearchParams } from "@/lib/filters";
import { formatCount, formatMoney, formatPercent } from "@/lib/format";
import { getByCity, getCustomers, getDaily, getScopedCities, getScopedEvents, getSummary, PAGE_SIZE } from "@/lib/reporting";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const user = await requireUser();
  const { filters } = filtersFromParams(params, user);
  const page = Math.max(1, Number(firstParam(params.page)) || 1);

  const [summary, byCity, daily, customers, events, cities] = await Promise.all([
    getSummary(filters),
    getByCity(filters),
    getDaily(filters),
    getCustomers(filters, { page }),
    getScopedEvents(filters.speakerId),
    getScopedCities(filters.speakerId),
  ]);

  const records = (view: string, extra: Record<string, string> = {}) => `/dashboard/records${carryParams(params, { view, ...extra })}`;
  const csv = (dataset: string, extra: Record<string, string> = {}) => `/api/export${carryParams(params, { dataset, ...extra })}`;
  const conversion = summary.scans > 0 ? summary.totalSales / summary.scans : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Your private portal</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{user.speakerName ?? "Aaron Sansoni"} — Sales</h1>
        <p className="mt-1 text-ink-2">Only records connected to your access are shown.</p>
      </div>

      <FilterBar events={events} cities={cities} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total revenue collected" emphasis value={formatMoney(summary.revenueCollectedCents)} recordsHref={records("payments")} csvHref={csv("payments")} />
        <StatCard label="Total signups" value={formatCount(summary.signups)} recordsHref={records("customers")} csvHref={csv("customers")} />
        <StatCard label="Total sales" value={formatCount(summary.totalSales)} recordsHref={records("orders")} csvHref={csv("orders")} />
        <StatCard label="Paid in full" value={formatCount(summary.paidInFull)} recordsHref={records("customers", { payment: "full" })} csvHref={csv("customers", { payment: "full" })} />
        <StatCard label="On instalment plan" value={formatCount(summary.onInstalmentPlan)} recordsHref={records("customers", { payment: "instalment" })} csvHref={csv("customers", { payment: "instalment" })} />
        <StatCard label="Instalments still to collect" value={formatMoney(summary.outstandingInstalmentsCents)} hint="Scheduled payments on plans sold in this range" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="QR code scans" value={formatCount(summary.scans)} />
        <StatCard label="Scan → sale conversion" value={conversion === null ? "—" : formatPercent(conversion)} hint="Completed sales ÷ QR scans" />
        <StatCard label="Failed payments" value={formatCount(summary.failedPayments)} hint="Declined cards and failed instalments" />
      </div>

      <Card
        title="By date and city"
        actions={<a className="hover:text-accent hover:underline" href={csv("daily")}>Export CSV</a>}
      >
        <p className="mt-1 text-sm text-muted">Sales by the day they were made; revenue by the day the money arrived (later instalments land on their own day).</p>
        <DailyChart points={daily} allCities={cities} />
        <DailyTable rows={daily} />
      </Card>

      <Card
        title="Your customers"
        actions={
          <>
            <a className="hover:text-accent hover:underline" href={records("customers")}>View underlying records</a>
            <a className="hover:text-accent hover:underline" href={csv("customers")}>Export CSV</a>
          </>
        }
      >
        <CustomersTable rows={customers.rows} />
        <Pagination page={page} total={customers.total} pageSize={PAGE_SIZE} hrefFor={(p) => `/dashboard${carryParams(params, { page: p })}`} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <CityChart
          title="Units purchased by city"
          format="count"
          data={byCity.map((c) => ({ city: c.city, value: c.units }))}
          recordsHref={records("orders")}
          csvHref={csv("city")}
        />
        <CityChart
          title="Revenue collected by city"
          format="money"
          unitLabel="AUD"
          data={byCity.map((c) => ({ city: c.city, value: c.revenueCents }))}
          recordsHref={records("payments")}
          csvHref={csv("city")}
        />
      </div>

      <Card title="Understanding your totals">
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          <li><strong className="text-ink">Signups</strong> are unique customers with a completed purchase.</li>
          <li><strong className="text-ink">Paid in full / On instalment plan</strong> count customers; a customer who used both options appears in both.</li>
          <li><strong className="text-ink">Total sales</strong> counts completed orders once, even with multiple items. <strong className="text-ink">Units</strong> add up quantities.</li>
          <li><strong className="text-ink">Revenue collected</strong> is money actually received (minus refunds) in the date range. Future instalments and failed payments are excluded.</li>
          <li><strong className="text-ink">City</strong> is the city of the event where the purchase was made. Use the city filter to see one city across every figure.</li>
          <li>Sales are dated by when the checkout completed; payments by when the money was received. Dates use {process.env.REPORTING_TZ ?? "Australia/Sydney"} time.</li>
        </ul>
      </Card>
    </div>
  );
}
