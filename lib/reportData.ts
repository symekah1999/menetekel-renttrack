import { FLOORS } from "./config";
import type { EffEntry } from "./store";
import type { Payment } from "./ledger";
import { reversedIds } from "./ledger";
import { unitState, UnitStatus } from "./status";

/** One unit's line on the building statement. */
export interface UnitLine {
  floor: number;
  unit: string;
  tenant: string;
  rent: number;
  water: number;
  due: number;
  paid: number;
  balance: number;
  status: UnitStatus;
  receipts: string[];
  lastPaid: string; // dd/mm/yyyy, or ""
}

export interface Channels {
  stk: number;
  manual: number;
  csv: number;
  earlier: number; // typed into month records before the ledger existed
  reversals: number; // total taken back (positive number)
  reversalCount: number;
}

export interface Timing {
  /** Money for this month's rent received by the due day, the 10th and month end. */
  byDue: number;
  by10: number;
  byEnd: number;
  /** Money we could date. Undated money (entered before the ledger) is left out of timing. */
  dated: number;
  /** Day of the month on which the typical paid-up unit was cleared. */
  clearDayMedian: number | null;
  onTime: number; // units cleared by the due day
  clearedWithDates: number; // units whose clearing day is known
}

export interface MonthFacts {
  month: number;
  opened: boolean;
  charged: number; // rent + water for occupied units
  rentCharged: number;
  waterCharged: number;
  collected: number;
  rentReceived: number; // the rent share of what came in (rent is taken to be paid before water)
  outstanding: number; // sum of what occupied units still owe
  credit: number; // sum of overpayments
  rate: number; // 0-100
  occupied: number;
  vacant: number;
  vacancyLoss: number; // rent of units standing empty
  clear: number;
  part: number;
  owing: number;
  channels: Channels;
  timing: Timing;
  units: UnitLine[];
}

const EMPTY_CHANNELS: Channels = { stk: 0, manual: 0, csv: 0, earlier: 0, reversals: 0, reversalCount: 0 };
const EMPTY_TIMING: Timing = { byDue: 0, by10: 0, byEnd: 0, dated: 0, clearDayMedian: null, onTime: 0, clearedWithDates: 0 };

/** dd/mm/yyyy -> {d, m (0-11), y}, or null. */
export function parseDmy(s: string): { d: number; m: number; y: number } | null {
  const x = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return x ? { d: +x[1], m: +x[2] - 1, y: +x[3] } : null;
}

/** Which day of the month a payment counts as: 0 if it arrived before the month, 99 if after it. */
function dayIn(p: Payment, year: number, month: number): number | null {
  const d = parseDmy(p.paidOn);
  if (!d) return null;
  if (d.y < year || (d.y === year && d.m < month)) return 0;
  if (d.y > year || (d.y === year && d.m > month)) return 99;
  return d.d;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Everything the report shows about one month, from the month's rows (with the
 * ledger already folded in) and the ledger itself. Pure, so every figure is tested.
 */
