/**
 * Payments ledger.
 *
 * Every shilling that arrives is one append-only row. A mistake is never
 * edited away: it is reversed by a second row with a negative amount that
 * points back at the original. A unit's "paid" for a month is therefore the
 * sum of its ledger rows plus any amount typed into the month record before
 * the ledger existed (`manualPaid`).
 *
 * Everything in this file is pure so it can be unit-tested and shared by the
 * browser and the server.
 */

export type PaymentSource = "stk" | "csv" | "manual" | "reversal";

export interface Payment {
  id: string;
  year: number;
  month: number; // 0-11
  floor: number;
  unit: string;
  amount: number; // KShs, negative for a reversal
  receipt: string; // M-Pesa receipt, "" when there is none
  source: PaymentSource;
  paidOn: string; // dd/mm/yyyy
  note?: string;
  reverses?: string; // id of the payment this row cancels
  checkoutId?: string; // Daraja CheckoutRequestID for STK payments
  createdAt: string; // ISO timestamp
  createdBy?: string;
  /** Browser-only flag: false while the row is waiting to reach the cloud. */
  synced?: boolean;
}

export const unitKey = (floor: number, unit: string) => `${floor}|${unit}`;

/** dd/mm/yyyy for a Date, in Nairobi time (EAT = UTC+3, no daylight saving). */
export function nairobiDate(d = new Date()): string {
  const eat = new Date(d.getTime() + 3 * 3600_000);
  const dd = String(eat.getUTCDate()).padStart(2, "0");
  const mm = String(eat.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${eat.getUTCFullYear()}`;
}

/** Sum of all ledger rows for one unit in one month. */
export function ledgerTotal(
  payments: Payment[],
  year: number,
  month: number,
  floor: number,
  unit: string
): number {
  let total = 0;
  for (const p of payments) {
    if (p.year === year && p.month === month && p.floor === floor && p.unit === unit) {
      total += p.amount;
    }
  }
  return total;
}

/** Ledger rows for one unit in one month, oldest first. */
export function paymentsForUnit(
  payments: Payment[],
  year: number,
  month: number,
  floor: number,
  unit: string
): Payment[] {
  return payments
    .filter((p) => p.year === year && p.month === month && p.floor === floor && p.unit === unit)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Ids of payments that have already been reversed. */
export function reversedIds(payments: Payment[]): Set<string> {
  const s = new Set<string>();
  for (const p of payments) if (p.reverses) s.add(p.reverses);
  return s;
}

/** Build the row that cancels `original`. */
export function reversalOf(
  original: Payment,
  newId: string,
  now: Date = new Date(),
  by?: string
): Payment {
  return {
    id: newId,
    year: original.year,
    month: original.month,
    floor: original.floor,
    unit: original.unit,
    amount: -original.amount,
    receipt: "",
    source: "reversal",
    paidOn: nairobiDate(now),
    note: `Reversal of ${original.receipt || original.source} payment`,
    reverses: original.id,
    createdAt: now.toISOString(),
    createdBy: by,
    synced: false,
  };
}

/** Can this row still be reversed? (not a reversal itself, not already reversed) */
export function canReverse(p: Payment, all: Payment[]): boolean {
  return p.source !== "reversal" && !reversedIds(all).has(p.id);
}

/** Find an existing, non-reversed payment carrying the same M-Pesa receipt. */
export function findDuplicateReceipt(
  all: Payment[],
  receipt: string
): Payment | undefined {
  const r = receipt.trim().toUpperCase();
  if (!r) return undefined;
  const reversed = reversedIds(all);
  return all.find(
    (p) =>
      p.source !== "reversal" &&
      !reversed.has(p.id) &&
      p.receipt.trim().toUpperCase() === r
  );
}

/** Merge two payment lists by id. Remote rows win; unsynced local rows survive. */
export function mergePayments(local: Payment[], remote: Payment[]): Payment[] {
  const byId = new Map<string, Payment>();
  for (const p of remote) byId.set(p.id, { ...p, synced: true });
  for (const p of local) {
    if (!byId.has(p.id) && p.synced === false) byId.set(p.id, p);
  }
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Convert a Supabase `payments` row (snake_case) to a Payment. */
export function fromRow(r: Record<string, unknown>): Payment {
  return {
    id: String(r.id),
    year: Number(r.year),
    month: Number(r.month),
    floor: Number(r.floor),
    unit: String(r.unit),
    amount: Number(r.amount),
    receipt: String(r.receipt ?? ""),
    source: r.source as PaymentSource,
    paidOn: String(r.paid_on ?? ""),
    note: r.note ? String(r.note) : undefined,
    reverses: r.reverses ? String(r.reverses) : undefined,
    checkoutId: r.checkout_id ? String(r.checkout_id) : undefined,
    createdAt: String(r.created_at ?? new Date().toISOString()),
    createdBy: r.created_by ? String(r.created_by) : undefined,
    synced: true,
  };
}

/** Convert a Payment to a Supabase `payments` row. */
export function toRow(p: Payment): Record<string, unknown> {
  return {
    id: p.id,
    year: p.year,
    month: p.month,
    floor: p.floor,
    unit: p.unit,
    amount: p.amount,
    receipt: p.receipt,
    source: p.source,
    paid_on: p.paidOn,
    note: p.note ?? null,
    reverses: p.reverses ?? null,
    checkout_id: p.checkoutId ?? null,
    created_at: p.createdAt,
    created_by: p.createdBy ?? null,
  };
}

/**
 * Turn the date formats found in M-Pesa statements ("2026-10-05 08:15:00",
 * "05/10/2026 08:15", "5-10-2026") into dd/mm/yyyy. Falls back to today.
 */
export function normalizeDate(input: string, today: Date = new Date()): string {
  const s = input.trim().split(/[ T]/)[0];
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[3].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[1]}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;
  return nairobiDate(today);
}

/** Receipts of the live (not reversed) payments for one unit in one month. */
export function receiptsFor(
  payments: Payment[],
  year: number,
  month: number,
  floor: number,
  unit: string
): string[] {
  const reversed = reversedIds(payments);
  const out: string[] = [];
  for (const p of paymentsForUnit(payments, year, month, floor, unit)) {
    if (p.source !== "reversal" && !reversed.has(p.id) && p.receipt && !out.includes(p.receipt)) out.push(p.receipt);
  }
  return out;
}
