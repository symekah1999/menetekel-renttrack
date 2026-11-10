import { describe, it, expect } from "vitest";
import { rankItems, PaletteItem } from "@/lib/search";

const items: PaletteItem[] = [
  { id: "p-collect", kind: "page", title: "Collect rent", href: "/collect" },
  { id: "p-tenants", kind: "page", title: "Tenants", href: "/tenants" },
  { id: "a-review", kind: "action", title: "Month in review", href: "/dashboard?review=1" },
  { id: "u-1-2", kind: "unit", title: "Floor 1, Unit 2", hint: "Amina Wanjiru", href: "/collect", keywords: "0712 345 678", floor: 1, unit: "Unit 2" },
  { id: "u-3-2", kind: "unit", title: "Floor 3, Unit 2", hint: "Wanjiru Kamau", href: "/collect", floor: 3, unit: "Unit 2" },
  { id: "u-0-67", kind: "unit", title: "Floor 0, Unit 6+7", hint: "Akinyi", href: "/collect", floor: 0, unit: "Unit 6+7" },
];

describe("rankItems", () => {
  it("shows pages and actions, not units, before anything is typed", () => {
    expect(rankItems(items, "").map((i) => i.kind)).not.toContain("unit");
  });
  it("finds a unit by tenant name, phone digits or floor and unit", () => {
    expect(rankItems(items, "amina")[0].id).toBe("u-1-2");
    expect(rankItems(items, "345")[0].id).toBe("u-1-2");
    expect(rankItems(items, "floor 3 unit 2").map((i) => i.id)).toEqual(["u-3-2"]);
    expect(rankItems(items, "Floor 3, Unit 2").map((i) => i.id)).toEqual(["u-3-2"]);
    expect(rankItems(items, "unit 6+7").map((i) => i.id)).toEqual(["u-0-67"]);
    expect(rankItems(items, "unit 2").map((i) => i.id).sort()).toEqual(["u-1-2", "u-3-2"]);
  });
  it("needs every word to match", () => {
    expect(rankItems(items, "wanjiru").map((i) => i.id).sort()).toEqual(["u-1-2", "u-3-2"]);
    expect(rankItems(items, "wanjiru kamau").map((i) => i.id)).toEqual(["u-3-2"]);
  });
  it("puts titles that start with the query first", () => {
    expect(rankItems(items, "ten")[0].id).toBe("p-tenants");
    expect(rankItems(items, "co")[0].id).toBe("p-collect");
  });
  it("matches the start of words, so a lone digit does not match inside a number", () => {
    // "1" is a whole word in "Floor 1, Unit 2", but only inside other numbers elsewhere
    expect(rankItems(items, "1").map((i) => i.id)).toEqual(["u-1-2"]);
    expect(rankItems(items, "45")).toEqual([]);
    expect(rankItems(items, "0712")[0].id).toBe("u-1-2");
  });
});
