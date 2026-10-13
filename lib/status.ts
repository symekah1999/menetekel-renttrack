import { monthDue, EffEntry } from "./store";

export type UnitStatus = "paid" | "part" | "owe" | "vacant" | "none";

export interface UnitState {
  status: UnitStatus;
  due: number; // this month's rent and water
  paid: number;
  balance: number; // due - paid (negative = credit)
  /** 0-100: how full the unit's "window" is on the building view. */
  fill: number;
}

/**
 * One place that decides what colour a unit is. `billed` is false for months
 * nobody has opened yet, so they read as "not started" rather than "owing".
 */
export function unitState(e: EffEntry, billed: boolean): UnitState {
  const due = monthDue(e);
  const paid = e.paid;
  const balance = due - paid;
  if (!billed) return { status: "none", due, paid, balance, fill: 0 };
  if (e.vacant) return { status: "vacant", due: 0, paid, balance: 0 - paid, fill: 0 };
  if (balance <= 0) return { status: "paid", due, paid, balance, fill: 100 };
  if (paid > 0) {
    return { status: "part", due, paid, balance, fill: Math.max(8, Math.min(95, Math.round((paid / due) * 100))) };
  }
  return { status: "owe", due, paid, balance, fill: 0 };
}

export const STATUS_LABEL: Record<UnitStatus, string> = {
  paid: "Paid",
  part: "Part-paid",
  owe: "Owing",
  vacant: "Vacant",
  none: "Not started",
};

/** The short label shown on a unit tile: "Unit 6+7" becomes "6+7". */
export function shortUnit(label: string): string {
  return label.replace(/^Unit\s*/i, "");
}

/** Compact money for tiles: 4800 -> "4.8k". */
export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1000) return `${(n / 1000).toFixed(a % 1000 === 0 ? 0 : 1)}k`;
  return String(Math.round(n));
}
