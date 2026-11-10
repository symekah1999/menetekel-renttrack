"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabase, cloudConfigured } from "@/lib/supabase";
import { IconBuilding, IconCoins, IconChart, IconGear, IconLayers, IconGrid, IconUsers, IconChevron, IconSearch, IconActivity } from "./Icons";

// Loaded only when first opened, so it costs nothing on page load.
const CommandPalette = dynamic(() => import("./CommandPalette"), { ssr: false });
import SyncStatus from "./SyncStatus";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", Icon: IconGrid, hint: "The building this month" },
  { href: "/tenants", label: "Tenants", Icon: IconUsers, hint: "Profiles, unit by unit" },
  { href: "/collect", label: "Collect rent", Icon: IconCoins, hint: "Payments, unit by unit" },
  { href: "/activity", label: "Activity", Icon: IconActivity, hint: "Every payment as it lands", wideOnly: true },
  { href: "/cumulative", label: "Cumulative", Icon: IconLayers, hint: "Running totals for the year" },
  { href: "/reports", label: "Reports", Icon: IconChart, hint: "Monthly reports and downloads" },
  { href: "/settings", label: "Settings", Icon: IconGear, hint: "Team, backup and rents" },
];

/**
 * The signed-in app: a side panel on wide screens, a top strip and a tab bar
 * on phones. The introduction page and the sign-in page sit outside this shell.
 */
/** A pill that glides to whichever link is current. Measures the links, so it follows the rail and resizing. */
function useIndicator(path: string, deps: unknown[]) {
  const box = useRef<HTMLElement | null>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const measure = useCallback(() => {
    const el = box.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !box.current) { setStyle({ opacity: 0 }); return; }
    setStyle({
      opacity: 1,
      transform: `translate(${el.offsetLeft}px, ${el.offsetTop}px)`,
      width: el.offsetWidth,
      height: el.offsetHeight,
    });
  }, []);
  useLayoutEffect(() => { measure(); }, [path, measure, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);
  return { box, style };
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [palette, setPalette] = useState(false);
  const [paletteLoaded, setPaletteLoaded] = useState(false);
  const openPalette = useCallback(() => { setPaletteLoaded(true); setPalette(true); }, []);

  // Ctrl+K or Cmd+K anywhere, or "/" when not typing, opens the search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]");
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openPalette(); }
      else if (e.key === "/" && !typing) { e.preventDefault(); openPalette(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPalette]);
  const [email, setEmail] = useState<string | null>(null);
  // Wide screens can fold the side panel down to an icon rail; the choice is remembered.
  const [rail, setRail] = useState(false);
  useEffect(() => {
    try { setRail(localStorage.getItem("menetekel:rail") === "1"); } catch { /* ignore */ }
  }, []);
  function toggleRail() {
    setRail((r) => {
      try { localStorage.setItem("menetekel:rail", r ? "0" : "1"); } catch { /* ignore */ }
      return !r;
    });
  }

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setEmail(session?.user.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const current = (href: string) => path === href || path.startsWith(href + "/");
  const side = useIndicator(path, [rail]);
  const tabs = useIndicator(path, []);

  async function signOut() {
    await getSupabase()?.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className={`app ${rail ? "rail" : ""}`}>
      <aside className="side" aria-label="Side panel">
        <Link href="/dashboard" className="brand side-brand" aria-label="Menetekel Apartments, dashboard">
          <span className="brand-mark"><IconBuilding width={20} height={20} /></span>
          <span>
            <span className="brand-name" style={{ display: "block" }}>Menetekel</span>
            <span className="brand-sub" style={{ display: "block" }}>Apartments, Nairobi</span>
          </span>
        </Link>

        <button type="button" className="side-search" onClick={openPalette} aria-label="Search units, tenants and pages" title="Search (Ctrl+K)">
          <IconSearch /><span className="tt">Search</span><kbd className="tt">Ctrl K</kbd>
        </button>

        <nav className="side-nav" aria-label="Main" ref={side.box as React.RefObject<HTMLElement>}>
          <span className="nav-pill" aria-hidden style={side.style} />
          {LINKS.map(({ href, label, Icon, hint }) => (
            <Link key={href} href={href} className="side-link" title={label} aria-label={label} aria-current={current(href) ? "page" : undefined}>
              <Icon />
              <span>
                <span className="side-label">{label}</span>
                <span className="side-hint">{hint}</span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="side-foot">
          <button type="button" className="side-toggle" onClick={toggleRail} aria-pressed={rail}
            aria-label={rail ? "Expand the side panel" : "Collapse the side panel to icons"} title={rail ? "Expand" : "Collapse"}>
            <IconChevron dir="left" /><span className="tt">Collapse</span>
          </button>
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
          <span className="row gap-8">
            <SyncStatus />
            <button type="button" className="btn btn-line btn-icon top-search" onClick={openPalette} aria-label="Search units, tenants and pages">
              <IconSearch />
            </button>
          </span>
        </header>
        <div className="route" key={path}>{children}</div>
        <footer className="site">
          <span>Menetekel Apartments · Nairobi, Kenya</span>
          <span>Rent collected with RentTrack</span>
        </footer>
      </div>

      <nav className="tabbar" aria-label="Main" ref={tabs.box as React.RefObject<HTMLElement>}>
        <span className="tab-pill" aria-hidden style={tabs.style} />
        {LINKS.filter((l) => !("wideOnly" in l)).map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="tab" aria-current={current(href) ? "page" : undefined}>
            <Icon />
            {label.split(" ")[0]}
          </Link>
        ))}
      </nav>

      {paletteLoaded && <CommandPalette open={palette} onClose={() => setPalette(false)} />}
    </div>
  );
}
