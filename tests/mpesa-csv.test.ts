import { describe, it, expect } from "vitest";
import { parseMpesaCsv, autoMatch } from "@/lib/mpesa";
import { blankMonth } from "@/lib/store";

const csv = [
  "Receipt No,Completion Time,Details,Paid In,Withdrawn",
  'SJK1ABC111,2026-10-05 08:15:00,"Funds received from 254712345678 - AMINA WANJIRU",4800,',
  "SJK1ABC222,2026-10-05 09:00:00,Pay Bill to supplier,,1500",
  "SJK1ABC333,2026-10-06 10:00:00,Funds received from 254799000111 - SOMEONE ELSE,7500,",
].join("\n");

describe("parseMpesaCsv", () => {
  it("keeps incoming payments and skips withdrawals", () => {
    const { txns, error } = parseMpesaCsv(csv);
    expect(error).toBeUndefined();
    expect(txns.map((t) => t.receipt)).toEqual(["SJK1ABC111", "SJK1ABC333"]);
    expect(txns[0].amount).toBe(4800);
  });

  it("explains itself when there is no amount column", () => {
    const { txns, error } = parseMpesaCsv("Foo,Bar\n1,2");
    expect(txns).toEqual([]);
    expect(error).toMatch(/amount column/i);
  });
});

describe("autoMatch", () => {
  it("matches by tenant name, then by exact outstanding amount, and skips ambiguity", () => {
    const rows = blankMonth(0, 2026);
    const i = rows.findIndex((r) => r.floor === 1 && r.unit === "Unit 2");
    rows[i] = { ...rows[i], tenant: "Amina Wanjiru" };
    const { txns } = parseMpesaCsv(csv);
    const m = autoMatch(txns, rows);
    expect(m[0]).toBe(i); // by name
    // 7,500 is the rent of several units, so it must not be guessed
    expect(m[1]).toBe(-1);
  });
});
