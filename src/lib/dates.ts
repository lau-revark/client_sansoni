export const REPORTING_TZ = process.env.REPORTING_TZ ?? "Australia/Sydney";

export const RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "all", label: "All time" },
  { value: "custom", label: "Custom dates" },
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number]["value"];

export interface DateRange {
  preset: RangePreset;
  /** Inclusive start, or null for unbounded. */
  start: Date | null;
  /** Exclusive end, or null for unbounded. */
  end: Date | null;
  /** YYYY-MM-DD values for the custom inputs. */
  from?: string;
  to?: string;
}

/** Milliseconds that `tz` is ahead of UTC at instant `at`. */
function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/** The UTC instant of local midnight on y-m-d in `tz`. Month is 1-based; overflowing days roll over. */
export function zonedMidnight(y: number, m: number, d: number, tz = REPORTING_TZ): Date {
  const guess = Date.UTC(y, m - 1, d);
  let result = guess - tzOffsetMs(new Date(guess), tz);
  // Re-check once in case a DST transition sits between the guess and the result.
  result = guess - tzOffsetMs(new Date(result), tz);
  return new Date(result);
}

/** Calendar date (y, m 1-based, d) of instant `at` in `tz`. */
export function zonedYmd(at: Date, tz = REPORTING_TZ): [number, number, number] {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(at)
    .split("-")
    .map(Number);
  return [y, m, d];
}

function parseYmd(s: string | undefined): [number, number, number] | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return [y, m, d];
}

export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  now = new Date(),
  tz = REPORTING_TZ,
): DateRange {
  const preset = (RANGE_PRESETS.some((p) => p.value === params.range) ? params.range : "all") as RangePreset;
  const [y, m, d] = zonedYmd(now, tz);
  const day = (dd: number, mm = m, yy = y) => zonedMidnight(yy, mm, dd, tz);

  switch (preset) {
    case "today":
      return { preset, start: day(d), end: day(d + 1) };
    case "yesterday":
      return { preset, start: day(d - 1), end: day(d) };
    case "7d":
      return { preset, start: day(d - 6), end: day(d + 1) };
    case "30d":
      return { preset, start: day(d - 29), end: day(d + 1) };
    case "this_month":
      return { preset, start: day(1), end: day(1, m + 1) };
    case "last_month":
      return { preset, start: day(1, m - 1), end: day(1) };
    case "this_year":
      return { preset, start: day(1, 1), end: day(1, 1, y + 1) };
    case "custom": {
      const from = parseYmd(params.from);
      const to = parseYmd(params.to);
      return {
        preset,
        start: from ? zonedMidnight(from[0], from[1], from[2], tz) : null,
        end: to ? zonedMidnight(to[0], to[1], to[2] + 1, tz) : null,
        from: params.from,
        to: params.to,
      };
    }
    default:
      return { preset: "all", start: null, end: null };
  }
}
