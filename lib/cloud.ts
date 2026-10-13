"use client";

import { getSupabase } from "./supabase";
import type { MonthData } from "./store";
import { loadPayments, savePayments } from "./store";
import { mergeMonth, sameMonth } from "./merge";
import { Payment, fromRow, mergePayments, toRow } from "./ledger";

const PREFIX = "menetekel";
const MAX_CONFLICT_RETRIES = 3;

/** Fired on `window` whenever a sync changed what is stored locally. */
export const SYNC_EVENT = "menetekel:sync";

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SYNC_EVENT));
}

export interface Profile {
  id: string;
  email: string;
  approved: boolean;
  role: "owner" | "member";
  created_at: string;
}

/* ---------- local bookkeeping: month versions + unsynced edits ---------- */

const verKey = (y: number, m: number) => `${PREFIX}:ver:${y}:${m}`;
const DIRTY_KEY = `${PREFIX}:dirty`;
const slot = (y: number, m: number) => `${y}:${m}`;

function getVersion(y: number, m: number): string | null {
  try { return localStorage.getItem(verKey(y, m)); } catch { return null; }
}
function setVersion(y: number, m: number, v: string) {
  try { localStorage.setItem(verKey(y, m), v); } catch { /* ignore */ }
}
function readDirty(): string[] {
  try {
    const raw = localStorage.getItem(DIRTY_KEY);
    const p = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(p) ? p : [];
  } catch { return []; }
}
function writeDirty(list: string[]) {
  try { localStorage.setItem(DIRTY_KEY, JSON.stringify([...new Set(list)])); } catch { /* ignore */ }
}

export async function markDirty(y: number, m: number): Promise<void> {
  writeDirty([...readDirty(), slot(y, m)]);
}
function clearDirty(y: number, m: number) {
  writeDirty(readDirty().filter((s) => s !== slot(y, m)));
}
export function hasUnsyncedChanges(): boolean {
  return (
    readDirty().length > 0 ||
    [loadPayments(new Date().getFullYear()), loadPayments(new Date().getFullYear() - 1)]
      .flat()
      .some((p) => p.synced === false)
  );
}

