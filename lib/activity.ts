import type { Payment, PaymentSource } from "./ledger";
import { reversedIds } from "./ledger";
import { isEmpty, matches, parseQuery } from "./match";

export type ActivityFilter = "all" | PaymentSource;

export interface ActivityItem {
  p: Payment;
  tenant: string;
  /** This payment was later cancelled by a reversal. */
  reversed: boolean;
}

export interface ActivityDay {
  key: string; // yyyy-mm-dd, sorts newest first
  label: string; // "Today", "Yesterday" or "Tue 10 Nov"
  total: number; // sum of the day's rows (reversals count negative)
  items: ActivityItem[];
}

/** yyyy-mm-dd for a payment: its paid-on date (dd/mm/yyyy), else the day it was recorded. */
export function dayKey(p: Pick<Payment, "paidOn" | "createdAt">): string {
  const m = p.paidOn.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return p.createdAt.slice(0, 10);
}

function labelFor(key: string, today: string, yesterday: string): string {
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  const [y, mo, d] = key.split("-").map(Number);
  // Built by hand so every browser shows the same label ("Tue 3 Nov").
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  const mn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][mo - 1];
  return `${wd} ${d} ${mn}`;
}

/** Today's and yesterday's date in Nairobi (EAT, UTC+3). */
export function nairobiDays(now: Date = new Date()): { today: string; yesterday: string } {
  const eat = new Date(now.getTime() + 3 * 3600_000);
  const today = eat.toISOString().slice(0, 10);
  const yesterday = new Date(eat.getTime() - 86_400_000).toISOString().slice(0, 10);
  return { today, yesterday };
}

/**
 * Every payment of the year as a feed, grouped by day, newest first. Pure:
 * the page passes in how to look up the tenant for a payment.
 */
export function buildActivity(
  payments: Payment[],
  tenantOf: (p: Payment) => string,
  filter: ActivityFilter = "all",
  query = "",
  now: Date = new Date()
): ActivityDay[] {
  const reversed = reversedIds(payments);
  const q = parseQuery(query);
  const { today, yesterday } = nairobiDays(now);
  const days = new Map<string, ActivityDay>();

  for (const p of payments) {
    if (filter !== "all" && p.source !== filter) continue;
    const tenant = tenantOf(p);
    if (!isEmpty(q) && !matches(q, {
      floor: p.floor, unit: p.unit,
      text: [tenant, p.unit, `floor ${p.floor}`, p.receipt, p.note ?? "", String(Math.abs(p.amount))].join(" "),
    })) continue;
    const key = dayKey(p);
    let day = days.get(key);
    if (!day) {
      day = { key, label: labelFor(key, today, yesterday), total: 0, items: [] };
      days.set(key, day);
    }
    day.total += p.amount;
    day.items.push({ p, tenant, reversed: reversed.has(p.id) });
  }

  const out = [...days.values()].sort((a, b) => b.key.localeCompare(a.key));
  for (const d of out) d.items.sort((a, b) => b.p.createdAt.localeCompare(a.p.createdAt));
  return out;
}

/** The latest n payments, newest first (for the dashboard). */
export function latestPayments(payments: Payment[], n: number): Payment[] {
  return [...payments]
    .sort((a, b) => dayKey(b).localeCompare(dayKey(a)) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, n);
}
