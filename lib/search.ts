import { isEmpty, matches, parseQuery } from "./match";

export type PaletteKind = "page" | "unit" | "action";

export interface PaletteItem {
  id: string;
  kind: PaletteKind;
  title: string;
  hint?: string;
  href: string;
  /** Extra words that should find this item (tenant name, phone). */
  keywords?: string;
  floor?: number;
  unit?: string;
}

/**
 * Rank items for the command palette. Every word typed must appear somewhere;
 * a title that starts with the query beats one that merely contains it.
 */
export function rankItems(items: PaletteItem[], query: string, limit = 12): PaletteItem[] {
  const parsed = parseQuery(query);
  if (isEmpty(parsed)) return items.filter((i) => i.kind !== "unit").slice(0, limit);
  const q = query.trim().toLowerCase().replace(/,/g, "");
  const scored: { item: PaletteItem; score: number }[] = [];
  for (const item of items) {
    // A floor or unit in the query only ever matches units.
    if ((parsed.floor !== undefined || parsed.unit !== undefined) && item.kind !== "unit") continue;
    if (!matches(parsed, { floor: item.floor, unit: item.unit, text: `${item.title} ${item.hint ?? ""} ${item.keywords ?? ""}` })) continue;
    const title = item.title.toLowerCase().replace(/,/g, "");
    let score = 0;
    if (title === q) score += 100;
    if (title.startsWith(q)) score += 50;
    if (parsed.terms[0] && title.split(/\s+/).some((w) => w.startsWith(parsed.terms[0]))) score += 20;
    if (title.includes(q)) score += 10;
    if (item.kind === "page") score += 3;
    scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map((s) => s.item);
}
