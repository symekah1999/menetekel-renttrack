"use client";

import Papa from "papaparse";
import { Entry, monthDue, ArrearsMap } from "./store";

export interface MpesaTxn {
  receipt: string;
  date: string;
  details: string;
  amount: number;
}

function findField(fields: string[], patterns: RegExp[]): string | null {
  for (const p of patterns) {
    const hit = fields.find((f) => p.test(f));
    if (hit) return hit;
  }
  return null;
}

export function parseMpesaCsv(text: string): { txns: MpesaTxn[]; error?: string } {
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const fields = res.meta.fields ?? [];
  if (fields.length === 0) return { txns: [], error: "No header row found in the file." };

  const fReceipt = findField(fields, [/receipt/i, /transaction\s*id/i, /^ref/i]);
  const fAmount = findField(fields, [/paid\s*in/i, /^amount$/i, /credit/i, /^in$/i]);
  const fDate = findField(fields, [/completion/i, /date|time/i]);
  const fDetails = findField(fields, [/details|description|narration|particulars/i]);

  if (!fAmount) {
    return { txns: [], error: `Could not find an amount column ("Paid In" / "Amount"). Columns found: ${fields.join(", ")}` };
  }

  const txns: MpesaTxn[] = [];
  for (const row of res.data) {
    const raw = (row[fAmount] ?? "").replace(/[^0-9.\-]/g, "");
    const amount = parseFloat(raw);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    txns.push({
      receipt: (fReceipt ? row[fReceipt] : "")?.trim() ?? "",
      date: (fDate ? row[fDate] : "")?.trim() ?? "",
      details: (fDetails ? row[fDetails] : "")?.trim() ?? "",
      amount: Math.round(amount),
    });
  }
  return { txns };
}

/**
 * Suggest a unit for each transaction:
 * 1. tenant name appears in the transaction details (unique), else
 * 2. amount exactly equals a unit's outstanding balance (unique).
 * Returns row index into `rows` or -1.
 */
export function autoMatch(txns: MpesaTxn[], rows: Entry[], arrears: ArrearsMap): number[] {
  return txns.map((t) => {
    const details = t.details.toUpperCase();
    if (details) {
      const nameHits = rows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => {
          const parts = (r.tenant || "").toUpperCase().split(/\s+/).filter((p) => p.length >= 3);
          return parts.length > 0 && parts.every((p) => details.includes(p));
        });
      if (nameHits.length === 1) return nameHits[0].i;
    }
    const amtHits = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        const outstanding = monthDue(r) + (arrears[`${r.floor}|${r.unit}`] ?? 0) - r.paid;
        return outstanding > 0 && outstanding === t.amount;
      });
    if (amtHits.length === 1) return amtHits[0].i;
    return -1;
  });
}
