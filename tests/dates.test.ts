import { describe, expect, it } from "vitest";
import { resolveRange, zonedMidnight } from "@/lib/dates";

describe("zonedMidnight", () => {
  it("handles AEST and AEDT", () => {
    expect(zonedMidnight(2026, 7, 1, "Australia/Sydney").toISOString()).toBe("2026-06-30T14:00:00.000Z");
    expect(zonedMidnight(2026, 1, 1, "Australia/Sydney").toISOString()).toBe("2025-12-31T13:00:00.000Z");
  });
  it("handles Perth (no DST)", () => {
    expect(zonedMidnight(2026, 1, 1, "Australia/Perth").toISOString()).toBe("2025-12-31T16:00:00.000Z");
  });
});

describe("resolveRange", () => {
  // 9am Sydney time on 26 Sep 2026 is still 25 Sep in UTC — "today" must follow Sydney.
  const now = new Date("2026-09-25T23:00:00Z");

  it("today uses the reporting timezone", () => {
    const r = resolveRange({ range: "today" }, now, "Australia/Sydney");
    expect(r.start?.toISOString()).toBe("2026-09-25T14:00:00.000Z");
    expect(r.end?.toISOString()).toBe("2026-09-26T14:00:00.000Z");
  });

  it("this month rolls over the year", () => {
    const r = resolveRange({ range: "this_month" }, new Date("2026-12-15T00:00:00Z"), "Australia/Sydney");
    expect(r.start?.toISOString()).toBe("2026-11-30T13:00:00.000Z");
    expect(r.end?.toISOString()).toBe("2026-12-31T13:00:00.000Z");
  });

  it("custom range includes the whole end day", () => {
    const r = resolveRange({ range: "custom", from: "2026-09-01", to: "2026-09-30" }, now, "Australia/Sydney");
    expect(r.start?.toISOString()).toBe("2026-08-31T14:00:00.000Z");
    expect(r.end?.toISOString()).toBe("2026-09-30T14:00:00.000Z");
  });

  it("defaults to all time for unknown presets", () => {
    expect(resolveRange({ range: "nope" }, now)).toMatchObject({ preset: "all", start: null, end: null });
  });
});
