import { resolveRange, type DateRange } from "./dates";
import type { ReportFilters } from "./reporting";
import type { CurrentUser } from "./auth";

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Read the dashboard's URL state and pin it to what the viewer is allowed to see. */
export function filtersFromParams(params: SearchParams, user: CurrentUser): { range: DateRange; filters: ReportFilters } {
  const range = resolveRange({ range: one(params.range), from: one(params.from), to: one(params.to) });
  return {
    range,
    filters: {
      start: range.start,
      end: range.end,
      // Viewers are always locked to their speaker; admins see everything.
      speakerId: user.role === "admin" ? null : user.speakerId,
      eventId: one(params.event) || null,
      city: one(params.city) || null,
    },
  };
}

/** Keep range/event params when linking between dashboard pages. */
export function carryParams(params: SearchParams, extra: Record<string, string | number | undefined> = {}): string {
  const out = new URLSearchParams();
  for (const key of ["range", "from", "to", "event", "city"]) {
    const v = one(params[key]);
    if (v) out.set(key, v);
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === "") out.delete(k);
    else out.set(k, String(v));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

export { one as firstParam };
