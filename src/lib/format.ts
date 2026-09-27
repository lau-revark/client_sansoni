export function formatMoney(cents: number, currency = "AUD"): string {
  const amount = new Intl.NumberFormat("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
  return `${currency} ${amount}`;
}

export function formatCompactMoney(cents: number): string {
  return new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-AU").format(n);
}

export function formatDateTime(d: Date | string | null, tz = process.env.REPORTING_TZ ?? "Australia/Sydney"): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-AU", { timeZone: tz, dateStyle: "medium", timeStyle: "short" }).format(new Date(d));
}

export function formatPercent(ratio: number): string {
  return new Intl.NumberFormat("en-AU", { style: "percent", maximumFractionDigits: 1 }).format(ratio);
}

export function formatDate(d: Date | string | null, tz = process.env.REPORTING_TZ ?? "Australia/Sydney"): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-AU", { timeZone: tz, dateStyle: "medium" }).format(new Date(d));
}
