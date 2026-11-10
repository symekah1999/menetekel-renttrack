import { describe, it, expect } from "vitest";
import { buildActivity, dayKey, latestPayments, nairobiDays } from "@/lib/activity";
import type { Payment } from "@/lib/ledger";

const pay = (id: string, paidOn: string, amount: number, over: Partial<Payment> = {}): Payment => ({
  id, year: 2026, month: 10, floor: 1, unit: "Unit 2", amount, receipt: "", source: "manual",
  paidOn, createdAt: `2026-11-${paidOn.slice(0, 2)}T08:00:00Z`, ...over,
});
const NOW = new Date("2026-11-10T09:00:00Z"); // Tuesday 10 Nov in Nairobi
const tenant = () => "Amina Wanjiru";

describe("dayKey", () => {
  it("uses the paid-on date, falling back to the recorded date", () => {
    expect(dayKey(pay("a", "05/11/2026", 1))).toBe("2026-11-05");
    expect(dayKey({ paidOn: "", createdAt: "2026-11-03T22:00:00Z" })).toBe("2026-11-03");
  });
});

describe("buildActivity", () => {
  const list = [
    pay("a", "10/11/2026", 4800, { createdAt: "2026-11-10T07:00:00Z" }),
    pay("b", "10/11/2026", 1000, { createdAt: "2026-11-10T08:00:00Z", source: "stk", receipt: "SJK123" }),
    pay("c", "09/11/2026", 2500),
    pay("d", "03/11/2026", 6500, { unit: "Unit 1", floor: 0 }),
    pay("e", "03/11/2026", -6500, { unit: "Unit 1", floor: 0, source: "reversal", reverses: "d" }),
  ];

  it("groups by day, newest day first, newest entry first within a day", () => {
    const days = buildActivity(list, tenant, "all", "", NOW);
    expect(days.map((d) => d.label)).toEqual(["Today", "Yesterday", "Tue 3 Nov"]);
    expect(days[0].items.map((i) => i.p.id)).toEqual(["b", "a"]);
    expect(days[0].total).toBe(5800);
  });

  it("nets a reversal against its day and marks the original as reversed", () => {
    const d = buildActivity(list, tenant, "all", "", NOW).find((x) => x.key === "2026-11-03")!;
    expect(d.total).toBe(0);
    expect(d.items.find((i) => i.p.id === "d")!.reversed).toBe(true);
  });

  it("filters by source and searches tenant, unit, receipt and amount", () => {
    expect(buildActivity(list, tenant, "stk", "", NOW).flatMap((d) => d.items).map((i) => i.p.id)).toEqual(["b"]);
    expect(buildActivity(list, tenant, "all", "sjk123", NOW).flatMap((d) => d.items)).toHaveLength(1);
    expect(buildActivity(list, tenant, "all", "unit 1", NOW).flatMap((d) => d.items)).toHaveLength(2);
    expect(buildActivity(list, tenant, "all", "2500", NOW).flatMap((d) => d.items)).toHaveLength(1);
    expect(buildActivity(list, tenant, "all", "amina 4800", NOW).flatMap((d) => d.items)).toHaveLength(1);
    expect(buildActivity(list, tenant, "all", "nobody", NOW)).toEqual([]);
  });

  it("works out today in Nairobi, not UTC", () => {
    expect(nairobiDays(new Date("2026-11-09T22:30:00Z")).today).toBe("2026-11-10");
  });
});

describe("latestPayments", () => {
  it("returns the newest n", () => {
    const list = [pay("a", "01/11/2026", 1), pay("b", "08/11/2026", 1), pay("c", "05/11/2026", 1)];
    expect(latestPayments(list, 2).map((p) => p.id)).toEqual(["b", "c"]);
  });
});
