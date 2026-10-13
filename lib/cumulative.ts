import { FLOORS, unitsForFloor } from "./config";
import { EffEntry, loadMonthEffective, hasMonthData, getActiveYear } from "./store";
import { UnitStatus, unitState } from "./status";

/**
 * Cumulative view: what each unit has been charged and has paid across the
 * opened months of a year. Months themselves stand alone; this is the one
 * place where they are added together.
 */

export interface MonthCell {
  month: number; // 0-11
  opened: boolean;
  due: number;
  paid: number;
  balance: number;
  status: UnitStatus;
}

export interface UnitCumulative {
  floor: number;
  unit: string;
  merged: boolean;
  tenant: string;
  billed: number; // total charged over the opened months
  paid: number;
  balance: number; // billed - paid (negative = ahead)
  monthsOwing: number; // opened months in which this unit still owes
  cells: MonthCell[]; // always 12, so months line up across units
}

export interface CumulativeTotals {
  billed: number;
  paid: number;
  outstanding: number; // building total, net of any overpayments
  rate: number; // paid / billed, 0-100
  unitsOwing: number; // units whose cumulative balance is above zero
  monthsOpened: number;
}

export interface CumulativePoint {
  month: number;
  billed: number; // running totals up to and including this month
  paid: number;
  opened: boolean;
}

export interface Cumulative {
  units: UnitCumulative[];
  totals: CumulativeTotals;
  series: CumulativePoint[];
}

/**
 * Build the cumulative view from twelve month slots (null = month not opened),
 * counting months 0..through inclusive. Pure, so it can be tested without a browser.
 */
export function buildCumulative(months: (EffEntry[] | null)[], through: number): Cumulative {
  const last = Math.max(0, Math.min(11, through));
  const units: UnitCumulative[] = [];

  for (const f of FLOORS) {
    for (const def of unitsForFloor(f)) {
      let tenant = "";
      let billed = 0, paid = 0, monthsOwing = 0;
      const cells: MonthCell[] = [];
      for (let m = 0; m < 12; m++) {
        const rows = m <= last ? months[m] : null;
        const e = rows?.find((r) => r.floor === f && r.unit === def.label);
        if (!rows || !e) {
          cells.push({ month: m, opened: false, due: 0, paid: 0, balance: 0, status: "none" });
          continue;
        }
        if (e.tenant) tenant = e.tenant;
        const st = unitState(e, true);
        billed += st.due;
        paid += st.paid;
        if (st.balance > 0) monthsOwing++;
        cells.push({ month: m, opened: true, due: st.due, paid: st.paid, balance: st.balance, status: st.status });
      }
      units.push({ floor: f, unit: def.label, merged: !!def.merged, tenant, billed, paid, balance: billed - paid, monthsOwing, cells });
    }
  }

  let billedAll = 0, paidAll = 0, monthsOpened = 0;
  const series: CumulativePoint[] = [];
  for (let m = 0; m < 12; m++) {
    const opened = m <= last && !!months[m];
    if (opened) {
      monthsOpened++;
      for (const u of units) {
        billedAll += u.cells[m].due;
        paidAll += u.cells[m].paid;
      }
    }
    series.push({ month: m, billed: billedAll, paid: paidAll, opened });
  }

  return {
    units,
    totals: {
      billed: billedAll,
      paid: paidAll,
      outstanding: billedAll - paidAll,
      rate: billedAll > 0 ? Math.round((paidAll / billedAll) * 100) : 100,
      unitsOwing: units.filter((u) => u.balance > 0).length,
      monthsOpened,
    },
    series,
  };
}

/** Read the active year's saved months and build the cumulative view. */
export function loadCumulative(through: number, year = getActiveYear()): Cumulative {
  const months = Array.from({ length: 12 }, (_, m) =>
    m <= through && hasMonthData(m, year) ? loadMonthEffective(m, year) : null
  );
  return buildCumulative(months, through);
}

/** What a unit still owed from the months before `month` (0 if none). */
export function earlierBalance(cum: Cumulative, floor: number, unit: string, month: number): number {
  const u = cum.units.find((x) => x.floor === floor && x.unit === unit);
  if (!u) return 0;
  return u.cells.filter((c) => c.opened && c.month < month).reduce((s, c) => s + c.balance, 0);
}
