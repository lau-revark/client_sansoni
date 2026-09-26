import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv(["a"], [['He said "hi", ok']])).toBe('a\r\n"He said ""hi"", ok"\r\n');
  });
  it("neutralises formula injection in text but not negative numbers", () => {
    expect(toCsv(["a", "b"], [["=HYPERLINK(1)", -500]])).toBe("a,b\r\n'=HYPERLINK(1),-500\r\n");
  });
});
