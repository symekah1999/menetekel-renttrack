"use client";

import { FLOORS, unitsForFloor, PROPERTY } from "./config";
import { Payment, ledgerTotal, receiptsFor } from "./ledger";

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
  /** Epoch ms of the last edit, used to merge edits made on different devices. */
  ts?: number;
}

/**
 * A month row with the payments ledger folded in. `paid` is the grand total
 * (typed amount + ledger rows), so totals and exports can treat it exactly
 * like the old `paid` field. `receipt` lists every live receipt for the month. Never save one of these back as a
 * month record: that would double-count the ledger.
 */
export interface EffEntry extends Entry {
  manualPaid: number;
  ledgerPaid: number;
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
    ...(typeof e.ts === "number" ? { ts: e.ts } : {}),
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

/** Cloud uploads are debounced so typing a tenant's name isn't one request per letter. */
const pushTimers = new Map<string, ReturnType<typeof setTimeout>>();
const PUSH_DELAY_MS = 700;

export function saveMonth(mi: number, data: MonthData, year = getActiveYear()): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(mi, year), JSON.stringify(data));
  } catch {
    /* storage full or blocked */
  }
  // Remember that this month has edits the cloud hasn't seen, then send them
  // shortly. If the device is offline the mark stays and a later load retries.
  const slot = `${year}:${mi}`;
  const pending = pushTimers.get(slot);
  if (pending) clearTimeout(pending);
  import("./cloud")
    .then((c) =>
      c.markDirty(year, mi).then(() => {
        pushTimers.set(
          slot,
          setTimeout(() => {
            pushTimers.delete(slot);
            // Always send what is stored now, not what was typed 700ms ago.
            const latest = localStorage.getItem(key(mi, year));
            const body = latest ? (JSON.parse(latest) as MonthData) : data;
            c.pushMonth(year, mi, body).catch(() => { /* retried later */ });
          }, PUSH_DELAY_MS)
        );
      })
    )
    .catch(() => { /* offline - localStorage still holds the data */ });
}

/* ---------- payments ledger (local cache) ---------- */

const payKey = (year: number) => `${PREFIX}:payments:${year}`;

export function loadPayments(year = getActiveYear()): Payment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(payKey(year));
    const parsed = raw ? (JSON.parse(raw) as Payment[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePayments(year: number, list: Payment[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(payKey(year), JSON.stringify(list));
  } catch {
    /* storage full or blocked */
  }
}

/** Fold ledger rows into month rows. Pure. */
export function applyLedger(
  rows: Entry[],
  payments: Payment[],
  year: number,
  mi: number
): EffEntry[] {
  return rows.map((r) => {
    const ledgerPaid = ledgerTotal(payments, year, mi, r.floor, r.unit);
    const receipts = [r.receipt, ...receiptsFor(payments, year, mi, r.floor, r.unit)].filter(Boolean);
    return { ...r, manualPaid: r.paid, ledgerPaid, paid: r.paid + ledgerPaid, receipt: receipts.join(" ") };
  });
}

/** A month as the rest of the app should see it: typed amounts + ledger. */
export function loadMonthEffective(mi: number, year = getActiveYear()): EffEntry[] {
  return applyLedger(loadMonth(mi, year), loadPayments(year), year, mi);
}

/** What a unit is charged for a month: rent plus water and other charges, nothing if vacant. */
export function monthDue(e: Entry): number {
  return e.vacant ? 0 : e.rent + e.water;
}

/* ---------- totals ---------- */

export interface Totals {
  monthCharges: number; // rent + water for occupied units this month
  totalDue: number; // same as monthCharges: each month stands on its own
  paid: number;
  balance: number; // totalDue - paid (negative = this month was overpaid)
  rate: number; // paid / totalDue
  fullyPaid: number;
  defaulters: number;
  occupied: number;
  vacant: number;
}

export function computeTotals(rows: MonthData): Totals {
  let due = 0, paid = 0, fullyPaid = 0, defaulters = 0, occupied = 0, vacant = 0;
  for (const r of rows) {
    const d = monthDue(r);
    due += d;
    paid += r.paid;
    if (r.vacant) vacant++; else occupied++;
    if (d - r.paid <= 0) fullyPaid++;
    else defaulters++;
  }
  return {
    monthCharges: due, totalDue: due, paid,
    balance: due - paid,
    rate: due > 0 ? Math.round((paid / due) * 100) : 100,
    fullyPaid, defaulters, occupied, vacant,
  };
}

export function monthTotalsFull(mi: number, year = getActiveYear()): Totals {
  return computeTotals(loadMonthEffective(mi, year));
}

export function floorTotalsFull(mi: number, floor: number, year = getActiveYear()): Totals {
  const rows = loadMonthEffective(mi, year).filter((r) => r.floor === floor);
  return computeTotals(rows);
}

/* ---------- backup / restore ---------- */

/** Keys that hold real records (months, ledgers, active year), not sync bookkeeping. */
const DATA_KEY = /^menetekel:(\d{4}:\d{1,2}|payments:\d{4}|activeYear)$/;

export function exportBackup(): string {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && DATA_KEY.test(k)) data[k] = localStorage.getItem(k) ?? "";
  }
  return JSON.stringify(
    { app: "menetekel-renttrack", version: 5, exportedAt: new Date().toISOString(), data },
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
      if (DATA_KEY.test(k)) {
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

export function whatsAppLink(
  e: Entry,
  balance: number,
  monthName: string,
  year: number,
  scope: "month" | "cumulative" = "month"
): string {
  const msg =
    `Hello ${e.tenant || "tenant"}, greetings from ${PROPERTY.name}. ` +
    (scope === "cumulative"
      ? `Your outstanding rent balance for ${e.unit} (Floor ${e.floor}) up to ${monthName} ${year} is KSh ${balance.toLocaleString()}. `
      : `Your ${monthName} ${year} balance for ${e.unit} (Floor ${e.floor}) is KSh ${balance.toLocaleString()}. `) +
    `Kindly clear it via ${PROPERTY.paymentMode} at your earliest convenience. Thank you.`;
  const digits = e.phone.replace(/\D/g, "");
  const intl = digits.startsWith("0") ? "254" + digits.slice(1) : digits;
  return intl.length >= 9
    ? `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`
    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
}
