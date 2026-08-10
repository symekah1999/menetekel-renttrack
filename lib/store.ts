"use client";

import { FLOORS, unitsForFloor, PROPERTY } from "./config";

export interface Entry {
  floor: number;
  unit: string;
  rent: number;
  merged: boolean;
  tenant: string;
  phone: string;
  water: number; // water + other charges for the month
  paid: number;
  date: string;
  receipt: string;
  vacant: boolean;
}

export type MonthData = Entry[];

const PREFIX = "menetekel";
const YEAR_KEY = `${PREFIX}:activeYear`;

/* ---------- year management ---------- */

export function getActiveYear(): number {
  if (typeof window === "undefined") return PROPERTY.year;
  const raw = localStorage.getItem(YEAR_KEY);
  const y = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(y) && y >= 2024 && y <= 2100 ? y : PROPERTY.year;
}

export function setActiveYear(y: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(YEAR_KEY, String(y));
}

/* ---------- month storage ---------- */

function key(mi: number, year = getActiveYear()): string {
  return `${PREFIX}:${year}:${mi}`;
}

export function defaultDate(mi: number, year = getActiveYear()): string {
  const mm = String(mi + 1).padStart(2, "0");
  const dd = String(PROPERTY.dueDay).padStart(2, "0");
  return `${dd}/${mm}/${year}`;
}

function normalize(e: Partial<Entry>, mi: number, year: number): Entry {
  return {
    floor: e.floor ?? 0,
    unit: e.unit ?? "",
    rent: e.rent ?? 0,
    merged: !!e.merged,
    tenant: e.tenant ?? "",
    phone: e.phone ?? "",
    water: e.water ?? 0,
    paid: e.paid ?? 0,
    date: e.date ?? defaultDate(mi, year),
    receipt: e.receipt ?? "",
    vacant: !!e.vacant,
  };
}

export function hasMonthData(mi: number, year = getActiveYear()): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(key(mi, year)) !== null;
}

/** Latest saved month before (year, mi), same year first then previous year. */
function previousSavedMonth(mi: number, year: number): { data: MonthData } | null {
  for (let m = mi - 1; m >= 0; m--) {
    if (hasMonthData(m, year)) return { data: loadMonth(m, year) };
  }
  for (let m = 11; m >= 0; m--) {
    if (hasMonthData(m, year - 1)) return { data: loadMonth(m, year - 1) };
  }
  return null;
}

export function blankMonth(mi: number, year = getActiveYear()): MonthData {
  const prev = previousSavedMonth(mi, year);
  const rows: Entry[] = [];
  for (const f of FLOORS) {
    for (const u of unitsForFloor(f)) {
      const carry = prev?.data.find((r) => r.floor === f && r.unit === u.label);
      rows.push({
        floor: f,
        unit: u.label,
        rent: u.rent,
        merged: !!u.merged,
        tenant: carry?.tenant ?? "",
        phone: carry?.phone ?? "",
        water: 0,
        paid: 0,
        date: defaultDate(mi, year),
        receipt: "",
        vacant: carry?.vacant ?? false,
      });
    }
  }
  return rows;
}

export function loadMonth(mi: number, year = getActiveYear()): MonthData {
  if (typeof window === "undefined") return blankMonth(mi, year);
  try {
    const raw = localStorage.getItem(key(mi, year));
    if (!raw) return blankMonth(mi, year);
    const parsed = JSON.parse(raw) as Partial<Entry>[];
    if (!Array.isArray(parsed) || parsed.length === 0) return blankMonth(mi, year);
    return parsed.map((e) => normalize(e, mi, year));
  } catch {
    return blankMonth(mi, year);
  }
}

export function saveMonth(mi: number, data: MonthData, year = getActiveYear()): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(mi, year), JSON.stringify(data));
  } catch {
    /* storage full or blocked */
  }
  // Fire-and-forget cloud sync (no-op when cloud isn't configured or signed out)
  import("./cloud")
    .then((c) => c.pushMonth(year, mi, data))
    .catch(() => { /* offline - localStorage still holds the data */ });
}

/* ---------- arrears (carry-over balances) ---------- */

export function monthDue(e: Entry): number {
  return e.vacant ? 0 : e.rent + e.water;
}

