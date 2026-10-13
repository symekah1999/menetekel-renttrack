"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, cloudConfigured } from "@/lib/supabase";
import { IconBuilding, IconCheck, IconAlert } from "@/components/Icons";

type Mode = "signin" | "signup" | "forgot" | "recovery";

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
      if (data.session && mode === "signin") router.replace("/dashboard");
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!cloudConfigured()) {
    return (
      <main className="shell page" style={{ maxWidth: 560 }}>
        <div className="card" style={{ marginTop: 48 }}>
          <h1 className="h2 mb-8">Accounts aren&apos;t set up yet</h1>
          <p className="muted" style={{ lineHeight: 1.65 }}>
            Cloud accounts need <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in
            your Vercel settings, then a redeploy. Until then the app works without a login, with records kept in this browser.
          </p>
          <a className="btn btn-primary mt-16" href="/dashboard">Open the app</a>
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
        router.replace("/dashboard");
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
        setTimeout(() => router.replace("/dashboard"), 900);
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
    <div className="auth">
      <section className="auth-art" aria-hidden>
        <div className="row gap-12">
          <span className="brand-mark" style={{ background: "rgba(255,255,255,0.14)" }}><IconBuilding width={20} height={20} /></span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19 }}>Menetekel</span>
        </div>
        <div>
          <h2>Know who has paid, floor by floor.</h2>
          <div className="mini" style={{ marginTop: 28 }}>
            {"p p p h p p o p p p p p h p p o p p p p p p p h p p p p p p p p p p o".split(" ").map((c, i) => (
              <i key={i} className={c} />
            ))}
          </div>
        </div>
        <span style={{ opacity: 0.7, fontSize: 14 }}>Menetekel Apartments, Nairobi</span>
      </section>

      <main className="auth-form">
        <h1 className="h1 mb-8" style={{ fontSize: 32 }}>{titles[mode][0]}</h1>
        <p className="lede mb-24">{titles[mode][1]}</p>

        {msg && (
          <div className={`banner ${msg.ok ? "banner-ok" : "banner-bad"}`} role="alert">
            {msg.ok ? <IconCheck /> : <IconAlert />}<span>{msg.text}</span>
          </div>
        )}

        <form className="stack gap-16" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
          {mode !== "recovery" && (
            <label className="field"><span>Email address</span>
              <input className="input" type="email" value={email} autoComplete="email" inputMode="email" required
                onChange={(e) => setEmail(e.target.value)} /></label>
          )}
          {mode !== "forgot" && (
            <label className="field"><span>{mode === "recovery" ? "New password (at least 8 characters)" : "Password"}</span>
              <input className="input" type="password" value={password} required
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                onChange={(e) => setPassword(e.target.value)} /></label>
          )}
          {(mode === "signup" || mode === "recovery") && (
            <label className="field"><span>Confirm password</span>
              <input className="input" type="password" value={password2} autoComplete="new-password" required
                onChange={(e) => setPassword2(e.target.value)} /></label>
          )}
          <button className="btn btn-primary" style={{ minHeight: 50 }} disabled={busy} type="submit">
            {busy ? "Please wait…" :
              mode === "signin" ? "Sign in" :
              mode === "signup" ? "Create account" :
              mode === "forgot" ? "Send reset link" : "Update password"}
          </button>
        </form>

        <div className="row between mt-16 small">
          {mode === "signin" ? (
            <>
              <button className="btn btn-sm" style={{ color: "var(--brand)", paddingLeft: 0 }} onClick={() => { setMode("signup"); setMsg(null); }}>Create an account</button>
              <button className="btn btn-sm" style={{ color: "var(--ink-2)" }} onClick={() => { setMode("forgot"); setMsg(null); }}>Forgot password?</button>
            </>
          ) : mode !== "recovery" ? (
            <button className="btn btn-sm" style={{ color: "var(--ink-2)", paddingLeft: 0 }} onClick={() => { setMode("signin"); setMsg(null); }}>Back to sign in</button>
          ) : <span />}
        </div>

        <p className="faint small mt-24" style={{ lineHeight: 1.6 }}>
          Every approved account shares the same building records. New accounts need the owner&apos;s approval in Settings.
        </p>
      </main>
    </div>
  );
}
