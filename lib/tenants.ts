import { FLOORS, unitsForFloor } from "./config";
import { Entry, MonthData, hasMonthData, loadMonth, saveMonth } from "./store";

/** Everything the Tenants page records about whoever lives in a unit. */
export interface TenantDetails {
  tenant: string;
  phone: string;
  idNo: string;
  email: string;
  moveIn: string; // yyyy-mm-dd, or ""
  deposit: number;
  notes: string;
  vacant: boolean;
}

export const EMPTY_TENANT: TenantDetails = {
  tenant: "", phone: "", idNo: "", email: "", moveIn: "", deposit: 0, notes: "", vacant: false,
};

export const unitId = (floor: number, unit: string) => `${floor}|${unit}`;

export function detailsOf(e: Entry): TenantDetails {
  return {
    tenant: e.tenant,
    phone: e.phone,
    idNo: e.idNo ?? "",
    email: e.email ?? "",
    moveIn: e.moveIn ?? "",
    deposit: e.deposit ?? 0,
    notes: e.notes ?? "",
    vacant: e.vacant,
  };
}

/** Tidy what was typed: trim, collapse spaces, drop details of a vacant unit. */
export function cleanDetails(d: TenantDetails): TenantDetails {
  if (d.vacant) return { ...EMPTY_TENANT, vacant: true };
  return {
    tenant: d.tenant.trim().replace(/\s+/g, " "),
    phone: d.phone.trim(),
    idNo: d.idNo.trim(),
    email: d.email.trim(),
    moveIn: d.moveIn,
    deposit: Math.max(0, Math.round(d.deposit || 0)),
    notes: d.notes.trim(),
    vacant: false,
  };
}

/** The same rule the M-Pesa prompt uses, so a saved number is always one a prompt can reach. */
export function validPhone(raw: string): boolean {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) d = "254" + d.slice(1);
  else if (d.length === 9) d = "254" + d;
  return /^254[17]\d{8}$/.test(d);
}

export function validEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
}

/** What is still missing for an occupied unit. A vacant unit is never "missing" anything. */
export function missingDetails(d: TenantDetails): string[] {
  if (d.vacant) return [];
  const out: string[] = [];
  if (!d.tenant) out.push("name");
  if (!d.phone) out.push("phone");
  return out;
}

const SAME = (a: TenantDetails, e: Entry) => {
  const b = detailsOf(e);
  return (Object.keys(a) as (keyof TenantDetails)[]).every((k) => a[k] === b[k]);
};

/** Pure: write one unit's details onto a month's rows. Untouched rows are returned as they were. */
export function applyTenantChange(
  rows: MonthData,
  floor: number,
  unit: string,
  d: TenantDetails,
  now: number = Date.now()
): { rows: MonthData; changed: boolean } {
  let changed = false;
  const out = rows.map((r): Entry => {
    if (r.floor !== floor || r.unit !== unit || SAME(d, r)) return r;
    changed = true;
    const next: Entry = { ...r, tenant: d.tenant, phone: d.phone, vacant: d.vacant, ts: now };
    // optional fields are removed when blank, so a vacated unit keeps no old details
    const opt = { idNo: d.idNo, email: d.email, moveIn: d.moveIn, deposit: d.deposit, notes: d.notes };
    for (const [k, v] of Object.entries(opt)) {
      if (v) (next as unknown as Record<string, unknown>)[k] = v;
      else delete (next as unknown as Record<string, unknown>)[k];
    }
    return next;
  });
  return { rows: out, changed };
}

/** Months of the year that have been opened. */
export function openedMonths(year: number): number[] {
  return Array.from({ length: 12 }, (_, m) => m).filter((m) => hasMonthData(m, year));
}

/**
 * Change a unit's tenant details from `fromMonth` onward. Months already saved
 * from that month on show the new details; earlier months keep who lived there
 * then, so past receipts and reports still name the right person. Months opened
 * later copy the details from the month before.
 */
export function setTenantFrom(
  year: number,
  fromMonth: number,
  floor: number,
  unit: string,
  details: TenantDetails
): number {
  const d = cleanDetails(details);
  let updated = 0;
  for (let m = fromMonth; m <= 11; m++) {
    if (!hasMonthData(m, year)) continue;
    const { rows, changed } = applyTenantChange(loadMonth(m, year), floor, unit, d);
    if (!changed) continue;
    saveMonth(m, rows, year);
    updated++;
  }
  return updated;
}

/** Every unit's details as of (year, month): taken from the latest opened month up to it. */
export function tenantsAsOf(year: number, month: number): Map<string, TenantDetails> {
  const map = new Map<string, TenantDetails>();
  for (const f of FLOORS) for (const u of unitsForFloor(f)) map.set(unitId(f, u.label), { ...EMPTY_TENANT });
  for (let m = month; m >= 0; m--) {
    if (!hasMonthData(m, year)) continue;
    for (const e of loadMonth(m, year)) {
      const k = unitId(e.floor, e.unit);
      if (map.has(k)) map.set(k, detailsOf(e));
    }
    break;
  }
  return map;
}

export interface TenancyRun {
  tenant: string; // "" for a stretch with nobody recorded
  vacant: boolean;
  fromMonth: number;
  toMonth: number;
}

/** Who has lived in a unit over the year, as runs of consecutive opened months. */
export function tenantHistory(year: number, floor: number, unit: string): TenancyRun[] {
  const runs: TenancyRun[] = [];
  for (const m of openedMonths(year)) {
    const e = loadMonth(m, year).find((r) => r.floor === floor && r.unit === unit);
    if (!e) continue;
    const last = runs[runs.length - 1];
    if (last && last.tenant === e.tenant && last.vacant === e.vacant) last.toMonth = m;
    else runs.push({ tenant: e.tenant, vacant: e.vacant, fromMonth: m, toMonth: m });
  }
  return runs;
}
