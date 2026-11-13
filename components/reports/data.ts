"use client";

import { useEffect, useMemo, useState } from "react";
import { PROPERTY } from "@/lib/config";
import { EffEntry, applyLedger, getActiveYear, hasMonthData, loadMonth, loadPayments } from "@/lib/store";
import { SYNC_EVENT } from "@/lib/cloud";
import { MonthFacts, monthFacts } from "@/lib/reportData";
import type { Payment } from "@/lib/ledger";
import { Expense } from "@/lib/expenses";
import { loadExpenses } from "@/lib/expensesStore";

export interface ReportData {
  year: number;
  current: number; // the month "now" means for this year
  rows: (EffEntry[] | null)[]; // 12 months, null when not opened
  payments: Payment[];
  expenses: Expense[];
  facts: MonthFacts[];
  reload: () => void;
}

/** Everything the report tabs need, read once and refreshed when a sync lands. */
export function useReportData(): ReportData | null {
  const [year, setYear] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setYear(getActiveYear());
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(SYNC_EVENT, bump);
    return () => window.removeEventListener(SYNC_EVENT, bump);
  }, []);

  return useMemo(() => {
    if (year === null) return null;
    const payments = loadPayments(year);
    const rows = Array.from({ length: 12 }, (_, m) => (hasMonthData(m, year) ? applyLedger(loadMonth(m, year), payments, year, m) : null));
    const facts = rows.map((r, m) => monthFacts(r, payments, year, m, PROPERTY.dueDay));
    const now = new Date();
    const current = now.getFullYear() === year ? now.getMonth() : now.getFullYear() > year ? 11 : 0;
    return { year, current, rows, payments, expenses: loadExpenses(year), facts, reload: () => setTick((t) => t + 1) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, tick]);
}

export type PeriodKind = "month" | "quarter" | "ytd" | "custom";
export interface Period { kind: PeriodKind; from: number; to: number }

export function periodMonths(p: Period): number[] {
  const out: number[] = [];
  for (let m = Math.max(0, p.from); m <= Math.min(11, p.to); m++) out.push(m);
  return out;
}

/** The same length of time just before, inside the same year, or null if there is none. */
export function previousPeriod(p: Period): Period | null {
  const len = p.to - p.from + 1;
  if (p.from - len < 0) return null;
  return { kind: p.kind, from: p.from - len, to: p.from - 1 };
}

export function makePeriod(kind: PeriodKind, anchor: number, from = anchor, to = anchor): Period {
  if (kind === "month") return { kind, from: anchor, to: anchor };
  if (kind === "quarter") { const q = Math.floor(anchor / 3) * 3; return { kind, from: q, to: q + 2 }; }
  if (kind === "ytd") return { kind, from: 0, to: anchor };
  return { kind, from: Math.min(from, to), to: Math.max(from, to) };
}
