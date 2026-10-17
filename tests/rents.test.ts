import { describe, it, expect, beforeEach } from "vitest";
import { installBrowserStub } from "./helpers";

installBrowserStub();

import { blankMonth, loadMonth, monthDue } from "@/lib/store";
import { applyRentChanges, currentRents, defaultRents, rentKey, setRentsFrom, totalRent } from "@/lib/rents";
import { GRAND_TOTAL } from "@/lib/config";

const store = () => (globalThis as unknown as { localStorage: Storage }).localStorage;
const save = (year: number, m: number, rows: unknown) => store().setItem(`menetekel:${year}:${m}`, JSON.stringify(rows));
const K = rentKey(1, "Unit 2"); // 4,800 by default

beforeEach(() => store().clear());

describe("defaults and lookup", () => {
  it("starts from the configured rents", () => {
    expect(totalRent(defaultRents())).toBe(GRAND_TOTAL);
    expect(currentRents(2026, 5)[K]).toBe(4800);
  });
  it("reads the rent from the latest saved month at or before the one asked for", () => {
    const jan = blankMonth(0, 2026).map((r) => (r.floor === 1 && r.unit === "Unit 2" ? { ...r, rent: 5200 } : r));
    save(2026, 0, jan);
    expect(currentRents(2026, 3)[K]).toBe(5200);
  });
});

describe("applyRentChanges", () => {
  it("changes only the units that differ and leaves everything else alone", () => {
    const rows = blankMonth(0, 2026).map((r) => ({ ...r, paid: 100 }));
    const { rows: out, changed } = applyRentChanges(rows, { [K]: 5000 }, 123);
    expect(changed).toBe(1);
    const u = out.find((r) => r.floor === 1 && r.unit === "Unit 2")!;
    expect(u.rent).toBe(5000);
    expect(u.ts).toBe(123);
    expect(u.paid).toBe(100);
    expect(out.filter((r) => r.rent !== rows[out.indexOf(r)].rent)).toHaveLength(1);
    expect(monthDue(u)).toBe(5000);
  });
  it("reports no change when rents match", () => {
    expect(applyRentChanges(blankMonth(0, 2026), defaultRents()).changed).toBe(0);
  });
});

describe("setRentsFrom", () => {
  it("updates saved months from the chosen month on, and leaves earlier ones alone", () => {
    for (const m of [0, 1, 2, 3]) save(2026, m, blankMonth(m, 2026));
    const res = setRentsFrom(2026, 2, { ...defaultRents(), [K]: 5200 });
    expect(res).toEqual({ monthsUpdated: 2, unitsChanged: 1 });
    const rent = (m: number) => loadMonth(m, 2026).find((r) => r.floor === 1 && r.unit === "Unit 2")!.rent;
    expect([rent(0), rent(1), rent(2), rent(3)]).toEqual([4800, 4800, 5200, 5200]);
  });

  it("does not touch payments or tenants, and skips months that were never opened", () => {
    const mar = blankMonth(2, 2026).map((r) => ({ ...r, tenant: "Someone", paid: 4800 }));
    save(2026, 2, mar);
    const res = setRentsFrom(2026, 0, { ...defaultRents(), [K]: 5200 });
    expect(res.monthsUpdated).toBe(1);
    const u = loadMonth(2, 2026).find((r) => r.floor === 1 && r.unit === "Unit 2")!;
    expect(u).toMatchObject({ rent: 5200, tenant: "Someone", paid: 4800 });
    expect(store().getItem("menetekel:2026:0")).toBeNull();
  });
});

describe("a month opened later copies the rent from the month before", () => {
  it("carries a rent change forward", () => {
    save(2026, 0, blankMonth(0, 2026));
    setRentsFrom(2026, 0, { ...defaultRents(), [K]: 5200 });
    const feb = blankMonth(1, 2026).find((r) => r.floor === 1 && r.unit === "Unit 2")!;
    expect(feb.rent).toBe(5200);
  });
  it("uses the configured rent for the very first month", () => {
    expect(blankMonth(0, 2026).find((r) => r.floor === 1 && r.unit === "Unit 2")!.rent).toBe(4800);
  });
});
