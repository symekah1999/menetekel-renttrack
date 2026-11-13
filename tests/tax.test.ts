import { describe, it, expect } from "vitest";
import { mriSchedule, mriDueDate, MRI_DEFAULT_RATE } from "@/lib/tax";

describe("MRI tax helper", () => {
  it("defaults to KRA's 7.5% and works it out on rent received", () => {
    expect(MRI_DEFAULT_RATE).toBe(7.5);
    const s = mriSchedule([{ month: 9, opened: true, amount: 30_000 }], 7.5, 2026, new Date("2026-10-01T00:00:00Z"));
    expect(s.rows[0].tax).toBe(2250); // KRA's own worked example: 7.5% of 30,000
  });
  it("is due on the 20th of the following month, January for December", () => {
    expect(mriDueDate(2026, 9).toISOString().slice(0, 10)).toBe("2026-11-20");
    expect(mriDueDate(2026, 11).toISOString().slice(0, 10)).toBe("2027-01-20");
  });
  it("marks NIL months and states against today", () => {
    const now = new Date("2026-11-12T00:00:00Z");
    const s = mriSchedule([
      { month: 8, opened: true, amount: 100_000 }, // due 20 Oct: passed
      { month: 9, opened: true, amount: 0 },       // due 20 Nov: due soon, NIL
      { month: 10, opened: true, amount: 50_000 }, // due 20 Dec: upcoming
      { month: 11, opened: false, amount: 0 },
    ], 7.5, 2026, now);
    expect(s.rows.map((r) => r.state)).toEqual(["due-passed", "due-soon", "upcoming", "not-opened"]);
    expect(s.rows[1].nil).toBe(true);
    expect(s.totalTax).toBe(7500 + 0 + 3750);
  });
  it("says whether the building falls inside the MRI band", () => {
    const at = new Date("2026-12-01T00:00:00Z");
    expect(mriSchedule([{ month: 0, opened: true, amount: 20_000 }], 7.5, 2026, at).regime).toBe("below");
    expect(mriSchedule([{ month: 0, opened: true, amount: 190_000 }], 7.5, 2026, at).regime).toBe("mri");
    expect(mriSchedule([{ month: 0, opened: true, amount: 2_000_000 }], 7.5, 2026, at).regime).toBe("above");
    expect(mriSchedule([{ month: 0, opened: false, amount: 0 }], 7.5, 2026, at).regime).toBe("unknown");
  });
});
