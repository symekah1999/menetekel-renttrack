/**
 * Search that understands a building. "floor 3 unit 2" means exactly that
 * unit, not "anything containing a 3 and a 2". Every other word must be the
 * start of some word in the text, so "345" finds a phone number and "amina"
 * finds Amina, but "1" does not match "4100".
 */
export interface ParsedQuery {
  floor?: number;
  unit?: string; // normalised, e.g. "unit 6+7"
  terms: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[,·]/g, " ").replace(/\s+/g, " ").trim();

export function parseQuery(raw: string): ParsedQuery {
  let q = norm(raw);
  const out: ParsedQuery = { terms: [] };
  const f = q.match(/\bfloor\s*(\d)\b/);
  if (f) { out.floor = +f[1]; q = q.replace(f[0], " "); }
  const u = q.match(/\bunit\s*(\d+(?:\s*\+\s*\d+)?)\b/);
  if (u) { out.unit = `unit ${u[1].replace(/\s+/g, "")}`; q = q.replace(u[0], " "); }
  out.terms = q.split(/\s+/).filter(Boolean);
  return out;
}

export function isEmpty(p: ParsedQuery): boolean {
  return p.floor === undefined && p.unit === undefined && p.terms.length === 0;
}

export function matches(p: ParsedQuery, target: { floor?: number; unit?: string; text: string }): boolean {
  if (p.floor !== undefined && target.floor !== p.floor) return false;
  if (p.unit !== undefined && norm(target.unit ?? "").replace(/\s*\+\s*/g, "+") !== p.unit) return false;
  if (p.terms.length === 0) return true;
  const words = norm(target.text).split(/[^a-z0-9+]+/).filter(Boolean);
  return p.terms.every((t) => words.some((w) => w.startsWith(t)));
}