function readLocalMonth(y: number, m: number): MonthData | null {
  try {
    const raw = localStorage.getItem(`${PREFIX}:${y}:${m}`);
    const parsed = raw ? (JSON.parse(raw) as MonthData) : null;
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}
function writeLocalMonth(y: number, m: number, data: MonthData) {
  try { localStorage.setItem(`${PREFIX}:${y}:${m}`, JSON.stringify(data)); } catch { /* ignore */ }
}

/* ---------- months ---------- */

/**
 * Download saved months into the local cache. Edits made on this device that
 * haven't been uploaded yet are merged in, never overwritten.
 */
export async function pullYears(years: number[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data, error } = await sb
    .from("months")
    .select("year, month, data, updated_at")
    .in("year", years);
  if (error || !data) return;

  const dirty = new Set(readDirty());
  for (const row of data as { year: number; month: number; data: MonthData; updated_at: string }[]) {
    const remote = row.data;
    if (!Array.isArray(remote)) continue;
    const local = readLocalMonth(row.year, row.month);
    if (local && dirty.has(slot(row.year, row.month))) {
      const merged = mergeMonth(local, remote);
      writeLocalMonth(row.year, row.month, merged);
      // The merge may differ from the cloud copy: keep it marked as unsent.
      if (sameMonth(merged, remote)) clearDirty(row.year, row.month);
    } else {
      writeLocalMonth(row.year, row.month, remote);
    }
    setVersion(row.year, row.month, row.updated_at);
  }
  notify();
}

type PushResult = "ok" | "offline" | "error";

/**
 * Upload one month without clobbering anyone else's edits: the update only
 * lands if the cloud copy is still the version we last saw. If it isn't, we
 * merge unit by unit and try again.
 */
export async function pushMonth(
  year: number,
  month: number,
  data: MonthData
): Promise<PushResult> {
  const sb = getSupabase();
  if (!sb) return "offline";
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return "offline";

  let payload = data;
  for (let attempt = 0; attempt <= MAX_CONFLICT_RETRIES; attempt++) {
    const seen = getVersion(year, month);
    const now = new Date().toISOString();

    if (!seen) {
      // Never synced this month: create it, or fall through to a merge.
      const { data: ins, error } = await sb
        .from("months")
        .insert({ year, month, data: payload, updated_at: now, updated_by: uid })
        .select("updated_at");
      if (!error && ins?.length) {
        setVersion(year, month, ins[0].updated_at);
        clearDirty(year, month);
        return "ok";
      }
      if (error && error.code !== "23505") return "error";
    } else {
      const { data: upd, error } = await sb
        .from("months")
        .update({ data: payload, updated_at: now, updated_by: uid })
        .eq("year", year)
        .eq("month", month)
        .eq("updated_at", seen)
        .select("updated_at");
      if (error) return "error";
      if (upd && upd.length === 1) {
        setVersion(year, month, upd[0].updated_at);
        clearDirty(year, month);
        return "ok";
      }
    }

    // Conflict: someone else saved first. Merge and go round again.
    const { data: remote, error: readErr } = await sb
      .from("months")
      .select("data, updated_at")
      .eq("year", year)
      .eq("month", month)
      .single();
    if (readErr || !remote) return "error";
    payload = mergeMonth(payload, remote.data as MonthData);
    writeLocalMonth(year, month, payload);
    setVersion(year, month, remote.updated_at as string);
    notify();
  }
  return "error";
}

/** Retry every month with unsent edits (call after reconnecting or on load). */
export async function flushDirty(): Promise<void> {
  for (const s of readDirty()) {
    const [y, m] = s.split(":").map(Number);
    const data = readLocalMonth(y, m);
    if (data) await pushMonth(y, m, data);
    else clearDirty(y, m);
  }
}

/** Push every locally-saved month (used for one-time migration to cloud). */
export async function pushAllLocal(): Promise<number> {
  const sb = getSupabase();
  if (!sb) return 0;
  let n = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    const m = k.match(new RegExp(`^${PREFIX}:(\\d{4}):(\\d{1,2})$`));
    if (!m) continue;
    const data = readLocalMonth(+m[1], +m[2]);
    if (data && (await pushMonth(+m[1], +m[2], data)) === "ok") n++;
  }
  return n;
}

/* ---------- payments ledger ---------- */

/** Download ledger rows for the given years and merge them into the local cache. */
export async function pullPayments(years: number[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data, error } = await sb
    .from("payments")
    .select("*")
    .in("year", years)
    .order("created_at", { ascending: true });
  if (error || !data) return;
  for (const y of years) {
    const remote = data.filter((r) => Number(r.year) === y).map(fromRow);
    savePayments(y, mergePayments(loadPayments(y), remote));
  }
  notify();
}

/** Upload one ledger row. Safe to repeat: the row id makes it idempotent. */
export async function pushPayment(p: Payment): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return false;
  const { error } = await sb
    .from("payments")
    .upsert({ ...toRow(p), created_by: uid }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return false;
  const list = loadPayments(p.year).map((x) => (x.id === p.id ? { ...x, synced: true } : x));
  savePayments(p.year, list);
  return true;
}

/** Add a ledger row locally first (so it shows instantly), then upload it. */
export async function addPayment(p: Payment): Promise<void> {
  const list = loadPayments(p.year);
  // Without cloud accounts there is nowhere to send it, so it is simply saved.
  savePayments(p.year, [...list, { ...p, synced: getSupabase() === null }]);
  notify();
  await pushPayment(p);
  notify();
}

/** Retry every ledger row that hasn't reached the cloud yet. */
export async function flushPayments(years: number[]): Promise<void> {
  for (const y of years) {
    for (const p of loadPayments(y)) {
      if (p.synced === false) await pushPayment(p);
    }
  }
}

/* ---------- accounts ---------- */

export async function getMyProfile(): Promise<Profile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return null;
  const { data } = await sb.from("profiles").select("*").eq("id", uid).single();
  return (data as Profile) ?? null;
}

export async function listProfiles(): Promise<Profile[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data } = await sb
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });
  return (data as Profile[]) ?? [];
}

export async function setApproved(id: string, approved: boolean): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.from("profiles").update({ approved }).eq("id", id);
  return !error;
}
