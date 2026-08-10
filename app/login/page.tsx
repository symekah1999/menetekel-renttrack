"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, cloudConfigured } from "@/lib/supabase";

type Mode = "signin" | "signup" | "forgot" | "recovery";

const inputStyle: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.05)",
  border: "0.5px solid var(--line)", borderRadius: 8,
  padding: "11px 13px", fontSize: 13, color: "var(--txt)", outline: "none",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    // Arriving from a password-reset email switches us into recovery mode
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("recovery");
    });
    // Already signed in? Straight to work.
    sb.auth.getSession().then(({ data }) => {
      if (data.session && mode === "signin") router.replace("/collect");
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cloudConfigured()) {
    return (
      <main className="shell" style={{ paddingTop: 70, maxWidth: 520 }}>
        <div className="card card-gold" style={{ padding: 26 }}>
          <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Accounts not set up yet</h1>
          <p style={{ fontSize: 12.5, color: "var(--txt-2)", lineHeight: 1.8 }}>
            Cloud accounts need the Supabase environment variables
            (<code style={{ color: "var(--gold)" }}>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code style={{ color: "var(--gold)" }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>)
            to be added in Vercel, then a redeploy. Until then the app works in
            local mode without login.
          </p>
        </div>
      </main>
    );
  }

  async function submit() {
    const sb = getSupabase()!;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/collect");
      } else if (mode === "signup") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (password !== password2) throw new Error("Passwords do not match.");
        const { error } = await sb.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin + "/login" },
        });
        if (error) throw error;
        setMsg({ ok: true, text: "Account created. Check your email for a confirmation link, then sign in. The owner must also approve your account before records open." });
        setMode("signin");
      } else if (mode === "forgot") {
        const { error } = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/login",
        });
        if (error) throw error;
        setMsg({ ok: true, text: "Password reset link sent — check your email." });
      } else if (mode === "recovery") {
        if (password.length < 8) throw new Error("Password must be at least 8 characters.");
        if (password !== password2) throw new Error("Passwords do not match.");
        const { error } = await sb.auth.updateUser({ password });
        if (error) throw error;
        setMsg({ ok: true, text: "Password updated. You are signed in." });
        setTimeout(() => router.replace("/collect"), 900);
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  const titles: Record<Mode, [string, string]> = {
    signin: ["Welcome back", "Sign in to manage Menetekel records."],
    signup: ["Create your account", "Sign up with your email. The owner approves new members."],
    forgot: ["Reset password", "We'll email you a secure reset link."],
    recovery: ["Choose a new password", "Enter and confirm your new password."],
  };

  return (
    <main className="shell" style={{ paddingTop: 56, maxWidth: 440, paddingBottom: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div className="brand-mark" style={{ width: 52, height: 52, fontSize: 24, margin: "0 auto 12px", borderRadius: 13 }}>M</div>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: 0.5 }}>MENETEKEL APARTMENTS</div>
        <div style={{ fontSize: 10, color: "var(--txt-3)", letterSpacing: 2, textTransform: "uppercase", marginTop: 3 }}>Rent collection · Nairobi</div>
      </div>

      <div className="card card-gold" style={{ padding: 24 }}>
        <h1 style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{titles[mode][0]}</h1>
        <p style={{ fontSize: 11.5, color: "var(--txt-2)", marginBottom: 18, lineHeight: 1.6 }}>{titles[mode][1]}</p>

        {msg && (
          <div className="info-banner" style={{
            marginBottom: 14,
            borderColor: msg.ok ? "rgba(74,222,128,0.35)" : "rgba(248,113,113,0.35)",
            background: msg.ok ? "rgba(74,222,128,0.07)" : "rgba(248,113,113,0.07)",
          }}>
            {msg.text}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode !== "recovery" && (
            <input style={inputStyle} type="email" placeholder="Email address" value={email}
              autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
          )}
          {mode !== "forgot" && (
            <input style={inputStyle} type="password"
              placeholder={mode === "recovery" ? "New password (min 8 characters)" : "Password"}
              value={password} autoComplete={mode === "signin" ? "current-password" : "new-password"}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && mode === "signin") submit(); }} />
          )}
          {(mode === "signup" || mode === "recovery") && (
            <input style={inputStyle} type="password" placeholder="Confirm password"
              value={password2} autoComplete="new-password"
              onChange={(e) => setPassword2(e.target.value)} />
          )}
          <button className="btn-gold" style={{ justifyContent: "center", padding: "12px 20px" }}
            disabled={busy} onClick={submit}>
            {busy ? "Please wait…" :
              mode === "signin" ? "Sign in" :
              mode === "signup" ? "Create account" :
              mode === "forgot" ? "Send reset link" : "Update password"}
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 11.5 }}>
          {mode === "signin" ? (
            <>
              <button onClick={() => { setMode("signup"); setMsg(null); }} style={{ background: "none", border: "none", color: "var(--gold)", fontSize: 11.5 }}>
                Create an account
              </button>
              <button onClick={() => { setMode("forgot"); setMsg(null); }} style={{ background: "none", border: "none", color: "var(--txt-2)", fontSize: 11.5 }}>
                Forgot password?
              </button>
            </>
          ) : mode !== "recovery" ? (
            <button onClick={() => { setMode("signin"); setMsg(null); }} style={{ background: "none", border: "none", color: "var(--txt-2)", fontSize: 11.5 }}>
              ← Back to sign in
            </button>
          ) : <span />}
        </div>
      </div>

      <p style={{ fontSize: 10.5, color: "var(--txt-3)", textAlign: "center", marginTop: 16, lineHeight: 1.7 }}>
        All approved accounts share the same building records.<br />
        New accounts need the owner&apos;s approval (Settings → Team).
      </p>
    </main>
  );
}
