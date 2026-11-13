/**
 * Monthly Rental Income (MRI) tax helper. KRA's rate is 7.5% of gross
 * residential rent received (since 1 January 2024), filed and paid by the
 * 20th of the following month, for landlords receiving KSh 288,000 to
 * KSh 15 million a year. The rate is a setting in case the law changes.
 */
export const MRI_DEFAULT_RATE = 7.5; // percent
export const MRI_MIN_YEAR = 288_000;
export const MRI_MAX_YEAR = 15_000_000;

export type MriState = "not-opened" | "upcoming" | "due-soon" | "due-passed";

export interface MriRow {
  month: number;
  received: number;
  tax: number;
  dueDate: string; // dd/mm/yyyy
  state: MriState;
  nil: boolean;
}

export function mriDueDate(year: number, month: number): Date {
  return new Date(Date.UTC(month === 11 ? year + 1 : year, (month + 1) % 12, 20));
}

const dmy = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

export function mriSchedule(
  received: { month: number; opened: boolean; amount: number }[],
  ratePct: number,
  year: number,
  now: Date = new Date()
): { rows: MriRow[]; total: number; totalTax: number; annualised: number; regime: "below" | "mri" | "above" | "unknown" } {
  const rows: MriRow[] = received.map((r) => {
    const due = mriDueDate(year, r.month);
    const days = (due.getTime() - now.getTime()) / 86_400_000;
    const state: MriState = !r.opened ? "not-opened" : days < 0 ? "due-passed" : days <= 10 ? "due-soon" : "upcoming";
    return {
      month: r.month, received: r.amount, tax: Math.round((r.amount * ratePct) / 100),
      dueDate: dmy(due), state, nil: r.opened && r.amount === 0,
    };
  });
  const opened = rows.filter((r) => r.state !== "not-opened");
  const total = opened.reduce((s, r) => s + r.received, 0);
  const totalTax = opened.reduce((s, r) => s + r.tax, 0);
  const annualised = opened.length ? Math.round((total / opened.length) * 12) : 0;
  const regime = opened.length === 0 ? "unknown" : annualised < MRI_MIN_YEAR ? "below" : annualised > MRI_MAX_YEAR ? "above" : "mri";
  return { rows, total, totalTax, annualised, regime };
}
