"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Entry, EffEntry, Totals, applyLedger, computeTotals,
  getActiveYear, hasMonthData, loadMonth, loadPayments,
} from "./store";
import { SYNC_EVENT } from "./cloud";
import type { Payment } from "./ledger";

export interface MonthView {
  year: number;
  raw: Entry[];
  eff: EffEntry[];
  payments: Payment[];
  totals: Totals;
  billed: boolean;
  loaded: boolean;
  /** Re-read everything from local storage (after a sync or a local change). */
  reload: () => void;
}

const EMPTY: Totals = {
  monthCharges: 0, totalDue: 0, paid: 0, balance: 0, rate: 0,
  fullyPaid: 0, defaulters: 0, occupied: 0, vacant: 0,
};

/** Reads one month (plus the ledger and arrears) and refreshes when a sync lands. */
export function useMonth(month: number): MonthView {
  const [tick, setTick] = useState(0);
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => { setYear(getActiveYear()); }, []);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(SYNC_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(SYNC_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return useMemo(() => {
    if (year === null) {
      return { year: 0, raw: [], eff: [], payments: [], totals: EMPTY, billed: false, loaded: false, reload };
    }
    const raw = loadMonth(month, year);
    const payments = loadPayments(year);
    const eff = applyLedger(raw, payments, year, month);
    return {
      year, raw, eff, payments,
      totals: computeTotals(eff),
      billed: hasMonthData(month, year),
      loaded: true,
      reload,
    };
    // tick is the invalidation signal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, tick, reload]);
}
