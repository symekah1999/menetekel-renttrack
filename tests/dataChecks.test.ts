import { describe, it, expect } from "vitest";
import { installBrowserStub } from "./helpers";
installBrowserStub();
import { blankMonth, applyLedger } from "@/lib/store";
import type { Payment } from "@/lib/ledger";
import { runChecks } from "@/lib/dataChecks";

const pay = (id: string, over: Partial<Payment> = {}): Payment => ({
  id, year: 2026, month: 9, floor: 1, unit: "Unit 2", amount: 4800, receipt: "R", source: "stk",
  paidOn: "03/10/2026", createdAt: "2026-10-03T00:00:00Z", ...over,
});
const filled = (m: number) => blankMonth(m, 2026).map((r) => ({ ...r, tenant: "T", phone: "0700000000" }));

describe("runChecks", () => {
  it("flags months skipped between the first opened month and now", () => {
    const months = Array(12).fill(null);
    months[7] = applyLedger(filled(7), [], 2026, 7);
    months[9] = applyLedger(filled(9), [], 2026, 9);
    const ids = runChecks(2026, months, [], 9).map((i) => i.id);
    expect(ids).toContain("gap-8");
    expect(ids).not.toContain("gap-7");
  });
  it("flags likely duplicates and M-Pesa payments with no receipt, but not reversed ones", () => {
    const ps = [pay("a"), pay("b"), pay("c", { unit: "Unit 3", receipt: "" }), pay("d", { unit: "Unit 4" }), pay("e", { unit: "Unit 4" }), pay("r", { unit: "Unit 4", amount: -4800, source: "reversal", reverses: "e" })];
    const months = Array(12).fill(null); months[9] = applyLedger(filled(9), ps, 2026, 9);
    const ids = runChecks(2026, months, ps, 9).map((i) => i.id);
    expect(ids).toContain("dup-b");
    expect(ids).toContain("rcpt-c");
    expect(ids).not.toContain("dup-e");
  });
  it("flags missing names and phones, overpayments and money on vacant units, worst first", () => {
    const rows = filled(9);
    const at = (u: string) => rows.findIndex((r) => r.floor === 2 && r.unit === u);
    rows[at("Unit 1")] = { ...rows[at("Unit 1")], tenant: "" };
    rows[at("Unit 2")] = { ...rows[at("Unit 2")], phone: "" };
    rows[at("Unit 3")] = { ...rows[at("Unit 3")], paid: 9999 };
    rows[at("Unit 4")] = { ...rows[at("Unit 4")], vacant: true, paid: 100 };
    const months = Array(12).fill(null); months[9] = applyLedger(rows, [], 2026, 9);
    const issues = runChecks(2026, months, [], 9);
    const ids = issues.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["name-2-Unit 1", "phone-2-Unit 2", "over-2-Unit 3", "vacpaid-2-Unit 4"]));
    const order = issues.map((i) => i.severity);
    expect(order).toEqual([...order].sort((a, b) => ["high", "medium", "low"].indexOf(a) - ["high", "medium", "low"].indexOf(b)));
  });
});
