"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabase, cloudConfigured } from "@/lib/supabase";
import { IconBuilding, IconCoins, IconChart, IconGear, IconLayers, IconGrid } from "./Icons";
import SyncStatus from "./SyncStatus";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", Icon: IconGrid, hint: "The building this month" },
  { href: "/collect", label: "Collect rent", Icon: IconCoins, hint: "Payments, unit by unit" },
  { href: "/cumulative", label: "Cumulative", Icon: IconLayers, hint: "Running totals for the year" },
  { href: "/reports", label: "Reports", Icon: IconChart, hint: "Monthly reports and downloads" },
  { href: "/settings", label: "Settings", Icon: IconGear, hint: "Team, backup and rents" },
];

/**
 * The signed-in app: a side panel on wide screens, a top strip and a tab bar
 * on phones. The introduction page and the sign-in page sit outside this shell.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setEmail(session?.user.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const current = (href: string) => path === href || path.startsWith(href + "/");

  async function signOut() {
    await getSupabase()?.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="app">
      <aside className="side" aria-label="Side panel">
        <Link href="/dashboard" className="brand side-brand" aria-label="Menetekel Apartments, dashboard">
          <span className="brand-mark"><IconBuilding width={20} height={20} /></span>
          <span>
            <span className="brand-name" style={{ display: "block" }}>Menetekel</span>
            <span className="brand-sub" style={{ display: "block" }}>Apartments, Nairobi</span>
          </span>
        </Link>

        <nav className="side-nav" aria-label="Main">
          {LINKS.map(({ href, label, Icon, hint }) => (
            <Link key={href} href={href} className="side-link" aria-current={current(href) ? "page" : undefined}>
              <Icon />
              <span>
                <span className="side-label">{label}</span>
                <span className="side-hint">{hint}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="side-foot">
          <SyncStatus />
          {cloudConfigured() && email && (
            <div className="side-user">
              <span className="who" title={email}>{email}</span>
              <button className="btn btn-line btn-sm" onClick={signOut}>Sign out</button>
            </div>
          )}
          {cloudConfigured() && !email && <Link href="/login" className="btn btn-line btn-sm">Sign in</Link>}
          <Link href="/" className="side-intro">About RentTrack</Link>
        </div>
      </aside>

      <div className="app-main">
        <header className="mobile-top">
          <Link href="/dashboard" className="brand" aria-label="Menetekel Apartments, dashboard">
            <span className="brand-mark"><IconBuilding width={20} height={20} /></span>
            <span className="brand-name">Menetekel</span>
          </Link>
          <SyncStatus />
        </header>
        {children}
        <footer className="site">
          <span>Menetekel Apartments · Nairobi, Kenya</span>
          <span>Rent collected with RentTrack</span>
        </footer>
      </div>

      <nav className="tabbar" aria-label="Main">
        {LINKS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="tab" aria-current={current(href) ? "page" : undefined}>
            <Icon />
            {label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
