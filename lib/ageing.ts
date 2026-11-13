/** How long money has been owed, oldest debts paid off first. */
export const BUCKETS = ["Up to 30 days", "31 to 60 days", "61 to 90 days", "Over 90 days"] as const;

export interface DebtCell { month: number; balance: number }

/**
 * Split a unit's unpaid balances into age buckets, counted from each month's
 * due day to `asOf`. An overpayment in one month is used to clear the oldest
 * debt first, the way a tenant's payment is normally applied.
 */
export function ageDebts(cells: DebtCell[], year: number, dueDay: number, asOf: Date): [number, number, number, number] {
  const debts: { month: number; amt: number }[] = [];
  let spare = 0; // credit not yet used
  for (const c of [...cells].sort((a, b) => a.month - b.month)) {
    if (c.balance > 0) {
      let amt = c.balance;
      const use = Math.min(spare, amt);
      amt -= use; spare -= use;
      if (amt > 0) debts.push({ month: c.month, amt });
    } else if (c.balance < 0) {
      let credit = -c.balance;
      while (credit > 0 && debts.length) {
        const oldest = debts[0];
        const use = Math.min(credit, oldest.amt);
        oldest.amt -= use; credit -= use;
        if (oldest.amt === 0) debts.shift();
      }
      spare += credit;
    }
  }
  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (const d of debts) {
    const due = Date.UTC(year, d.month, dueDay);
    const days = Math.floor((asOf.getTime() - due) / 86_400_000);
    const i = days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3;
    out[i] += d.amt;
  }
  return out;
}
