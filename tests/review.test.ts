import { describe, it, expect } from "vitest";
import { installBrowserStub } from "./helpers";

installBrowserStub();

import { blankMonth, applyLedger } from "@/lib/store";
import type { Payment } from "@/lib/ledger";
import { computeReview } from "@/lib/review";

const pay = (floor: number, unit: string, amount: number, paidOn: string, over: Partial<Payment> = {}): Payment => ({
  id: `${floor}-${unit}-${paidOn}-${amount}`, year: 2026, month: 9, floor, unit, amount, receipt: "",
  source: "manual", paidOn, createdAt: "2026-10-01T00:00:00Z", ...over,
});

function setup(payments: Payment[], mutate?: (rows: ReturnType<typeof blankMonth>) => void) {
  const rows = blankMonth(9, 2026).map((r) => ({ ...r, tenant: `T ${r.floor}-${r.unit}` }));
  mutate?.(rows);
  return applyLedger(rows, payments, 2026, 9);
}

describe("computeReview", () => {
  it("totals what was due and collected, ignoring vacant units", () => {
    const eff = setup([pay(0, "Unit 1", 6500, "03/10/2026")], (rows) => { rows[1].vacant = true; });
    const r = computeReview(eff, [pay(0, "Unit 1", 6500, "03/10/2026")], 2026, 9, 5, null);
    expect(r.vacant).toBe(1);
    expect(r.occupied).toBe(33);
    expect(r.collected).toBe(6500);
    expect(r.due).toBe(eff.filter((e) => !e.vacant).reduce((s, e) => s + e.rent, 0));
    expect(r.clear).toBe(1);
    expect(r.outstanding).toBe(r.due - 6500);
  });

  it("ranks floors by collection rate", () => {
    const ps = [pay(2, "Unit 1", 6500, "02/10/2026"), pay(2, "Unit 2", 4800, "02/10/2026"), pay(0, "Unit 1", 100, "02/10/2026")];
    const r = computeReview(setup(ps), ps, 2026, 9, 5, null);
    expect(r.bestFloor?.floor).toBe(2);
    expect(r.floors[0].rate).toBeGreaterThan(r.floors[1].rate);
    expect(r.floors).toHaveLength(5);
  });

  it("counts on-time payers by the date of their last payment", () => {
    const ps = [
      pay(1, "Unit 2", 4800, "05/10/2026"),                     // on the due day: on time
      pay(1, "Unit 3", 4800, "06/10/2026"),                     // a day late
      pay(1, "Unit 4", 2000, "02/10/2026"), pay(1, "Unit 4", 2800, "09/10/2026"), // finished late
      pay(1, "Unit 6", 4800, "28/09/2026"),                     // paid early
    ];
    const r = computeReview(setup(ps), ps, 2026, 9, 5, null);
    expect(r.onTime).toEqual({ count: 2, names: ["T 1-Unit 2", "T 1-Unit 6"] });
  });

  it("does not credit a reversed payment as on time, and says nothing when there are no dates", () => {
    const original = pay(1, "Unit 2", 4800, "03/10/2026", { id: "a" });
    const reversal = pay(1, "Unit 2", -4800, "04/10/2026", { id: "b", source: "reversal", reverses: "a" });
    const r = computeReview(setup([original, reversal]), [original, reversal], 2026, 9, 5, null);
    expect(r.onTime).toBeNull();
    expect(r.collected).toBe(0);
  });

  it("lists the three largest balances and the change in rate", () => {
    const ps = [pay(0, "Unit 1", 6500, "03/10/2026")];
    const r = computeReview(setup(ps), ps, 2026, 9, 5, 10);
    expect(r.topOwing).toHaveLength(3);
    expect(r.topOwing[0].balance).toBe(7500);
    expect(r.rateChange).toBe(r.rate - 10);
    expect(computeReview(setup(ps), ps, 2026, 9, 5, null).rateChange).toBeNull();
  });
});
