"use client";

import { useEffect, useState } from "react";
import { cloudConfigured } from "@/lib/supabase";
import { SYNC_EVENT, flushDirty, flushPayments, hasUnsyncedChanges } from "@/lib/cloud";
import { getActiveYear } from "@/lib/store";


type State = "synced" | "pending" | "offline";

/** A quiet pill: tells the manager whether what they typed has reached the cloud. */
export default function SyncStatus() {
  const [state, setState] = useState<State>("synced");

  useEffect(() => {
    if (!cloudConfigured()) return;
    let alive = true;

    const refresh = () => {
      if (!alive) return;
      if (typeof navigator !== "undefined" && !navigator.onLine) setState("offline");
      else setState(hasUnsyncedChanges() ? "pending" : "synced");
    };
    const retry = async () => {
      if (!navigator.onLine) return refresh();
      const y = getActiveYear();
      await flushDirty();
      await flushPayments([y - 1, y]);
      refresh();
    };

    refresh();
    retry();
    const t = setInterval(retry, 20_000);
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener("online", retry);
    window.addEventListener("offline", refresh);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener("online", retry);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  if (!cloudConfigured()) return null;
  const label = state === "synced" ? "Saved to cloud" : state === "pending" ? "Saving…" : "Offline — saved on this device";
  const cls = state === "synced" ? "pill-paid" : state === "pending" ? "pill-part" : "pill-owe";
  return (
    <span className={`pill ${cls}`} role="status" title="Whether your latest changes have reached the cloud">
      
      {label}
    </span>
  );
}
