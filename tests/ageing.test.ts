import { describe, it, expect } from "vitest";
import { ageDebts } from "@/lib/ageing";

const asOf = new Date("2026-11-10T00:00:00Z"); // due day is the 5th

describe("ageDebts", () => {
  it("puts each month's debt in the bucket for its age", () => {
    const b = ageDebts([
      { month: 10, balance: 1000 }, // Nov: 5 days -> up to 30
      { month: 9, balance: 2000 },  // Oct: 36 days -> 31-60
      { month: 8, balance: 3000 },  // Sep: 66 days -> 61-90
      { month: 6, balance: 4000 },  // Jul: 128 days -> over 90
    ], 2026, 5, asOf);
    expect(b).toEqual([1000, 2000, 3000, 4000]);
  });
  it("uses an overpayment to clear the oldest debt first", () => {
    const b = ageDebts([{ month: 6, balance: 4000 }, { month: 8, balance: 3000 }, { month: 9, balance: -5000 }], 2026, 5, asOf);
    expect(b).toEqual([0, 0, 2000, 0]);
  });
  it("carries unused credit forward to later debts", () => {
    const b = ageDebts([{ month: 8, balance: -1500 }, { month: 9, balance: 2000 }], 2026, 5, asOf);
    expect(b).toEqual([0, 500, 0, 0]);
  });
  it("is empty when nothing is owed", () => {
    expect(ageDebts([{ month: 9, balance: 0 }, { month: 10, balance: -100 }], 2026, 5, asOf)).toEqual([0, 0, 0, 0]);
  });
});
