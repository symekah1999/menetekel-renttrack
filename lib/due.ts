export type DueKind = "upcoming" | "today" | "overdue" | "past" | "future";

export interface DueState {
  kind: DueKind;
  days: number; // days until (upcoming) or since (overdue) the due day
  label: string;
}

/** Where the month being viewed stands against its due day, in Nairobi time. */
export function dueState(year: number, month: number, dueDay: number, now: Date = new Date()): DueState {
  const eat = new Date(now.getTime() + 3 * 3600_000);
  const y = eat.getUTCFullYear(), m = eat.getUTCMonth(), d = eat.getUTCDate();
  if (year < y || (year === y && month < m)) return { kind: "past", days: 0, label: "Month closed" };
  if (year > y || (year === y && month > m)) return { kind: "future", days: 0, label: `Due on the ${dueDay}th` };
  if (d < dueDay) {
    const n = dueDay - d;
    return { kind: "upcoming", days: n, label: n === 1 ? "Rent due tomorrow" : `Rent due in ${n} days` };
  }
  if (d === dueDay) return { kind: "today", days: 0, label: "Rent due today" };
  const n = d - dueDay;
  return { kind: "overdue", days: n, label: n === 1 ? "1 day past the due date" : `${n} days past the due date` };
}
