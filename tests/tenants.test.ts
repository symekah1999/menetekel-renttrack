import { describe, it, expect, beforeEach } from "vitest";
import { installBrowserStub } from "./helpers";

installBrowserStub();

import { blankMonth, loadMonth } from "@/lib/store";
import {
  EMPTY_TENANT, TenantDetails, applyTenantChange, cleanDetails, missingDetails, openedMonths,
  setTenantFrom, tenantHistory, tenantsAsOf, unitId, validEmail, validPhone,
} from "@/lib/tenants";
import { normalizePhone } from "@/lib/server/daraja";

const store = () => (globalThis as unknown as { localStorage: Storage }).localStorage;
const save = (m: number, rows: unknown, year = 2026) => store().setItem(`menetekel:${year}:${m}`, JSON.stringify(rows));
const open = (months: number[]) => months.forEach((m) => save(m, blankMonth(m, 2026)));
const get = (m: number, floor = 1, unit = "Unit 2") => loadMonth(m, 2026).find((r) => r.floor === floor && r.unit === unit)!;

const amina: TenantDetails = {
  ...EMPTY_TENANT, tenant: "Amina Wanjiru", phone: "0712 345 678", idNo: "12345678",
  email: "amina@example.com", moveIn: "2026-03-01", deposit: 9600, notes: "Prefers WhatsApp",
};

beforeEach(() => store().clear());

describe("validPhone", () => {
  it.each(["0712345678", "+254 712 345 678", "254712345678", "712345678", "0112345678"])("accepts %s", (p) =>
    expect(validPhone(p)).toBe(true));
  it.each(["", "12345", "0612345678", "07123456789", "abc"])("rejects %s", (p) => expect(validPhone(p)).toBe(false));
  it("agrees with the number check the M-Pesa prompt uses", () => {
    for (const p of ["0712345678", "+254 712 345 678", "712345678", "0112345678", "0612345678", "12345", ""]) {
      expect(validPhone(p)).toBe(normalizePhone(p) !== null);
    }
  });
});

describe("validEmail", () => {
  it("accepts ordinary addresses and rejects obvious mistakes", () => {
    expect(validEmail("a@b.co")).toBe(true);
    expect(validEmail("a@b")).toBe(false);
    expect(validEmail("a b@c.com")).toBe(false);
  });
});

describe("cleanDetails and missingDetails", () => {
  it("trims, tidies spaces and drops everything for a vacant unit", () => {
    expect(cleanDetails({ ...amina, tenant: "  Amina   Wanjiru " }).tenant).toBe("Amina Wanjiru");
    expect(cleanDetails({ ...amina, vacant: true })).toEqual({ ...EMPTY_TENANT, vacant: true });
  });
  it("reports what an occupied unit is missing, and nothing for a vacant one", () => {
    expect(missingDetails({ ...EMPTY_TENANT })).toEqual(["name", "phone"]);
    expect(missingDetails({ ...EMPTY_TENANT, tenant: "A" })).toEqual(["phone"]);
    expect(missingDetails({ ...EMPTY_TENANT, vacant: true })).toEqual([]);
  });
});

describe("applyTenantChange", () => {
  it("changes only the named unit and leaves rent, water and payments alone", () => {
    const rows = blankMonth(0, 2026).map((r) => ({ ...r, paid: 100, water: 50 }));
    const { rows: out, changed } = applyTenantChange(rows, 1, "Unit 2", cleanDetails(amina), 99);
    expect(changed).toBe(true);
    const u = out.find((r) => r.floor === 1 && r.unit === "Unit 2")!;
    expect(u).toMatchObject({ tenant: "Amina Wanjiru", phone: "0712 345 678", idNo: "12345678", deposit: 9600, paid: 100, water: 50, rent: 4800, ts: 99 });
    expect(out.filter((r, i) => r !== rows[i])).toHaveLength(1);
  });
  it("reports no change when the details are the same", () => {
    const rows = blankMonth(0, 2026);
    const first = applyTenantChange(rows, 1, "Unit 2", cleanDetails(amina)).rows;
    expect(applyTenantChange(first, 1, "Unit 2", cleanDetails(amina)).changed).toBe(false);
  });
  it("removes optional details when they are cleared", () => {
    const filled = applyTenantChange(blankMonth(0, 2026), 1, "Unit 2", cleanDetails(amina)).rows;
    const cleared = applyTenantChange(filled, 1, "Unit 2", { ...EMPTY_TENANT, vacant: true }).rows;
    const u = cleared.find((r) => r.floor === 1 && r.unit === "Unit 2")!;
    expect(u.vacant).toBe(true);
    expect(u.tenant).toBe("");
    expect(u.idNo).toBeUndefined();
    expect(u.deposit).toBeUndefined();
  });
});

