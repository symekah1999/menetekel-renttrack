"use client";

import { getSupabase } from "./supabase";
import type { MonthData } from "./store";

const PREFIX = "menetekel";

export interface Profile {
  id: string;
  email: string;
  approved: boolean;
  role: "owner" | "member";
  created_at: string;
}

/** Download all saved months for the given years into localStorage cache. */
export async function pullYears(years: number[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { data, error } = await sb
    .from("months")
    .select("year, month, data")
    .in("year", years);
  if (error || !data) return;
  for (const row of data) {
    try {
      localStorage.setItem(
        `${PREFIX}:${row.year}:${row.month}`,
        JSON.stringify(row.data)
      );
    } catch { /* ignore quota */ }
  }
}

/** Upsert one month to the cloud (fire-and-forget safe). */
export async function pushMonth(
  year: number,
  month: number,
  data: MonthData
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data: sess } = await sb.auth.getSession();
  const uid = sess.session?.user.id;
  if (!uid) return false;
  const { error } = await sb.from("months").upsert(
    { year, month, data, updated_at: new Date().toISOString(), updated_by: uid },
    { onConflict: "year,month" }
  );
  return !error;
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
    try {
      const data = JSON.parse(localStorage.getItem(k) ?? "null") as MonthData;
      if (Array.isArray(data) && (await pushMonth(+m[1], +m[2], data))) n++;
    } catch { /* skip bad key */ }
  }
  return n;
}

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
