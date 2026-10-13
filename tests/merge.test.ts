import { describe, it, expect } from "vitest";
import { mergeMonth, sameMonth } from "@/lib/merge";
import type { Entry } from "@/lib/store";

const e = (unit: string, over: Partial<Entry> = {}): Entry => ({
  floor: 1, unit, rent: 4800, merged: false, tenant: "", phone: "", water: 0,
  paid: 0, date: "05/10/2026", receipt: "", vacant: false, ...over,
});

describe("mergeMonth", () => {
  it("keeps each device's edit when they touched different units", () => {
    const local = [e("Unit 1", { tenant: "Amina", ts: 200 }), e("Unit 2", { ts: 0 })];
    const remote = [e("Unit 1", { ts: 0 }), e("Unit 2", { tenant: "Brian", ts: 300 })];
    const merged = mergeMonth(local, remote);
    expect(merged.find((r) => r.unit === "Unit 1")?.tenant).toBe("Amina");
    expect(merged.find((r) => r.unit === "Unit 2")?.tenant).toBe("Brian");
  });

  it("takes the most recent edit when both changed the same unit", () => {
    const local = [e("Unit 1", { water: 500, ts: 100 })];
    const remote = [e("Unit 1", { water: 700, ts: 200 })];
    expect(mergeMonth(local, remote)[0].water).toBe(700);
    expect(mergeMonth([e("Unit 1", { water: 500, ts: 300 })], remote)[0].water).toBe(500);
  });

  it("gives ties to the remote copy", () => {
    const merged = mergeMonth([e("Unit 1", { water: 1, ts: 5 })], [e("Unit 1", { water: 2, ts: 5 })]);
    expect(merged[0].water).toBe(2);
  });

  it("keeps rows that exist on only one side", () => {
    const merged = mergeMonth([e("Unit 9")], [e("Unit 1")]);
    expect(merged.map((r) => r.unit).sort()).toEqual(["Unit 1", "Unit 9"]);
  });

  it("treats rows with no timestamp as oldest", () => {
    const merged = mergeMonth([e("Unit 1", { water: 9 })], [e("Unit 1", { water: 3, ts: 1 })]);
    expect(merged[0].water).toBe(3);
  });
});

describe("sameMonth", () => {
  it("detects identical and different months", () => {
    expect(sameMonth([e("Unit 1")], [e("Unit 1")])).toBe(true);
    expect(sameMonth([e("Unit 1")], [e("Unit 1", { water: 1 })])).toBe(false);
  });
});
