import { describe, it, expect } from "vitest";
import { phaseFor, jacarandaInBloom, nairobiClock } from "@/lib/scene";

// Times below are UTC; Nairobi is three hours ahead.
const at = (iso: string) => new Date(iso);

describe("phaseFor", () => {
  it.each([
    ["2026-11-10T03:00:00Z", "dawn"],  // 06:00
    ["2026-11-10T04:30:00Z", "day"],   // 07:30
    ["2026-11-10T09:00:00Z", "day"],   // 12:00
    ["2026-11-10T14:30:00Z", "day"],   // 17:30
    ["2026-11-10T15:00:00Z", "dusk"],  // 18:00
    ["2026-11-10T16:30:00Z", "night"], // 19:30
    ["2026-11-10T21:00:00Z", "night"], // 00:00
    ["2026-11-10T02:30:00Z", "night"], // 05:30
  ])("%s is %s in Nairobi", (iso, phase) => expect(phaseFor(at(iso))).toBe(phase));

  it("uses Nairobi time, not the phone's timezone", () => {
    expect(nairobiClock(at("2026-11-10T22:15:00Z")).hour).toBeCloseTo(1.25);
  });
});

describe("jacarandaInBloom", () => {
  it("is true in October and November only", () => {
    expect(jacarandaInBloom(at("2026-10-15T09:00:00Z"))).toBe(true);
    expect(jacarandaInBloom(at("2026-11-30T09:00:00Z"))).toBe(true);
    expect(jacarandaInBloom(at("2026-12-01T09:00:00Z"))).toBe(false);
    expect(jacarandaInBloom(at("2026-06-15T09:00:00Z"))).toBe(false);
  });
  it("switches month at midnight Nairobi time", () => {
    expect(jacarandaInBloom(at("2026-09-30T21:30:00Z"))).toBe(true); // already 1 Oct in Nairobi
  });
});
