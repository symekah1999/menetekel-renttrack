"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, cloudConfigured } from "@/lib/supabase";
import { IconBuilding, IconCheck, IconAlert, IconMail, IconLock, IconEye, IconEyeOff, IconShield, IconArrowRight } from "@/components/Icons";
import { FLOORS, TOTAL_UNITS } from "@/lib/config";
import BuildingScene from "@/components/BuildingScene";

type Mode = "signin" | "signup" | "forgot" | "recovery";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

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
    signin: ["Welcome back", "Sign in to manage rent, payments and reports for Menetekel Apartments."],
    signup: ["Create your account", "Sign up with your email. The owner approves new members before records open."],
    forgot: ["Reset your password", "Enter your email and we'll send you a secure reset link."],
    recovery: ["Choose a new password", "Use at least 8 characters, then confirm it below."],
  };
  const go = (m: Mode) => { setMode(m); setMsg(null); setShowPw(false); };
  const submitLabel =
    mode === "signin" ? "Sign in" :
    mode === "signup" ? "Create account" :
    mode === "forgot" ? "Send reset link" : "Update password";

  return (
    <div className="auth">
      <section className="auth-art" aria-hidden>
        <BuildingScene />
        <div className="auth-brand">
          <span className="auth-brand-mark"><IconBuilding width={26} height={26} /></span>
          <div>
            <span className="auth-wordmark">Menetekel</span>
            <span className="auth-tag">Apartments · Nairobi</span>
          </div>
        </div>
        <div className="auth-caption">
          <p className="auth-caption-title">Every home, every payment, on one record.</p>
          <p className="auth-caption-meta">{FLOORS.length} floors · {TOTAL_UNITS} homes · M-Pesa ready</p>
        </div>
      </section>

      <main className="auth-main">
        <div className="auth-form">
          <span className="auth-eyebrow"><IconShield width={15} height={15} /> RentTrack · Members portal</span>
          <h1 className="auth-title">{titles[mode][0]}</h1>
          <p className="auth-sub">{titles[mode][1]}</p>

          {msg && (
            <div className={`banner ${msg.ok ? "banner-ok" : "banner-bad"}`} role="alert">
              {msg.ok ? <IconCheck /> : <IconAlert />}<span>{msg.text}</span>
            </div>
          )}

          <form className="auth-fields" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
            {mode !== "recovery" && (
              <div className="field">
                <label className="field-label" htmlFor="auth-email">Email address</label>
                <div className="input-wrap">
                  <IconMail className="input-icon" />
                  <input id="auth-email" className="input has-icon" type="email" value={email} autoComplete="email" inputMode="email"
                    placeholder="you@example.com" required onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
            )}
            {mode !== "forgot" && (
              <div className="field">
                <div className="field-row">
                  <label className="field-label" htmlFor="auth-password">{mode === "recovery" ? "New password" : "Password"}</label>
                  {mode === "signin" && (
                    <button type="button" className="link-btn" onClick={() => go("forgot")}>Forgot password?</button>
                  )}
                </div>
                <div className="input-wrap">
                  <IconLock className="input-icon" />
                  <input id="auth-password" className="input has-icon has-toggle" type={showPw ? "text" : "password"} value={password} required
                    placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    onChange={(e) => setPassword(e.target.value)} />
                  <button type="button" className="input-toggle" onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw}>
                    {showPw ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
            )}
            {(mode === "signup" || mode === "recovery") && (
              <div className="field">
                <label className="field-label" htmlFor="auth-password2">Confirm password</label>
                <div className="input-wrap">
                  <IconLock className="input-icon" />
                  <input id="auth-password2" className="input has-icon" type={showPw ? "text" : "password"} value={password2}
                    autoComplete="new-password" placeholder="Type it again" required onChange={(e) => setPassword2(e.target.value)} />
                </div>
              </div>
            )}
            <button className="btn btn-primary auth-submit" disabled={busy} type="submit" aria-busy={busy}>
              {busy ? <><span className="spinner" aria-hidden /> Please wait…</> : <>{submitLabel} <IconArrowRight /></>}
            </button>
          </form>

          {mode !== "recovery" && (
            <p className="auth-switch">
              {mode === "signin" ? (
                <>New to Menetekel? <button type="button" className="link-btn" onClick={() => go("signup")}>Create an account</button></>
              ) : (
                <>{mode === "signup" ? "Already have an account?" : "Remembered it?"} <button type="button" className="link-btn" onClick={() => go("signin")}>Sign in</button></>
              )}
            </p>
          )}

          <div className="auth-note">
            <IconShield width={18} height={18} />
            <p>Approved members only. Every account shares the same building records, and new accounts need the owner&apos;s approval in Settings.</p>
          </div>
        </div>
        <footer className="auth-foot">© {new Date().getFullYear()} Menetekel Apartments · Nairobi, Kenya</footer>
      </main>
    </div>
  );
}
