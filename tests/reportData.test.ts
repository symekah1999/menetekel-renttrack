import { describe, it, expect } from "vitest";
import { installBrowserStub } from "./helpers";
installBrowserStub();
import { blankMonth, applyLedger } from "@/lib/store";
import type { Payment } from "@/lib/ledger";
import { monthFacts, periodFacts, change, parseDmy } from "@/lib/reportData";

const pay = (floor: number, unit: string, amount: number, paidOn: string, over: Partial<Payment> = {}): Payment => ({
  id: `${floor}-${unit}-${paidOn}-${amount}-${Math.random()}`, year: 2026, month: 9, floor, unit, amount, receipt: "R1",
  source: "stk", paidOn, createdAt: "2026-10-01T00:00:00Z", ...over,
});

// October 2026: Floor 1 Unit 2 (4,800) and Unit 3 (4,800) with water; Floor 1 Unit 5 vacant (7,500).
function october(payments: Payment[], tweak?: (r: ReturnType<typeof blankMonth>) => void) {
  const rows = blankMonth(9, 2026).map((r) => {
    if (r.floor === 1 && r.unit === "Unit 2") return { ...r, water: 400 };
    if (r.floor === 1 && r.unit === "Unit 5") return { ...r, vacant: true };
    return r;
  });
  tweak?.(rows);
  return applyLedger(rows, payments, 2026, 9);
}

describe("monthFacts", () => {
  it("charges only occupied units and counts the rent of empty ones as vacancy loss", () => {
    const f = monthFacts(october([]), [], 2026, 9, 5);
    expect(f.vacant).toBe(1);
    expect(f.occupied).toBe(33);
    expect(f.vacancyLoss).toBe(7500);
    expect(f.waterCharged).toBe(400);
    expect(f.charged).toBe(f.rentCharged + f.waterCharged);
    expect(f.outstanding).toBe(f.charged);
    expect(f.owing).toBe(33);
  });

  it("splits money by channel and nets reversals out", () => {
    const a = pay(1, "Unit 2", 2000, "03/10/2026", { id: "a" });
    const b = pay(1, "Unit 3", 4800, "04/10/2026", { id: "b", source: "manual" });
    const c = pay(1, "Unit 3", 4800, "04/10/2026", { id: "c", source: "csv" });
    const r = pay(1, "Unit 3", -4800, "05/10/2026", { id: "r", source: "reversal", reverses: "c" });
    const ps = [a, b, c, r];
    const f = monthFacts(october(ps), ps, 2026, 9, 5);
    expect(f.channels).toMatchObject({ stk: 2000, manual: 4800, csv: 0, reversals: 4800, reversalCount: 1 });
    expect(f.collected).toBe(6800);
  });

  it("times collections against the due day, the 10th and month end", () => {
    const ps = [
      pay(1, "Unit 3", 4800, "02/10/2026"),                   // cleared on the 2nd
      pay(1, "Unit 2", 3000, "05/10/2026"), pay(1, "Unit 2", 2200, "12/10/2026"), // cleared on the 12th
      pay(1, "Unit 4", 1000, "28/09/2026"), pay(1, "Unit 4", 3800, "08/10/2026"), // paid early, cleared on the 8th
      pay(1, "Unit 6", 500, "03/11/2026"),                    // paid after the month ended
    ];
    const f = monthFacts(october(ps), ps, 2026, 9, 5);
    expect(f.timing.byDue).toBe(4800 + 3000 + 1000);
    expect(f.timing.by10).toBe(4800 + 3000 + 1000 + 3800);
    expect(f.timing.byEnd).toBe(4800 + 5200 + 4800);
    expect(f.timing.dated).toBe(4800 + 5200 + 4800 + 500);
    expect(f.timing.clearedWithDates).toBe(3);
    expect(f.timing.clearDayMedian).toBe(8);
    expect(f.timing.onTime).toBe(1);
  });

  it("leaves units paid before the ledger out of timing, but counts their money", () => {
    const f = monthFacts(october([], (rows) => {
      const i = rows.findIndex((r) => r.floor === 1 && r.unit === "Unit 3"); rows[i] = { ...rows[i], paid: 4800 };
    }), [], 2026, 9, 5);
    expect(f.collected).toBe(4800);
    expect(f.channels.earlier).toBe(4800);
    expect(f.timing.clearedWithDates).toBe(0);
    expect(f.timing.clearDayMedian).toBeNull();
  });

  it("treats rent as paid before water when estimating rent received", () => {
    const ps = [pay(1, "Unit 2", 5000, "02/10/2026")]; // rent 4,800 + water 400 due
    const f = monthFacts(october(ps), ps, 2026, 9, 5);
    expect(f.rentReceived).toBe(4800);
    expect(f.collected).toBe(5000);
  });

  it("lists every unit for the statement, with receipts and the last payment date", () => {
    const ps = [pay(1, "Unit 2", 1000, "02/10/2026", { receipt: "AAA" }), pay(1, "Unit 2", 2000, "09/10/2026", { receipt: "BBB" })];
    const f = monthFacts(october(ps), ps, 2026, 9, 5);
    expect(f.units).toHaveLength(34);
    const u = f.units.find((x) => x.floor === 1 && x.unit === "Unit 2")!;
    expect(u).toMatchObject({ due: 5200, paid: 3000, balance: 2200, status: "part", receipts: ["AAA", "BBB"], lastPaid: "09/10/2026" });
    expect(f.units.find((x) => x.floor === 1 && x.unit === "Unit 5")!.status).toBe("vacant");
  });

  it("reports an unopened month as empty", () => {
    expect(monthFacts(null, [], 2026, 9, 5)).toMatchObject({ opened: false, charged: 0, units: [] });
  });
});

describe("periodFacts", () => {
  it("adds months together and skips unopened ones", () => {
    const ps = [pay(1, "Unit 3", 4800, "02/10/2026")];
    const oct = monthFacts(october(ps), ps, 2026, 9, 5);
    const sep = monthFacts(october([]), [], 2026, 8, 5);
    const nov = monthFacts(null, [], 2026, 10, 5);
    const p = periodFacts([sep, oct, nov]);
    expect(p.openedMonths).toBe(2);
    expect(p.charged).toBe(sep.charged + oct.charged);
    expect(p.collected).toBe(4800);
    expect(p.vacancyLoss).toBe(15000);
    expect(p.occupancy).toBe(97);
    expect(p.rate).toBe(Math.round((4800 / p.charged) * 100));
  });
});

describe("change and dates", () => {
  it("reports direction and size", () => {
    expect(change(10, 4)).toEqual({ diff: 6, dir: "up" });
    expect(change(4, 10)).toEqual({ diff: -6, dir: "down" });
    expect(change(4, 4)?.dir).toBe("same");
    expect(change(4, null)).toBeNull();
  });
  it("reads dd/mm/yyyy", () => {
    expect(parseDmy("05/10/2026")).toEqual({ d: 5, m: 9, y: 2026 });
    expect(parseDmy("2026-10-05")).toBeNull();
  });
});
