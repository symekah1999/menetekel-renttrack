"use client";

import { getSupabase } from "./supabase";
import { SYNC_EVENT } from "./cloud";
import { Expense, expenseFromRow, expenseToRow, mergeExpenses } from "./expenses";

const key = (year: number) => `menetekel:expenses:${year}`;
const notify = () => { if (typeof window !== "undefined") window.dispatchEvent(new Event(SYNC_EVENT)); };

export function loadExpenses(year: number): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(year));
    const parsed = raw ? (JSON.parse(raw) as Expense[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export function saveExpenses(year: number, list: Expense[]): void {
  try { localStorage.setItem(key(year), JSON.stringify(list)); } catch { /* storage full or blocked */ }
}

/** Last cloud error, so the page can say why an entry is still waiting (for example, the table is missing). */
let lastError: string | null = null;
export const expensesSyncError = () => lastError;

async function push(e: Expense): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return false;
  const { error } = await sb.from("expenses").upsert({ ...expenseToRow(e), created_by: uid }, { onConflict: "id", ignoreDuplicates: true });
  if (error) { lastError = error.message; return false; }
  lastError = null;
  saveExpenses(e.year, loadExpenses(e.year).map((x) => (x.id === e.id ? { ...x, synced: true } : x)));
  return true;
}

/** Save locally first so it shows at once, then send it to the cloud. */
export async function addExpense(e: Expense): Promise<void> {
  const local = getSupabase() === null;
  saveExpenses(e.year, [...loadExpenses(e.year), { ...e, synced: local }]);
  notify();
  if (!local) { await push(e); notify(); }
}

export async function pullExpenses(years: number[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data, error } = await sb.from("expenses").select("*").in("year", years).order("created_at", { ascending: true });
  if (error || !data) { if (error) lastError = error.message; return; }
  for (const y of years) {
    saveExpenses(y, mergeExpenses(loadExpenses(y), data.filter((r) => Number(r.year) === y).map(expenseFromRow)));
  }
  notify();
}

export async function flushExpenses(years: number[]): Promise<void> {
  for (const y of years) for (const e of loadExpenses(y)) if (e.synced === false) await push(e);
}
