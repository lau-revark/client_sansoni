"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Datum = { city: string; value: number };

export function CityChart({
  title,
  data,
  format,
  compact,
  unitLabel,
  recordsHref,
  csvHref,
}: {
  title: string;
  data: Datum[];
  /** "money" values are cents. */
  format: "count" | "money";
  compact?: boolean;
  unitLabel?: string;
  recordsHref: string;
  csvHref: string;
}) {
  const [showData, setShowData] = useState(false);
  const full = (v: number) =>
    format === "money"
      ? `AUD ${(v / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : v.toLocaleString("en-AU");
  const tick = (v: number) =>
    format === "money"
      ? new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 }).format(v / 100)
      : new Intl.NumberFormat("en-AU", { notation: compact ? "compact" : "standard" }).format(v);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {unitLabel && <p className="mt-1 text-xs text-muted">{unitLabel}</p>}
      {data.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No sales in this range yet.</p>
      ) : (
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="#e3e8f2" strokeDasharray="3 3" />
              <XAxis dataKey="city" tickLine={false} axisLine={{ stroke: "#c9d1e1" }} tick={{ fill: "#4a5572", fontSize: 12 }} />
              <YAxis tickFormatter={tick} tickLine={false} axisLine={false} tick={{ fill: "#7a849c", fontSize: 12 }} width={56} />
              <Tooltip
                cursor={{ fill: "rgba(42,120,214,0.08)" }}
                formatter={(v) => [full(Number(v)), title]}
                contentStyle={{ borderRadius: 10, border: "1px solid #e3e8f2", fontSize: 13 }}
              />
              <Bar dataKey="value" fill="var(--color-series-1)" radius={[4, 4, 0, 0]} maxBarSize={120} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {showData && data.length > 0 && (
        <table className="tabular mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="py-2 font-medium">City</th>
              <th className="py-2 text-right font-medium">{title}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.city} className="border-b border-line/60">
                <td className="py-2">{d.city}</td>
                <td className="py-2 text-right">{full(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2">
        <a className="hover:text-accent hover:underline" href={recordsHref}>View underlying records</a>
        <button className="hover:text-accent hover:underline" onClick={() => setShowData((s) => !s)}>{showData ? "Hide data" : "Show data"}</button>
        <a className="hover:text-accent hover:underline" href={csvHref}>Export CSV</a>
      </div>
    </section>
  );
}
