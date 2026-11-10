/**
 * What the sky over the building should look like. Everything is worked out
 * in Nairobi time (EAT, UTC+3, no daylight saving) so the scene is right
 * wherever the phone thinks it is.
 */
export type Phase = "dawn" | "day" | "dusk" | "night";

/** Hour of the day in Nairobi as a decimal (17.5 = 5:30 pm), and the month (0-11). */
export function nairobiClock(d: Date = new Date()): { hour: number; month: number } {
  const eat = new Date(d.getTime() + 3 * 3600_000);
  return { hour: eat.getUTCHours() + eat.getUTCMinutes() / 60, month: eat.getUTCMonth() };
}

/** Nairobi sits almost on the equator: sunrise is about 6:30 and sunset about 18:30 all year. */
export function phaseFor(d: Date = new Date()): Phase {
  const { hour } = nairobiClock(d);
  if (hour >= 5.75 && hour < 7.25) return "dawn";
  if (hour >= 7.25 && hour < 17.75) return "day";
  if (hour >= 17.75 && hour < 19.25) return "dusk";
  return "night";
}

/** Nairobi's jacarandas flower in October and November. */
export function jacarandaInBloom(d: Date = new Date()): boolean {
  const { month } = nairobiClock(d);
  return month === 9 || month === 10;
}

export const PHASE_LABEL: Record<Phase, string> = {
  dawn: "Dawn in Nairobi",
  day: "Daytime in Nairobi",
  dusk: "Dusk in Nairobi",
  night: "Night in Nairobi",
};
