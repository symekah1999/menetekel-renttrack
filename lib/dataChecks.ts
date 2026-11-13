import type { EffEntry } from "./store";
import type { Payment } from "./ledger";
import { reversedIds } from "./ledger";
import { MONTHS } from "./config";

export interface Issue {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
  href?: string;
}

/** Things that would make the reports wrong or incomplete, worst first. */
export function runChecks(year: number, months: (EffEntry[] | null)[], payments: Payment[], current: number): Issue[] {
  const out: Issue[] = [];
  const now = months[current];
  const unitHref = (m: number, f: number, u: string) => `/collect?month=${m}&floor=${f}&unit=${encodeURIComponent(u)}`;

  // months skipped between the first opened month and now
  const opened = months.map((m, i) => (m && m.length ? i : -1)).filter((i) => i >= 0);
  if (opened.length) {
    for (let m = opened[0]; m <= current; m++) {
      if (!months[m] || !months[m]!.length) {
        out.push({ id: `gap-${m}`, severity: "high", title: `${MONTHS[m]} was never opened`, detail: "Rent for that month is missing from every report.", href: `/collect?month=${m}` });
      }
    }
  }

  // possible duplicate payments: same unit, month, amount and date
  const reversed = reversedIds(payments);
  const live = payments.filter((p) => p.year === year && p.source !== "reversal" && !reversed.has(p.id));
  const seen = new Map<string, Payment>();
  for (const p of live) {
    const k = `${p.month}|${p.floor}|${p.unit}|${p.amount}|${p.paidOn}`;
    const first = seen.get(k);
    if (first) {
      out.push({
        id: `dup-${p.id}`, severity: "high", title: `Possible duplicate payment: Floor ${p.floor}, ${p.unit}`,
        detail: `Two payments of KSh ${p.amount.toLocaleString()} on ${p.paidOn} for ${MONTHS[p.month]}. Reverse one if it was entered twice.`,
        href: unitHref(p.month, p.floor, p.unit),
      });
    } else seen.set(k, p);
  }

  // M-Pesa payments without a receipt number
  for (const p of live) {
    if ((p.source === "stk" || p.source === "csv") && !p.receipt) {
      out.push({
        id: `rcpt-${p.id}`, severity: "medium", title: `M-Pesa payment without a receipt: Floor ${p.floor}, ${p.unit}`,
        detail: `KSh ${p.amount.toLocaleString()} on ${p.paidOn || "an unknown date"}. Match it to your M-Pesa statement.`,
        href: unitHref(p.month, p.floor, p.unit),
      });
    }
  }

  if (now) {
    for (const e of now) {
      if (e.vacant) {
        if (e.paid > 0) out.push({ id: `vacpaid-${e.floor}-${e.unit}`, severity: "medium", title: `Money recorded for a vacant unit: Floor ${e.floor}, ${e.unit}`, detail: `KSh ${e.paid.toLocaleString()} this month while the unit is marked vacant.`, href: unitHref(current, e.floor, e.unit) });
        continue;
      }
      if (!e.tenant.trim()) out.push({ id: `name-${e.floor}-${e.unit}`, severity: "medium", title: `No tenant name: Floor ${e.floor}, ${e.unit}`, detail: "Statements and reminders will show the unit instead of a name.", href: `/tenants?month=${current}&floor=${e.floor}&unit=${encodeURIComponent(e.unit)}` });
      if (!e.phone.trim()) out.push({ id: `phone-${e.floor}-${e.unit}`, severity: "low", title: `No phone number: Floor ${e.floor}, ${e.unit}`, detail: "M-Pesa prompts and WhatsApp reminders cannot reach this tenant.", href: `/tenants?month=${current}&floor=${e.floor}&unit=${encodeURIComponent(e.unit)}` });
      const due = e.rent + e.water;
      if (e.paid > due && due > 0) out.push({ id: `over-${e.floor}-${e.unit}`, severity: "low", title: `Overpaid: Floor ${e.floor}, ${e.unit}`, detail: `Paid KSh ${e.paid.toLocaleString()} against KSh ${due.toLocaleString()} due. Check it is not a mistake.`, href: unitHref(current, e.floor, e.unit) });
    }
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
