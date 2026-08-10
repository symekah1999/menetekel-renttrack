"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabase, cloudConfigured } from "@/lib/supabase";

const LINKS = [
  { href: "/", label: "Property" },
  { href: "/collect", label: "Collect rent" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default function Nav() {
  const path = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user.email ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (path === "/login") return null;

  return (
    <nav className="nav">
      <Link href="/" className="brand">
        <div className="brand-mark">M</div>
        <div>
          <div className="brand-name">MENETEKEL</div>
          <div className="brand-sub">Apartments · Nairobi</div>
        </div>
      </Link>
      <div className="nav-links">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link ${path === l.href ? "active" : ""}`}>
            {l.label}
          </Link>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {cloudConfigured() && (
          email ? (
            <>
              <span style={{ fontSize: 10.5, color: "var(--txt-3)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={email}>
                {email}
              </span>
              <button
                className="btn-outline"
                style={{ padding: "7px 12px", fontSize: 11.5 }}
                onClick={async () => {
                  await getSupabase()?.auth.signOut();
                  window.location.href = "/login";
                }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link href="/login" className="btn-outline" style={{ padding: "7px 14px", fontSize: 11.5 }}>
              Sign in
            </Link>
          )
        )}
        <Link href="/collect" className="btn-gold" style={{ padding: "8px 16px" }}>
          Enter rent data →
        </Link>
      </div>
    </nav>
  );
}