describe("setTenantFrom: a tenant change", () => {
  it("updates saved months from the chosen month on and keeps earlier tenants in earlier months", () => {
    open([0, 1, 2, 3]);
    setTenantFrom(2026, 0, 1, "Unit 2", { ...EMPTY_TENANT, tenant: "Old Tenant", phone: "0700000001" });
    expect(setTenantFrom(2026, 2, 1, "Unit 2", amina)).toBe(2);
    expect([0, 1, 2, 3].map((m) => get(m).tenant)).toEqual(["Old Tenant", "Old Tenant", "Amina Wanjiru", "Amina Wanjiru"]);
    expect(get(1).phone).toBe("0700000001");
    expect(get(3).phone).toBe("0712 345 678");
  });

  it("does not touch other units, payments or months that were never opened", () => {
    store().setItem("menetekel:2026:1", JSON.stringify(blankMonth(1, 2026).map((r) => ({ ...r, tenant: "Keep", paid: 777 }))));
    setTenantFrom(2026, 0, 1, "Unit 2", amina);
    expect(store().getItem("menetekel:2026:0")).toBeNull();
    expect(get(1, 1, "Unit 3").tenant).toBe("Keep");
    expect(get(1)).toMatchObject({ tenant: "Amina Wanjiru", paid: 777 });
  });

  it("carries the whole profile into a month opened later", () => {
    open([0]);
    setTenantFrom(2026, 0, 1, "Unit 2", amina);
    const feb = blankMonth(1, 2026).find((r) => r.floor === 1 && r.unit === "Unit 2")!;
    expect(feb).toMatchObject({ tenant: "Amina Wanjiru", phone: "0712 345 678", idNo: "12345678", email: "amina@example.com", moveIn: "2026-03-01", deposit: 9600, notes: "Prefers WhatsApp" });
  });

  it("can vacate a unit and later move someone in", () => {
    open([0, 1, 2]);
    setTenantFrom(2026, 0, 1, "Unit 2", amina);
    setTenantFrom(2026, 1, 1, "Unit 2", { ...EMPTY_TENANT, vacant: true });
    setTenantFrom(2026, 2, 1, "Unit 2", { ...EMPTY_TENANT, tenant: "New Person", phone: "0722000111" });
    expect([0, 1, 2].map((m) => [get(m).tenant, get(m).vacant])).toEqual([["Amina Wanjiru", false], ["", true], ["New Person", false]]);
  });
});

describe("tenantsAsOf", () => {
  it("reads the latest opened month at or before the one asked for", () => {
    open([0, 1]);
    setTenantFrom(2026, 1, 1, "Unit 2", amina);
    expect(tenantsAsOf(2026, 0).get(unitId(1, "Unit 2"))!.tenant).toBe("");
    expect(tenantsAsOf(2026, 6).get(unitId(1, "Unit 2"))!.tenant).toBe("Amina Wanjiru");
  });
  it("returns an empty profile for every unit when nothing is opened", () => {
    const m = tenantsAsOf(2026, 5);
    expect(m.size).toBe(34);
    expect(m.get(unitId(0, "Unit 1"))).toEqual(EMPTY_TENANT);
  });
});

describe("tenantHistory", () => {
  it("groups consecutive months by tenant", () => {
    open([0, 1, 2, 3, 4]);
    setTenantFrom(2026, 0, 1, "Unit 2", { ...EMPTY_TENANT, tenant: "First" });
    setTenantFrom(2026, 3, 1, "Unit 2", { ...EMPTY_TENANT, tenant: "Second" });
    expect(tenantHistory(2026, 1, "Unit 2")).toEqual([
      { tenant: "First", vacant: false, fromMonth: 0, toMonth: 2 },
      { tenant: "Second", vacant: false, fromMonth: 3, toMonth: 4 },
    ]);
    expect(openedMonths(2026)).toEqual([0, 1, 2, 3, 4]);
  });
});
