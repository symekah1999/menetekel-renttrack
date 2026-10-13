import { describe, it, expect } from "vitest";
import { unitState, shortUnit, compact } from "@/lib/status";
import type { EffEntry } from "@/lib/store";

const e = (over: Partial<EffEntry> = {}): EffEntry => ({
  floor: 1, unit: "Unit 2", rent: 4800, merged: false, tenant: "", phone: "", water: 0,
  paid: 0, manualPaid: 0, ledgerPaid: 0, date: "", receipt: "", vacant: false, ...over,
});

describe("unitState", () => {
  it("is 'none' for months nobody has opened", () => {
    expect(unitState(e(), false).status).toBe("none");
  });
  it("is owing when nothing has been paid", () => {
    expect(unitState(e(), true)).toMatchObject({ status: "owe", balance: 4800, fill: 0 });
  });
  it("is part-paid with a proportional fill", () => {
    const s = unitState(e({ paid: 2400 }), true);
    expect(s.status).toBe("part");
    expect(s.fill).toBe(50);
    expect(s.balance).toBe(2400);
  });
  it("is paid when the balance is cleared, including overpayment", () => {
    expect(unitState(e({ paid: 4800 }), true).status).toBe("paid");
    expect(unitState(e({ paid: 6000 }), true)).toMatchObject({ status: "paid", balance: -1200 });
  });
  it("charges only this month's rent and water, never an earlier shortfall", () => {
    expect(unitState(e({ paid: 4800, water: 300 }), true)).toMatchObject({ status: "part", due: 5100, balance: 300 });
  });
  it("shows vacant units as vacant whatever else is true", () => {
    expect(unitState(e({ vacant: true }), true).status).toBe("vacant");
  });
});

describe("tile labels", () => {
  it("shortens unit names and money", () => {
    expect(shortUnit("Unit 6+7")).toBe("6+7");
    expect(shortUnit("Unit 3")).toBe("3");
    expect(compact(4800)).toBe("4.8k");
    expect(compact(7500)).toBe("7.5k");
    expect(compact(6000)).toBe("6k");
    expect(compact(250)).toBe("250");
  });
});
