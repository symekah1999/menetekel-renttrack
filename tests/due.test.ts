import { describe, it, expect } from "vitest";
import { dueState } from "@/lib/due";

const at = (iso: string) => new Date(iso);

describe("dueState", () => {
  it("counts down to the due day", () => {
    expect(dueState(2026, 10, 5, at("2026-11-02T09:00:00Z"))).toMatchObject({ kind: "upcoming", days: 3, label: "Rent due in 3 days" });
    expect(dueState(2026, 10, 5, at("2026-11-04T09:00:00Z")).label).toBe("Rent due tomorrow");
  });
  it("says so on the day, and counts days after it", () => {
    expect(dueState(2026, 10, 5, at("2026-11-05T09:00:00Z")).kind).toBe("today");
    expect(dueState(2026, 10, 5, at("2026-11-10T09:00:00Z"))).toMatchObject({ kind: "overdue", days: 5 });
    expect(dueState(2026, 10, 5, at("2026-11-06T09:00:00Z")).label).toBe("1 day past the due date");
  });
  it("treats earlier and later months differently from the current one", () => {
    expect(dueState(2026, 9, 5, at("2026-11-10T09:00:00Z")).kind).toBe("past");
    expect(dueState(2026, 11, 5, at("2026-11-10T09:00:00Z")).kind).toBe("future");
    expect(dueState(2025, 11, 5, at("2026-01-02T09:00:00Z")).kind).toBe("past");
  });
  it("uses Nairobi's date, not UTC's", () => {
    // 22:30 UTC on 4 Nov is already 01:30 on 5 Nov in Nairobi
    expect(dueState(2026, 10, 5, at("2026-11-04T22:30:00Z")).kind).toBe("today");
  });
});
