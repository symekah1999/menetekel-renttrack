import { describe, it, expect } from "vitest";
import {
  Payment, ledgerTotal, reversalOf, canReverse, findDuplicateReceipt,
  mergePayments, fromRow, toRow, nairobiDate, paymentsForUnit,
} from "@/lib/ledger";

const pay = (over: Partial<Payment> = {}): Payment => ({
  id: "p1", year: 2026, month: 9, floor: 1, unit: "Unit 2", amount: 4800,
  receipt: "SJK1ABC", source: "stk", paidOn: "05/10/2026",
  createdAt: "2026-10-05T08:00:00.000Z", ...over,
});

describe("ledgerTotal", () => {
  it("sums only the matching unit and month", () => {
    const list = [
      pay({ id: "a", amount: 3000 }),
      pay({ id: "b", amount: 1800 }),
      pay({ id: "c", unit: "Unit 3", amount: 999 }),
      pay({ id: "d", month: 8, amount: 777 }),
    ];
    expect(ledgerTotal(list, 2026, 9, 1, "Unit 2")).toBe(4800);
  });

  it("counts a reversal as taking the money back", () => {
    const original = pay({ id: "a", amount: 4800 });
    const rev = reversalOf(original, "r1", new Date("2026-10-06T10:00:00Z"));
    expect(rev.amount).toBe(-4800);
    expect(rev.source).toBe("reversal");
    expect(rev.reverses).toBe("a");
    expect(ledgerTotal([original, rev], 2026, 9, 1, "Unit 2")).toBe(0);
  });
});

describe("canReverse", () => {
  it("allows one reversal of a real payment and nothing else", () => {
    const original = pay({ id: "a" });
    const rev = reversalOf(original, "r1");
    expect(canReverse(original, [original])).toBe(true);
    expect(canReverse(original, [original, rev])).toBe(false);
    expect(canReverse(rev, [original, rev])).toBe(false);
  });
});

describe("findDuplicateReceipt", () => {
  it("finds the same receipt regardless of case or spaces", () => {
    const list = [pay({ id: "a", receipt: "SJK1ABC" })];
    expect(findDuplicateReceipt(list, " sjk1abc ")?.id).toBe("a");
  });
  it("ignores empty receipts", () => {
    expect(findDuplicateReceipt([pay({ receipt: "" })], "")).toBeUndefined();
  });
  it("lets a receipt be re-entered after its payment was reversed", () => {
    const original = pay({ id: "a" });
    const rev = reversalOf(original, "r1");
    expect(findDuplicateReceipt([original, rev], "SJK1ABC")).toBeUndefined();
  });
});

describe("mergePayments", () => {
  it("lets the cloud win and keeps unsent local rows", () => {
    const local = [pay({ id: "a", amount: 1, synced: true }), pay({ id: "b", synced: false })];
    const remote = [pay({ id: "a", amount: 4800 })];
    const merged = mergePayments(local, remote);
    expect(merged.map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(merged.find((p) => p.id === "a")?.amount).toBe(4800);
  });
  it("drops local rows that were synced but are gone from the cloud", () => {
    const merged = mergePayments([pay({ id: "x", synced: true })], []);
    expect(merged).toEqual([]);
  });
});

describe("row conversion", () => {
  it("round-trips a payment through the database shape", () => {
    const p = pay({ checkoutId: "ws_CO_1", note: "hi" });
    const back = fromRow(toRow(p));
    expect(back).toMatchObject({ id: p.id, amount: 4800, receipt: "SJK1ABC", checkoutId: "ws_CO_1", note: "hi", synced: true });
  });
});

describe("nairobiDate", () => {
  it("rolls over at midnight Nairobi time, not UTC", () => {
    expect(nairobiDate(new Date("2026-10-05T21:30:00Z"))).toBe("06/10/2026");
    expect(nairobiDate(new Date("2026-10-05T20:30:00Z"))).toBe("05/10/2026");
  });
});

describe("paymentsForUnit", () => {
  it("returns oldest first", () => {
    const list = [
      pay({ id: "b", createdAt: "2026-10-07T00:00:00Z" }),
      pay({ id: "a", createdAt: "2026-10-05T00:00:00Z" }),
    ];
    expect(paymentsForUnit(list, 2026, 9, 1, "Unit 2").map((p) => p.id)).toEqual(["a", "b"]);
  });
});

import { normalizeDate } from "@/lib/ledger";

describe("normalizeDate", () => {
  it("understands the formats M-Pesa statements use", () => {
    expect(normalizeDate("2026-10-05 08:15:00")).toBe("05/10/2026");
    expect(normalizeDate("05/10/2026 08:15")).toBe("05/10/2026");
    expect(normalizeDate("5-10-2026")).toBe("05/10/2026");
    expect(normalizeDate("2026-1-3")).toBe("03/01/2026");
  });
  it("falls back to today in Nairobi when it can't read the date", () => {
    expect(normalizeDate("", new Date("2026-10-05T21:30:00Z"))).toBe("06/10/2026");
    expect(normalizeDate("yesterday", new Date("2026-10-05T10:00:00Z"))).toBe("05/10/2026");
  });
});
