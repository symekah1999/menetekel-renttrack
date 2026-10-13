import { describe, it, expect } from "vitest";
import { buildCumulative, earlierBalance } from "@/lib/cumulative";
import { FLOORS, unitsForFloor } from "@/lib/config";
import type { EffEntry } from "@/lib/store";

/** A full month where every unit is charged its rent and has paid `paidFn(unit)`. */
function month(paidFn: (floor: number, unit: string, rent: number) => number, water = 0): EffEntry[] {
  const rows: EffEntry[] = [];
  for (const f of FLOORS) {
    for (const u of unitsForFloor(f)) {
      const paid = paidFn(f, u.label, u.rent + water);
      rows.push({
        floor: f, unit: u.label, rent: u.rent, merged: !!u.merged, tenant: `T-${f}-${u.label}`, phone: "",
        water, paid, manualPaid: paid, ledgerPaid: 0, date: "", receipt: "", vacant: false,
      });
    }
  }
  return rows;
}

const all = (f: number, u: string, due: number) => due;      // everyone pays in full
const none = () => 0;                                          // nobody pays

describe("buildCumulative", () => {
  it("adds up only the months that were opened", () => {
    const months = Array(12).fill(null);
    months[0] = month(all);
    months[1] = month(none);
    const c = buildCumulative(months, 5);
    expect(c.totals.monthsOpened).toBe(2);
    expect(c.totals.billed).toBe(2 * 194_700);
    expect(c.totals.paid).toBe(194_700);
    expect(c.totals.outstanding).toBe(194_700);
    expect(c.totals.rate).toBe(50);
    expect(c.totals.unitsOwing).toBe(34);
  });

  it("keeps months independent: a short month is owed in that month only", () => {
    const months = Array(12).fill(null);
    months[0] = month((f, u, due) => (f === 1 && u === "Unit 2" ? due - 1000 : due));
    months[1] = month(all);
    const c = buildCumulative(months, 1);
    const u = c.units.find((x) => x.floor === 1 && x.unit === "Unit 2")!;
    expect(u.cells[0].balance).toBe(1000);
    expect(u.cells[1].balance).toBe(0);      // February is not charged January's shortfall
    expect(u.cells[1].due).toBe(4800);
    expect(u.balance).toBe(1000);            // but the cumulative total remembers it
    expect(u.monthsOwing).toBe(1);
  });

  it("nets an overpayment against a later shortfall in the cumulative balance", () => {
    const months = Array(12).fill(null);
    months[0] = month((f, u, due) => (f === 0 && u === "Unit 1" ? due + 2000 : due));
    months[1] = month((f, u, due) => (f === 0 && u === "Unit 1" ? due - 1500 : due));
    const u = buildCumulative(months, 1).units.find((x) => x.floor === 0 && x.unit === "Unit 1")!;
    expect(u.cells[0].balance).toBe(-2000);
    expect(u.cells[1].balance).toBe(1500);
    expect(u.balance).toBe(-500);
  });

  it("ignores months after the chosen cut-off", () => {
    const months = Array(12).fill(null);
    months[0] = month(all);
    months[3] = month(none);
    const c = buildCumulative(months, 2);
    expect(c.totals.monthsOpened).toBe(1);
    expect(c.totals.outstanding).toBe(0);
  });

  it("builds a running series that only grows", () => {
    const months = Array(12).fill(null);
    months[0] = month(all);
    months[1] = month(none);
    const s = buildCumulative(months, 2).series;
    expect(s[0]).toMatchObject({ billed: 194_700, paid: 194_700, opened: true });
    expect(s[1]).toMatchObject({ billed: 389_400, paid: 194_700 });
    expect(s[2]).toMatchObject({ billed: 389_400, opened: false });
  });

  it("carries the latest tenant name and always returns 12 cells per unit", () => {
    const months = Array(12).fill(null);
    months[0] = month(all);
    const c = buildCumulative(months, 0);
    expect(c.units).toHaveLength(34);
    expect(c.units.every((u) => u.cells.length === 12)).toBe(true);
    expect(c.units[0].tenant).toBe("T-0-Unit 1");
  });

  it("reports a clean state when nothing is opened", () => {
    const c = buildCumulative(Array(12).fill(null), 11);
    expect(c.totals).toMatchObject({ billed: 0, paid: 0, outstanding: 0, rate: 100, unitsOwing: 0, monthsOpened: 0 });
  });
});

describe("earlierBalance", () => {
  it("is what the unit owed before the given month", () => {
    const months = Array(12).fill(null);
    months[0] = month((f, u, due) => (u === "Unit 3" && f === 2 ? due - 700 : due));
    months[1] = month((f, u, due) => (u === "Unit 3" && f === 2 ? due - 300 : due));
    const c = buildCumulative(months, 1);
    expect(earlierBalance(c, 2, "Unit 3", 1)).toBe(700);
    expect(earlierBalance(c, 2, "Unit 3", 0)).toBe(0);
    expect(earlierBalance(c, 2, "Unit 3", 2)).toBe(1000);
  });
});
