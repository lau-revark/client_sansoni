import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { filtersFromParams } from "@/lib/filters";
import { getByCity, getCustomers, getDaily, getOrders, getPayments, type CustomerPaymentFilter } from "@/lib/reporting";

export const dynamic = "force-dynamic";

const dollars = (cents: number) => (cents / 100).toFixed(2);

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const { filters } = filtersFromParams(params, user);
  const dataset = params.dataset ?? "customers";
  let csv: string;

  if (dataset === "orders") {
    const { rows } = await getOrders(filters, { limit: null });
    csv = toCsv(
      ["Completed at", "Customer", "Email", "Event", "City", "Offer", "Payment type", "Quantity", "Contract value (AUD)", "Rep", "Order ID"],
      rows.map((r) => [r.completedAt, r.customer, r.email, r.event, r.city, r.offer, r.paymentType, r.quantity, dollars(r.totalCents), r.repName, r.id]),
    );
  } else if (dataset === "payments") {
    const { rows } = await getPayments(filters, { limit: null });
    csv = toCsv(
      ["Paid at", "Customer", "Email", "City", "Type", "Instalment", "Amount (AUD)", "Transaction ID"],
      rows.map((r) => [r.paidAt, r.customer, r.email, r.city, r.kind, r.instalmentNumber, dollars(r.amountCents), r.externalId]),
    );
  } else if (dataset === "daily") {
    const rows = await getDaily(filters);
    csv = toCsv(
      ["Date", "City", "Sales", "Units", "Paid in full", "Instalment plan", "Revenue collected (AUD)"],
      rows.map((r) => [r.date, r.city, r.sales, r.units, r.paidInFull, r.onInstalmentPlan, dollars(r.revenueCents)]),
    );
  } else if (dataset === "city") {
    const rows = await getByCity(filters);
    csv = toCsv(["City", "Units purchased", "Revenue collected (AUD)"], rows.map((r) => [r.city, r.units, dollars(r.revenueCents)]));
  } else {
    const payment = (["full", "instalment"].includes(params.payment) ? params.payment : "all") as CustomerPaymentFilter;
    const { rows } = await getCustomers(filters, { limit: null, payment, search: params.q });
    csv = toCsv(
      ["Name", "Phone", "Email", "City", "Purchased quantity", "Total amount paid (AUD)", "Payment status", "Customer since"],
      rows.map((r) => [r.name, r.phone, r.email, r.cities, r.quantity, dollars(r.totalPaidCents), r.paymentStatus, r.createdAt]),
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="sansoni-${dataset}-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
