import type { Entry } from "./store";

const key = (e: Entry) => `${e.floor}|${e.unit}`;

/**
 * Merge two copies of the same month, unit by unit.
 *
 * Each unit row carries `ts`, the time it was last edited on any device. When
 * two devices changed the same month, the most recently edited row wins for
 * each unit, so editing Unit 3 on a phone never wipes out an edit to Unit 5
 * made on a laptop. A tie goes to the remote copy.
 */
export function mergeMonth(local: Entry[], remote: Entry[]): Entry[] {
  const localByKey = new Map(local.map((e) => [key(e), e]));
  const seen = new Set<string>();
  const out: Entry[] = [];

  for (const r of remote) {
    const k = key(r);
    seen.add(k);
    const l = localByKey.get(k);
    out.push(l && (l.ts ?? 0) > (r.ts ?? 0) ? l : r);
  }
  for (const l of local) {
    if (!seen.has(key(l))) out.push(l);
  }
  return out;
}

export function sameMonth(a: Entry[], b: Entry[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
