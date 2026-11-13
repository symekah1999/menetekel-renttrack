import { describe, it, expect } from "vitest";
import { Expense, canReverseExpense, expenseFromRow, expenseReversal, expenseToRow, expenseTotals, mergeExpenses } from "@/lib/expenses";

const ex = (id: string, over: Partial<Expense> = {}): Expense => ({
  id, year: 2026, month: 9, date: "03/10/2026", category: "repairs", amount: 5000, createdAt: "2026-10-03T00:00:00Z", ...over,
});

describe("expenses", () => {
  it("totals by category for chosen months, netting reversals", () => {
    const a = ex("a"), b = ex("b", { category: "staff", amount: 8000 }), c = ex("c", { month: 8, amount: 999 });
    const r = expenseReversal(a, "r");
    const t = expenseTotals([a, b, c, r], [9]);
    expect(t.total).toBe(8000);
    expect(t.byCategory.repairs).toBe(0);
    expect(t.byCategory.staff).toBe(8000);
    expect(expenseTotals([a, b, c]).total).toBe(13_999);
  });
  it("allows one reversal of a real entry only", () => {
    const a = ex("a"); const r = expenseReversal(a, "r");
    expect(canReverseExpense(a, [a])).toBe(true);
    expect(canReverseExpense(a, [a, r])).toBe(false);
    expect(canReverseExpense(r, [a, r])).toBe(false);
  });
  it("round-trips through the database shape and merges like the ledger", () => {
    const a = ex("a", { note: "Gate hinge" });
    expect(expenseFromRow(expenseToRow(a))).toMatchObject({ id: "a", amount: 5000, note: "Gate hinge", category: "repairs", synced: true });
    const merged = mergeExpenses([ex("x", { synced: false }), ex("a", { amount: 1, synced: true })], [a]);
    expect(merged.map((e) => e.id).sort()).toEqual(["a", "x"]);
    expect(merged.find((e) => e.id === "a")!.amount).toBe(5000);
  });
});
