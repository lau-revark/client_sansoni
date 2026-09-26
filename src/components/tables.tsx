import type { CustomerRow, OrderRow, PaymentRow } from "@/lib/reporting";
import { formatDateTime, formatMoney } from "@/lib/format";

const th = "whitespace-nowrap px-4 py-3 text-left font-medium text-ink-2";
const td = "px-4 py-3 align-top";

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 overflow-x-auto rounded-xl border border-line">{children}</div>;
}

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  return (
    <Shell>
      <table className="tabular w-full min-w-[820px] text-sm">
        <thead className="bg-canvas">
          <tr>
            <th className={th}>Name</th>
            <th className={th}>Phone</th>
            <th className={th}>Email</th>
            <th className={th}>City</th>
            <th className={`${th} text-right`}>Purchased qty</th>
            <th className={`${th} text-right`}>Total amount paid</th>
            <th className={th}>Payment status</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">No customers in this range.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className={`${td} font-medium text-ink`}>{r.name}</td>
              <td className={td}>{r.phone ?? "—"}</td>
              <td className={`${td} break-all`}>{r.email}</td>
              <td className={td}>{r.cities}</td>
              <td className={`${td} text-right`}>{r.quantity}</td>
              <td className={`${td} whitespace-nowrap text-right`}>{formatMoney(r.totalPaidCents)}</td>
              <td className={td}>{r.paymentStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}

export function OrdersTable({ rows }: { rows: OrderRow[] }) {
  return (
    <Shell>
      <table className="tabular w-full min-w-[900px] text-sm">
        <thead className="bg-canvas">
          <tr>
            <th className={th}>Completed</th>
            <th className={th}>Customer</th>
            <th className={th}>Event</th>
            <th className={th}>Offer</th>
            <th className={th}>Payment</th>
            <th className={`${th} text-right`}>Qty</th>
            <th className={`${th} text-right`}>Contract value</th>
            <th className={th}>Rep</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">No sales in this range.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.completedAt)}</td>
              <td className={td}><div className="font-medium text-ink">{r.customer}</div><div className="text-muted">{r.email}</div></td>
              <td className={td}>{r.event}<div className="text-muted">{r.city}</div></td>
              <td className={td}>{r.offer}</td>
              <td className={td}>{r.paymentType}</td>
              <td className={`${td} text-right`}>{r.quantity}</td>
              <td className={`${td} whitespace-nowrap text-right`}>{formatMoney(r.totalCents)}</td>
              <td className={td}>{r.repName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  return (
    <Shell>
      <table className="tabular w-full min-w-[820px] text-sm">
        <thead className="bg-canvas">
          <tr>
            <th className={th}>Paid</th>
            <th className={th}>Customer</th>
            <th className={th}>City</th>
            <th className={th}>Type</th>
            <th className={th}>Instalment</th>
            <th className={`${th} text-right`}>Amount</th>
            <th className={th}>Transaction</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">No payments in this range.</td></tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line">
              <td className={`${td} whitespace-nowrap`}>{formatDateTime(r.paidAt)}</td>
              <td className={td}><div className="font-medium text-ink">{r.customer}</div><div className="text-muted">{r.email}</div></td>
              <td className={td}>{r.city}</td>
              <td className={td}>{r.kind}</td>
              <td className={td}>{r.instalmentNumber ?? "—"}</td>
              <td className={`${td} whitespace-nowrap text-right ${r.amountCents < 0 ? "text-bad" : ""}`}>{formatMoney(r.amountCents)}</td>
              <td className={`${td} font-mono text-xs text-muted`}>{r.externalId ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