/**
 * Balance carried into (year, mi) for a unit: sum of (due - paid) over all
 * SAVED months before it (untouched months don't create arrears).
 * Negative = credit from overpayment.
 */
export function unitArrears(
  mi: number,
  floor: number,
  unit: string,
  year = getActiveYear()
): number {
  let arrears = 0;
  const scan = (y: number, from: number, to: number) => {
    for (let m = from; m <= to; m++) {
      if (!hasMonthData(m, y)) continue;
      const e = loadMonth(m, y).find((r) => r.floor === floor && r.unit === unit);
      if (e) arrears += monthDue(e) - e.paid;
    }
  };
  scan(year - 1, 0, 11);
  scan(year, 0, mi - 1);
  return arrears;
}

export type ArrearsMap = Record<string, number>;

export function arrearsMapFor(mi: number, year = getActiveYear()): ArrearsMap {
  const map: ArrearsMap = {};
  for (const f of FLOORS) {
    for (const u of unitsForFloor(f)) {
      map[`${f}|${u.label}`] = unitArrears(mi, f, u.label, year);
    }
  }
  return map;
}

/* ---------- totals ---------- */

export interface Totals {
  monthCharges: number; // rent + water for occupied units this month
  arrears: number; // net balance carried in
  totalDue: number; // monthCharges + arrears
  paid: number;
  balance: number; // totalDue - paid
  rate: number; // paid / totalDue
  fullyPaid: number;
  defaulters: number;
  occupied: number;
  vacant: number;
}

export function computeTotals(rows: MonthData, arrears: ArrearsMap): Totals {
  let monthCharges = 0, arr = 0, paid = 0, fullyPaid = 0, defaulters = 0, occupied = 0, vacant = 0;
  for (const r of rows) {
    const a = arrears[`${r.floor}|${r.unit}`] ?? 0;
    const due = monthDue(r) + a;
    monthCharges += monthDue(r);
    arr += a;
    paid += r.paid;
    if (r.vacant) vacant++; else occupied++;
    if (due - r.paid <= 0) fullyPaid++;
    else defaulters++;
  }
  const totalDue = monthCharges + arr;
  return {
    monthCharges, arrears: arr, totalDue, paid,
    balance: totalDue - paid,
    rate: totalDue > 0 ? Math.round((paid / totalDue) * 100) : 100,
    fullyPaid, defaulters, occupied, vacant,
  };
}

export function monthTotalsFull(mi: number, year = getActiveYear()): Totals {
  return computeTotals(loadMonth(mi, year), arrearsMapFor(mi, year));
}

export function floorTotalsFull(mi: number, floor: number, year = getActiveYear()): Totals {
  const rows = loadMonth(mi, year).filter((r) => r.floor === floor);
  return computeTotals(rows, arrearsMapFor(mi, year));
}

/* ---------- backup / restore ---------- */

export function exportBackup(): string {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) data[k] = localStorage.getItem(k) ?? "";
  }
  return JSON.stringify(
    { app: "menetekel-renttrack", version: 4, exportedAt: new Date().toISOString(), data },
    null,
    2
  );
}

export function importBackup(json: string): { ok: boolean; keys: number; error?: string } {
  try {
    const parsed = JSON.parse(json) as { app?: string; data?: Record<string, string> };
    if (parsed.app !== "menetekel-renttrack" || !parsed.data) {
      return { ok: false, keys: 0, error: "Not a Menetekel backup file." };
    }
    let n = 0;
    for (const [k, v] of Object.entries(parsed.data)) {
      if (k.startsWith(PREFIX)) {
        localStorage.setItem(k, v);
        n++;
      }
    }
    return { ok: true, keys: n };
  } catch {
    return { ok: false, keys: 0, error: "File could not be read as JSON." };
  }
}

/* ---------- WhatsApp helper ---------- */

export function whatsAppLink(e: Entry, balance: number, monthName: string, year: number): string {
  const msg =
    `Hello ${e.tenant || "tenant"}, greetings from ${PROPERTY.name}. ` +
    `Your ${monthName} ${year} balance for ${e.unit} (Floor ${e.floor}) is KShs ${balance.toLocaleString()}. ` +
    `Kindly clear it via ${PROPERTY.paymentMode} at your earliest convenience. Thank you.`;
  const digits = e.phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? "254" + digits.slice(1) : digits;
  return intl.length >= 9
    ? `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
