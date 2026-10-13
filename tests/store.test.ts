import { describe, it, expect, beforeEach } from "vitest";
import { installBrowserStub } from "./helpers";

installBrowserStub();

import {
  blankMonth, computeTotals, applyLedger, monthDue,
  savePayments, loadPayments, loadMonthEffective, exportBackup, importBackup,
} from "@/lib/store";
import type { Entry } from "@/lib/store";
import type { Payment } from "@/lib/ledger";
import { GRAND_TOTAL, TOTAL_UNITS } from "@/lib/config";

const store = () => (globalThis as unknown as { localStorage: Storage }).localStorage;

const put = (year: number, month: number, rows: Entry[]) =>
  store().setItem(`menetekel:${year}:${month}`, JSON.stringify(rows));

const payment = (over: Partial<Payment>): Payment => ({
  id: crypto.randomUUID(), year: 2026, month: 0, floor: 0, unit: "Unit 1", amount: 0,
  receipt: "", source: "manual", paidOn: "05/01/2026", createdAt: new Date().toISOString(), ...over,
});

beforeEach(() => store().clear());

describe("property configuration", () => {
  it("has 34 units and a monthly target equal to the sum of their rents", () => {
    const rows = blankMonth(0, 2026);
    expect(TOTAL_UNITS).toBe(34);
    expect(rows).toHaveLength(34);
    expect(rows.reduce((s, r) => s + r.rent, 0)).toBe(GRAND_TOTAL);
  });
});

describe("computeTotals", () => {
  it("counts a vacant unit as no charge and a paid unit as clear", () => {
    const rows = blankMonth(0, 2026).slice(0, 2);
    rows[0] = { ...rows[0], paid: rows[0].rent };
    rows[1] = { ...rows[1], vacant: true };
    const t = computeTotals(rows);
    expect(t.monthCharges).toBe(rows[0].rent);
    expect(t.paid).toBe(rows[0].rent);
    expect(t.rate).toBe(100);
    expect(t.vacant).toBe(1);
    expect(t.fullyPaid).toBe(2);
  });

  it("is each month on its own: nothing from an earlier month is added", () => {
    const rows = blankMonth(1, 2026).slice(0, 1);
    const t = computeTotals(rows);
    expect(t.totalDue).toBe(rows[0].rent);
    expect(t.balance).toBe(rows[0].rent);
    expect(t.defaulters).toBe(1);
  });
});

describe("applyLedger", () => {
  it("adds ledger rows to the typed amount without changing the stored row", () => {
    const rows = blankMonth(0, 2026).slice(0, 1).map((r) => ({ ...r, paid: 1000 }));
    const eff = applyLedger(rows, [payment({ amount: 2500 }), payment({ amount: 500 })], 2026, 0);
    expect(eff[0].paid).toBe(4000);
    expect(eff[0].manualPaid).toBe(1000);
    expect(eff[0].ledgerPaid).toBe(3000);
    expect(rows[0].paid).toBe(1000); // raw row untouched, safe to save
  });
});

describe("loadMonthEffective", () => {
  it("returns typed + ledger paid for a saved month", () => {
    const rows = blankMonth(2, 2026);
    rows[0] = { ...rows[0], paid: 500 };
    put(2026, 2, rows);
    savePayments(2026, [payment({ month: 2, floor: 0, unit: "Unit 1", amount: 6000 })]);
    expect(loadMonthEffective(2, 2026)[0].paid).toBe(6500);
    expect(loadMonthEffective(3, 2026)[0].paid).toBe(0); // other months are untouched
    expect(loadPayments(2026)).toHaveLength(1);
  });
});

describe("monthDue", () => {
  it("is rent plus water, or zero when vacant", () => {
    const r = blankMonth(0, 2026)[0];
    expect(monthDue({ ...r, water: 300 })).toBe(6800);
    expect(monthDue({ ...r, vacant: true })).toBe(0);
  });
});

describe("backup", () => {
  it("round-trips months and ledgers but leaves sync bookkeeping out", () => {
    put(2026, 0, blankMonth(0, 2026));
    savePayments(2026, [payment({ amount: 100 })]);
    store().setItem("menetekel:ver:2026:0", "x");
    store().setItem("menetekel:dirty", "[]");
    const json = exportBackup();
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed.data).sort()).toEqual(["menetekel:2026:0", "menetekel:payments:2026"]);
    store().clear();
    expect(importBackup(json)).toMatchObject({ ok: true, keys: 2 });
    expect(loadPayments(2026)).toHaveLength(1);
  });

  it("rejects files that aren't Menetekel backups", () => {
    expect(importBackup('{"app":"other","data":{}}').ok).toBe(false);
    expect(importBackup("not json").ok).toBe(false);
  });
});
