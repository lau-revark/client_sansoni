"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Categorical slots in fixed order (validated default palette). Colour follows the city, never its rank.
const CITY_COLOURS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

export type DailyPoint = { date: string; city: string; sales: number; revenueCents: number };

export function DailyChart({ points, allCities }: { points: DailyPoint[]; allCities: string[] }) {
  const [metric, setMetric] = useState<"revenue" | "sales">("revenue");
  const colourFor = (city: string) => CITY_COLOURS[allCities.indexOf(city) % CITY_COLOURS.length] ?? "#7a849c";
  const cities = [...new Set(points.map((p) => p.city))].sort((a, b) => allCities.indexOf(a) - allCities.indexOf(b));

  const byDate = new Map<string, Record<string, number | string>>();
  for (const p of points) {
    const row = byDate.get(p.date) ?? { date: p.date };
    row[p.city] = metric === "revenue" ? p.revenueCents : p.sales;
    byDate.set(p.date, row);
  }
  const data = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" });
  const tick = (v: number) =>
    new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 }).format(metric === "revenue" ? v / 100 : v);
  const full = (v: number) =>
    metric === "revenue"
      ? `AUD ${(v / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : v.toLocaleString("en-AU");

  const seg = (m: typeof metric, label: string) => (
    <button
      onClick={() => setMetric(m)}
      aria-pressed={metric === m}
      className={`px-3 py-1.5 text-sm ${metric === m ? "bg-navy text-white" : "text-ink-2 hover:bg-canvas"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-4">
      <div className="inline-flex overflow-hidden rounded-lg border border-line">
        {seg("revenue", "Revenue collected")}
        {seg("sales", "Sales")}
      </div>
      {data.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted">No activity in this range yet.</p>
      ) : (
        <div className="mt-4 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke="#e3e8f2" strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={dayLabel} tickLine={false} axisLine={{ stroke: "#c9d1e1" }} tick={{ fill: "#4a5572", fontSize: 12 }} minTickGap={12} />
              <YAxis tickFormatter={tick} tickLine={false} axisLine={false} tick={{ fill: "#7a849c", fontSize: 12 }} width={52} />
              <Tooltip
                cursor={{ fill: "rgba(42,120,214,0.08)" }}
                labelFormatter={(d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                formatter={(v, name) => [full(Number(v)), name]}
                contentStyle={{ borderRadius: 10, border: "1px solid #e3e8f2", fontSize: 13 }}
              />
              <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} formatter={(value) => <span style={{ color: "#4a5572" }}>{value}</span>} />
              {cities.map((c, i) => (
                <Bar
                  key={c}
                  dataKey={c}
                  stackId="day"
                  fill={colourFor(c)}
                  stroke="#ffffff"
                  strokeWidth={1}
                  maxBarSize={56}
                  radius={i === cities.length - 1 ? [4, 4, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
