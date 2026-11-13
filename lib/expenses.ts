/**
 * Building expenses: repairs, utilities, staff and so on. Like the payments
 * ledger it is append-only: a mistake is cancelled by a reversal row, so the
 * owner can always see what was spent and what was corrected.
 */
export type ExpenseCategory = "repairs" | "utilities" | "staff" | "security" | "cleaning" | "supplies" | "other";

export const CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  repairs: "Repairs and maintenance",
  utilities: "Water and electricity",
  staff: "Caretaker and staff",
  security: "Security",
  cleaning: "Cleaning and garbage",
  supplies: "Supplies",
  other: "Other",
};

export interface Expense {
  id: string;
  year: number;
  month: number;
  date: string; // dd/mm/yyyy
  category: ExpenseCategory;
  amount: number; // negative for a reversal
  note?: string;
  reverses?: string;
  createdAt: string;
  createdBy?: string;
  synced?: boolean;
}

export function reversedExpenseIds(list: Expense[]): Set<string> {
  return new Set(list.filter((e) => e.reverses).map((e) => e.reverses!));
}

export function canReverseExpense(e: Expense, list: Expense[]): boolean {
  return e.amount > 0 && !e.reverses && !reversedExpenseIds(list).has(e.id);
}

export function expenseReversal(e: Expense, id: string, now: Date = new Date()): Expense {
  return {
    id, year: e.year, month: e.month, date: e.date, category: e.category, amount: -e.amount,
    note: `Reversal of ${CATEGORY_LABEL[e.category].toLowerCase()} entry`, reverses: e.id,
    createdAt: now.toISOString(), synced: false,
  };
}

/** Totals for the given months (all months if none given), by category. */
export function expenseTotals(list: Expense[], months?: number[]): { total: number; byCategory: Record<ExpenseCategory, number> } {
  const byCategory = Object.fromEntries(Object.keys(CATEGORY_LABEL).map((k) => [k, 0])) as Record<ExpenseCategory, number>;
  let total = 0;
  for (const e of list) {
    if (months && !months.includes(e.month)) continue;
    byCategory[e.category] += e.amount;
    total += e.amount;
  }
  return { total, byCategory };
}

export function expenseFromRow(r: Record<string, unknown>): Expense {
  return {
    id: String(r.id), year: Number(r.year), month: Number(r.month), date: String(r.spent_on ?? ""),
    category: (String(r.category) in CATEGORY_LABEL ? r.category : "other") as ExpenseCategory,
    amount: Number(r.amount), note: r.note ? String(r.note) : undefined,
    reverses: r.reverses ? String(r.reverses) : undefined,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    createdBy: r.created_by ? String(r.created_by) : undefined, synced: true,
  };
}

export function expenseToRow(e: Expense): Record<string, unknown> {
  return {
    id: e.id, year: e.year, month: e.month, spent_on: e.date, category: e.category, amount: e.amount,
    note: e.note ?? null, reverses: e.reverses ?? null, created_at: e.createdAt, created_by: e.createdBy ?? null,
  };
}

export function mergeExpenses(local: Expense[], remote: Expense[]): Expense[] {
  const byId = new Map<string, Expense>();
  for (const e of remote) byId.set(e.id, { ...e, synced: true });
  for (const e of local) if (!byId.has(e.id) && e.synced === false) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
