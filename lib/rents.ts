import { FLOORS, unitsForFloor } from "./config";
import { Entry, MonthData, hasMonthData, loadMonth, saveMonth } from "./store";

/** "floor|unit" -> monthly rent in KSh. */
export type RentMap = Record<string, number>;

export const rentKey = (floor: number, unit: string) => `${floor}|${unit}`;

/** The rents the building started with (lib/config.ts). */
export function defaultRents(): RentMap {
  const m: RentMap = {};
  for (const f of FLOORS) for (const u of unitsForFloor(f)) m[rentKey(f, u.label)] = u.rent;
  return m;
}

/**
 * The rents in force at (year, month): taken from the latest saved month up to
 * and including it, or from the building defaults if nothing is saved yet.
 */
export function currentRents(year: number, month: number): RentMap {
  const base = defaultRents();
  for (let m = month; m >= 0; m--) {
    if (hasMonthData(m, year)) {
      for (const e of loadMonth(m, year)) {
        const k = rentKey(e.floor, e.unit);
        if (k in base) base[k] = e.rent;
      }
      return base;
    }
  }
  return base;
}

export function totalRent(r: RentMap): number {
  return Object.values(r).reduce((s, n) => s + n, 0);
}

/** Pure: set rents on a month's rows. Only rows whose rent really changes are touched. */
export function applyRentChanges(
  rows: MonthData,
  next: RentMap,
  now: number = Date.now()
): { rows: MonthData; changed: number } {
  let changed = 0;
  const out = rows.map((r): Entry => {
    const n = next[rentKey(r.floor, r.unit)];
    if (n === undefined || n === r.rent) return r;
    changed++;
    return { ...r, rent: n, ts: now };
  });
  return { rows: out, changed };
}

/**
 * Change rents from `fromMonth` onward. Months already saved from that month
 * on are updated; earlier months keep their old rents (and so do the
 * payments recorded against them). Months opened later copy the rents from
 * the month before, so the change carries forward on its own.
 */
export function setRentsFrom(
  year: number,
  fromMonth: number,
  next: RentMap
): { monthsUpdated: number; unitsChanged: number } {
  let monthsUpdated = 0;
  const units = new Set<string>();
  for (let m = fromMonth; m <= 11; m++) {
    if (!hasMonthData(m, year)) continue;
    const before = loadMonth(m, year);
    const { rows, changed } = applyRentChanges(before, next);
    if (changed === 0) continue;
    saveMonth(m, rows, year);
    monthsUpdated++;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] !== before[i]) units.add(rentKey(rows[i].floor, rows[i].unit));
    }
  }
  return { monthsUpdated, unitsChanged: units.size };
}
