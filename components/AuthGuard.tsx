"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, cloudConfigured } from "@/lib/supabase";
import { getMyProfile, pullYears, pullPayments, flushDirty, flushPayments } from "@/lib/cloud";
import { getActiveYear } from "@/lib/store";
import { IconInfo } from "./Icons";
import LaunchMark from "./LaunchMark";

type Phase = "loading" | "local" | "unapproved" | "ready";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState("");
  // The building draws itself the first time the app opens in a session; later pages just fade in.
  // Decided after mount (never while hydrating), so the server and browser agree on the first paint.
  const [intro, setIntro] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let play = false;
    try {
      if (!sessionStorage.getItem("menetekel:launched")) {
        sessionStorage.setItem("menetekel:launched", "1");
        play = !window.matchMedia("(prefers-reduced-motion: reduce)").matches && localStorage.getItem("menetekel:calm") !== "1";
      }
    } catch { /* storage blocked: skip the intro */ }
    if (play) setIntro(true);
    const hold = new Promise<void>((ok) => setTimeout(ok, play ? 1800 : 0));
    async function boot() {
      if (!cloudConfigured()) {
        await hold;
        if (!cancelled) setPhase("local");
        return;
      }
      const sb = getSupabase()!;
      const { data } = await sb.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      setEmail(session.user.email ?? "");
      const profile = await getMyProfile();
      if (cancelled) return;
      if (!profile?.approved) {
        setPhase("unapproved");
        return;
      }
      const y = getActiveYear();
      // Send anything typed offline first, then bring down what others did.
      await flushDirty();
      await flushPayments([y - 1, y]);
      await Promise.all([pullYears([y - 1, y]), pullPayments([y - 1, y])]);
      await hold;
      if (!cancelled) setPhase("ready");
    }
    boot();
    return () => { cancelled = true; };
  }, [router]);

  if (phase === "loading" && intro) return <LaunchMark />;

  if (phase === "loading") {
    return (
      <main className="shell page" aria-busy="true" aria-live="polite">
        <span className="sr-only" role="status">Opening the building…</span>
        <div className="sk" style={{ height: 36, width: 220, marginBottom: 18 }} />
        <div className="sk" style={{ height: 64, width: "min(360px, 80%)", marginBottom: 12 }} />
        <div className="sk" style={{ height: 18, width: "min(520px, 95%)", marginBottom: 24 }} />
        <div className="sk" style={{ height: 300, borderRadius: 18 }} />
      </main>
    );
  }

  if (phase === "unapproved") {
    return (
      <main className="shell page" style={{ maxWidth: 520 }}>
        <div className="card" style={{ marginTop: 40 }}>
          <h1 className="h2 mb-8">Waiting for approval</h1>
          <p className="muted" style={{ lineHeight: 1.6, marginBottom: 18 }}>
            <b>{email}</b> is signed in, but the property owner has to approve it before you can
            see or change any rent records. Ask them to open Settings and approve you under Team.
          </p>
          <button
            className="btn btn-line"
            onClick={async () => {
              await getSupabase()?.auth.signOut();
              window.location.href = "/login";
            }}
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {phase === "local" && (
        <div className="shell" style={{ paddingTop: 16 }}>
          <div className="banner" role="note">
            <IconInfo />
            <span>
              Cloud accounts aren&apos;t set up, so records stay in this browser only. Export a backup
              from Settings now and then.
            </span>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
