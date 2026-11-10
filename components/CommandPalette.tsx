"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FLOORS, unitsForFloor } from "@/lib/config";
import { getActiveYear } from "@/lib/store";
import { tenantsAsOf, unitId } from "@/lib/tenants";
import { PaletteItem, rankItems } from "@/lib/search";
import { IconActivity, IconChart, IconCoins, IconGear, IconGrid, IconLayers, IconSearch, IconSparkle, IconUsers, IconBuilding } from "./Icons";

const PAGES: PaletteItem[] = [
  { id: "p-dashboard", kind: "page", title: "Dashboard", hint: "The building this month", href: "/dashboard", keywords: "home building" },
  { id: "p-tenants", kind: "page", title: "Tenants", hint: "Profiles, unit by unit", href: "/tenants", keywords: "people profiles" },
  { id: "p-collect", kind: "page", title: "Collect rent", hint: "Payments, unit by unit", href: "/collect", keywords: "pay mpesa" },
  { id: "p-activity", kind: "page", title: "Activity", hint: "Every payment as it lands", href: "/activity", keywords: "feed history payments" },
  { id: "p-cumulative", kind: "page", title: "Cumulative", hint: "Running totals for the year", href: "/cumulative", keywords: "arrears outstanding year" },
  { id: "p-reports", kind: "page", title: "Reports", hint: "Monthly reports and downloads", href: "/reports", keywords: "pdf excel download" },
  { id: "p-settings", kind: "page", title: "Settings", hint: "Team, backup and rents", href: "/settings", keywords: "account sign out theme" },
];

const ACTIONS: PaletteItem[] = [
  { id: "a-review", kind: "action", title: "Month in review", hint: "This month's recap and shareable picture", href: "/dashboard?review=1", keywords: "recap summary share whatsapp" },
  { id: "a-lapse", kind: "action", title: "Watch the year", hint: "Timelapse of every month", href: "/cumulative#lapse-h", keywords: "timelapse" },
  { id: "a-rents", kind: "action", title: "Change a rent", hint: "Settings, Rents", href: "/settings", keywords: "price rent edit" },
  { id: "a-backup", kind: "action", title: "Export a backup", hint: "Settings, Backup and restore", href: "/settings", keywords: "download restore" },
  { id: "a-theme", kind: "action", title: "Light or dark theme", hint: "Settings, Appearance", href: "/settings", keywords: "appearance calm mode dark light" },
];

const ICON = {
  "/dashboard": IconGrid, "/tenants": IconUsers, "/collect": IconCoins, "/activity": IconActivity,
  "/cumulative": IconLayers, "/reports": IconChart, "/settings": IconGear,
} as Record<string, typeof IconGrid>;

/** Search anything: pages, actions, every unit and its tenant. Arrow keys to move, Enter to open. */
export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const units = useMemo<PaletteItem[]>(() => {
    if (!open) return [];
    const y = getActiveYear();
    const m = new Date().getFullYear() === y ? new Date().getMonth() : 11;
    const people = tenantsAsOf(y, m);
    const out: PaletteItem[] = [];
    for (const f of FLOORS) for (const u of unitsForFloor(f)) {
      const d = people.get(unitId(f, u.label));
      out.push({
        id: `u-${f}-${u.label}`, kind: "unit", title: `Floor ${f}, ${u.label}`,
        hint: d?.vacant ? "Vacant" : d?.tenant || "No tenant recorded",
        href: `/collect?floor=${f}&unit=${encodeURIComponent(u.label)}`,
        keywords: [d?.phone, d?.idNo, d?.email].filter(Boolean).join(" "),
        floor: f, unit: u.label,
      });
    }
    return out;
  }, [open]);

  const results = useMemo(() => rankItems([...PAGES, ...ACTIONS, ...units], q, 10), [q, units]);

  useEffect(() => {
    if (!open) return;
    setQ(""); setActive(0);
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => input.current?.focus(), 20);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, [open]);
  useEffect(() => { setActive(0); }, [q]);

  if (!open) return null;

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
  }

  return (
    <div className="cmdk-wrap" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="cmdk" role="dialog" aria-modal="true" aria-label="Search">
        <div className="cmdk-field">
          <IconSearch />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search a tenant, unit, phone or page…" aria-label="Search"
            role="combobox" aria-expanded="true" aria-controls="cmdk-list"
            aria-activedescendant={results[active] ? `cmdk-${results[active].id}` : undefined} />
          <kbd>Esc</kbd>
        </div>
        <ul className="cmdk-list" id="cmdk-list" role="listbox">
          {results.length === 0 && <li className="cmdk-empty">Nothing matches “{q}”. Try a name, a phone number or “floor 2 unit 5”.</li>}
          {results.map((r, i) => {
            const Icon = r.kind === "unit" ? IconBuilding : r.kind === "action" ? IconSparkle : ICON[r.href] ?? IconGrid;
            return (
              <li key={r.id} id={`cmdk-${r.id}`} role="option" aria-selected={i === active}
                className={`cmdk-item ${i === active ? "on" : ""}`}
                onMouseEnter={() => setActive(i)} onClick={() => go(r)}>
                <span className={`cmdk-ic k-${r.kind}`}><Icon /></span>
                <span className="cmdk-text">
                  <span className="cmdk-title">{r.title}</span>
                  {r.hint && <span className="cmdk-hint">{r.hint}</span>}
                </span>
                <span className="cmdk-kind">{r.kind === "unit" ? "Unit" : r.kind === "action" ? "Action" : "Page"}</span>
              </li>
            );
          })}
        </ul>
        <div className="cmdk-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span></div>
      </div>
    </div>
  );
}
