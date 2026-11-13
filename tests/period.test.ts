import { describe, it, expect } from "vitest";
import { makePeriod, periodMonths, previousPeriod } from "@/components/reports/data";

describe("report periods", () => {
  it("builds month, quarter, year-to-date and custom ranges", () => {
    expect(makePeriod("month", 9)).toEqual({ kind: "month", from: 9, to: 9 });
    expect(makePeriod("quarter", 10)).toEqual({ kind: "quarter", from: 9, to: 11 });
    expect(makePeriod("ytd", 9)).toEqual({ kind: "ytd", from: 0, to: 9 });
    expect(makePeriod("custom", 0, 7, 3)).toEqual({ kind: "custom", from: 3, to: 7 });
    expect(periodMonths(makePeriod("quarter", 1))).toEqual([0, 1, 2]);
  });
  it("compares with the same length of time just before, within the year", () => {
    expect(previousPeriod(makePeriod("month", 9))).toEqual({ kind: "month", from: 8, to: 8 });
    expect(previousPeriod(makePeriod("quarter", 7))).toEqual({ kind: "quarter", from: 3, to: 5 });
    expect(previousPeriod(makePeriod("month", 0))).toBeNull();
    expect(previousPeriod(makePeriod("ytd", 9))).toBeNull();
  });
});
