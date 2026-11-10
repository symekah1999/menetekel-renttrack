import { FLOORS } from "./config";
import type { EffEntry } from "./store";
import type { Payment } from "./ledger";
import { reversedIds } from "./ledger";
import { unitState } from "./status";

export interface FloorScore { floor: number; due: number; paid: number; rate: number }
export interface OwingUnit { floor: number; unit: string; tenant: string; balance: number }

export interface MonthReview {
  due: number;
  collected: number;
  rate: number; // 0-100
  occupied: number;
  vacant: number;
  clear: number; // occupied units with nothing left to pay
  floors: FloorScore[]; // best first
  bestFloor: FloorScore | null;
  /** Units paid in full with their last payment on or before the due day. Null when the ledger has no dates to judge by. */
  onTime: { count: number; names: string[] } | null;
  outstanding: number;
  topOwing: OwingUnit[];
  /** Percentage-point change in collection rate from the month before, or null if there is nothing to compare. */
  rateChange: number | null;
}

/** dd/mm/yyyy -> sortable number, or null. */
function dateKey(s: string): number | null {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? +m[3] * 10000 + +m[2] * 100 + +m[1] : null;
}

/** Everything the month-in-review slides show. Pure, so the sums can be tested. */
export function computeReview(
  rows: EffEntry[],
  payments: Payment[],
  year: number,
  month: number,
  dueDay: number,
  previousRate: number | null
): MonthReview {
  const states = rows.map((e) => ({ e, s: unitState(e, true) }));
  let due = 0, collected = 0, occupied = 0, vacant = 0, clear = 0;
  for (const { e, s } of states) {
    if (e.vacant) { vacant++; continue; }
    occupied++;
    due += s.due;
    collected += s.paid;
    if (s.status === "paid") clear++;
  }
  const rate = due > 0 ? Math.round((collected / due) * 100) : 100;

  const floors: FloorScore[] = FLOORS.map((f) => {
    let d = 0, p = 0;
    for (const { e, s } of states) if (e.floor === f && !e.vacant) { d += s.due; p += s.paid; }
    return { floor: f, due: d, paid: p, rate: d > 0 ? Math.round((p / d) * 100) : 100 };
  }).filter((f) => f.due > 0).sort((a, b) => b.rate - a.rate || b.paid - a.paid);

  // On time = fully paid, and the last payment landed by the due day of this month.
  const mine = payments.filter((p) => p.year === year && p.month === month);
  const reversed = reversedIds(mine);
  const deadline = year * 10000 + (month + 1) * 100 + dueDay;
  let judged = false;
  const names: string[] = [];
  for (const { e, s } of states) {
    if (e.vacant || s.status !== "paid" || s.due <= 0) continue;
    const dates = mine
      .filter((p) => p.floor === e.floor && p.unit === e.unit && p.source !== "reversal" && !reversed.has(p.id))
      .map((p) => dateKey(p.paidOn))
      .filter((k): k is number => k !== null);
    if (dates.length === 0) continue;
    judged = true;
    if (Math.max(...dates) <= deadline) names.push(e.tenant || `Floor ${e.floor}, ${e.unit}`);
  }

  const topOwing = states
    .filter(({ e, s }) => !e.vacant && s.balance > 0)
    .sort((a, b) => b.s.balance - a.s.balance)
    .map(({ e, s }) => ({ floor: e.floor, unit: e.unit, tenant: e.tenant, balance: s.balance }));

  return {
    due, collected, rate, occupied, vacant, clear,
    floors, bestFloor: floors[0] ?? null,
    onTime: judged ? { count: names.length, names } : null,
    outstanding: topOwing.reduce((sum, u) => sum + u.balance, 0),
    topOwing: topOwing.slice(0, 3),
    rateChange: previousRate === null ? null : rate - previousRate,
  };
}