export function monthFacts(
  rows: EffEntry[] | null,
  payments: Payment[],
  year: number,
  month: number,
  dueDay: number
): MonthFacts {
  const base: MonthFacts = {
    month, opened: !!rows && rows.length > 0, charged: 0, rentCharged: 0, waterCharged: 0, collected: 0, rentReceived: 0,
    outstanding: 0, credit: 0, rate: 0, occupied: 0, vacant: 0, vacancyLoss: 0, clear: 0, part: 0, owing: 0,
    channels: { ...EMPTY_CHANNELS }, timing: { ...EMPTY_TIMING }, units: [],
  };
  if (!rows || rows.length === 0) return base;

  const mine = payments.filter((p) => p.year === year && p.month === month);
  const reversed = reversedIds(mine);
  const live = mine.filter((p) => p.source !== "reversal" && !reversed.has(p.id));
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const clearDays: number[] = [];

  for (const p of mine) {
    if (p.source === "reversal") { base.channels.reversals += -p.amount; base.channels.reversalCount++; }
    else if (!reversed.has(p.id)) base.channels[p.source] += p.amount;
  }

  for (const e of rows) {
    const st = unitState(e, true);
    const unitPays = live.filter((p) => p.floor === e.floor && p.unit === e.unit);
    base.collected += e.paid;
    base.channels.earlier += e.manualPaid;
    base.rentReceived += Math.min(Math.max(e.paid, 0), e.rent);

    if (e.vacant) {
      base.vacant++;
      base.vacancyLoss += e.rent;
    } else {
      base.occupied++;
      base.charged += st.due;
      base.rentCharged += e.rent;
      base.waterCharged += e.water;
      if (st.balance > 0) base.outstanding += st.balance;
      if (st.status === "paid") base.clear++;
      else if (st.status === "part") base.part++;
      else if (st.status === "owe") base.owing++;
    }
    if (st.balance < 0) base.credit += -st.balance;

    // timing: date every live ledger payment against this month
    for (const p of unitPays) {
      const d = dayIn(p, year, month);
      if (d === null) continue;
      base.timing.dated += p.amount;
      if (d <= dueDay) base.timing.byDue += p.amount;
      if (d <= 10) base.timing.by10 += p.amount;
      if (d <= lastDay) base.timing.byEnd += p.amount;
    }
    // the day a paid-up unit was cleared, when every shilling has a date
    if (!e.vacant && st.status === "paid" && e.manualPaid === 0 && st.due > 0) {
      const dated = unitPays.map((p) => ({ p, d: dayIn(p, year, month) })).filter((x) => x.d !== null) as { p: Payment; d: number }[];
      if (dated.length === unitPays.length && dated.length > 0) {
        dated.sort((a, b) => a.d - b.d);
        let run = 0;
        for (const x of dated) {
          run += x.p.amount;
          if (run >= st.due) { clearDays.push(Math.min(x.d, 31)); break; }
        }
      }
    }

    const receipts = unitPays.map((p) => p.receipt).filter(Boolean);
    const last = unitPays.map((p) => p.paidOn).filter((s) => parseDmy(s)).sort((a, b) => {
      const A = parseDmy(a)!, Bd = parseDmy(b)!;
      return A.y * 10000 + A.m * 100 + A.d - (Bd.y * 10000 + Bd.m * 100 + Bd.d);
    }).pop() ?? "";
    base.units.push({
      floor: e.floor, unit: e.unit, tenant: e.tenant, rent: e.rent, water: e.water,
      due: e.vacant ? 0 : st.due, paid: e.paid, balance: e.vacant ? -e.paid : st.balance,
      status: st.status, receipts, lastPaid: last,
    });
  }

  base.timing.clearDayMedian = median(clearDays);
  base.timing.onTime = clearDays.filter((d) => d <= dueDay).length;
  base.timing.clearedWithDates = clearDays.length;
  base.rate = base.charged > 0 ? Math.round((base.collected / base.charged) * 100) : 100;
  base.units.sort((a, b) => a.floor - b.floor || FLOORS.indexOf(a.floor) - FLOORS.indexOf(b.floor));
  return base;
}

export interface PeriodFacts extends Omit<MonthFacts, "month" | "units" | "timing"> {
  months: number[];
  openedMonths: number;
  occupancy: number; // average share of units occupied, 0-100
  timing: Omit<Timing, "clearDayMedian">;
}

/** Add months together for a quarter, the year so far, or any range. */
export function periodFacts(list: MonthFacts[]): PeriodFacts {
  const p: PeriodFacts = {
    months: list.map((m) => m.month), openedMonths: 0, opened: false,
    charged: 0, rentCharged: 0, waterCharged: 0, collected: 0, rentReceived: 0, outstanding: 0, credit: 0, rate: 0,
    occupied: 0, vacant: 0, vacancyLoss: 0, clear: 0, part: 0, owing: 0, occupancy: 0,
    channels: { ...EMPTY_CHANNELS },
    timing: { byDue: 0, by10: 0, byEnd: 0, dated: 0, onTime: 0, clearedWithDates: 0 },
  };
  let occSum = 0;
  for (const m of list) {
    if (!m.opened) continue;
    p.openedMonths++;
    p.opened = true;
    for (const k of ["charged", "rentCharged", "waterCharged", "collected", "rentReceived", "outstanding", "credit", "vacancyLoss", "clear", "part", "owing"] as const) {
      p[k] += m[k];
    }
    for (const k of Object.keys(p.channels) as (keyof Channels)[]) p.channels[k] += m.channels[k];
    for (const k of Object.keys(p.timing) as (keyof PeriodFacts["timing"])[]) p.timing[k] += m.timing[k];
    occSum += m.occupied / Math.max(1, m.occupied + m.vacant);
  }
  const last = [...list].reverse().find((m) => m.opened);
  p.occupied = last?.occupied ?? 0;
  p.vacant = last?.vacant ?? 0;
  p.occupancy = p.openedMonths ? Math.round((occSum / p.openedMonths) * 100) : 0;
  p.rate = p.charged > 0 ? Math.round((p.collected / p.charged) * 100) : 100;
  return p;
}

/** The change from one figure to another, for the ▲/▼ markers. */
export function change(now: number, before: number | null | undefined): { diff: number; dir: "up" | "down" | "same" } | null {
  if (before === null || before === undefined) return null;
  const diff = now - before;
  return { diff, dir: diff > 0 ? "up" : diff < 0 ? "down" : "same" };
}
