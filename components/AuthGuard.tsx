"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, cloudConfigured } from "@/lib/supabase";
import { getMyProfile, pullYears } from "@/lib/cloud";
import { getActiveYear } from "@/lib/store";

type Phase = "loading" | "local" | "unapproved" | "ready";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!cloudConfigured()) {
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
      await pullYears([y - 1, y]);
      if (!cancelled) setPhase("ready");
    }
    boot();
    return () => { cancelled = true; };
  }, [router]);

  if (phase === "loading") {
    return (
      <main className="shell" style={{ paddingTop: 90, textAlign: "center" }}>
        <div className="eyebrow" style={{ justifyContent: "center", display: "flex" }}>Menetekel</div>
        <p style={{ color: "var(--txt-2)", fontSize: 13 }}>Checking your session…</p>
      </main>
    );
  }

  if (phase === "unapproved") {
    return (
      <main className="shell" style={{ paddingTop: 70, maxWidth: 520, textAlign: "center" }}>
        <div className="card card-gold" style={{ padding: 30 }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>⏳</div>
          <h1 style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>Awaiting approval</h1>
          <p style={{ fontSize: 12.5, color: "var(--txt-2)", lineHeight: 1.8, marginBottom: 18 }}>
            Your account (<b style={{ color: "var(--gold)" }}>{email}</b>) was created
            successfully, but the property owner has to approve it before you can
            view or edit Menetekel records. Ask them to open Settings → Team.
          </p>
          <button
            className="btn-outline"
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
        <div className="shell" style={{ paddingTop: 14 }}>
          <div className="info-banner">
            Running in local mode — cloud accounts aren&apos;t configured yet
            (Supabase environment variables missing). Data stays in this browser.
          </div>
        </div>
      )}
      {children}
    </>
  );
}
