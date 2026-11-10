import type { EffEntry } from "./store";
import { unitState } from "./status";

/** Collected and rate for the occupied units of one month. */
export function totalOf(rows: EffEntry[]): { due: number; collected: number; rate: number } {
  let due = 0, collected = 0;
  for (const e of rows) {
    if (e.vacant) continue;
    const s = unitState(e, true);
    due += s.due;
    collected += s.paid;
  }
  return { due, collected, rate: due > 0 ? Math.round((collected / due) * 100) : 100 };
}
