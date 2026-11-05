"use client";

import { useEffect, useMemo, useState } from "react";
import { FLOORS, MONTHS, unitsForFloor } from "@/lib/config";
import { blankMonth, getActiveYear, saveMonth } from "@/lib/store";
import { SYNC_EVENT } from "@/lib/cloud";
import { missingDetails, openedMonths, tenantsAsOf, unitId } from "@/lib/tenants";
import AuthGuard from "@/components/AuthGuard";
import TenantPanel from "@/components/TenantPanel";
import { IconCheck, IconPhone } from "@/components/Icons";

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

function TenantsInner() {
  const now = new Date();
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState(now.getMonth());
  const [floor, setFloor] = useState<number | "all">("all");
  const [q, setQ] = useState("");
  const [needs, setNeeds] = useState(false);
  const [open, setOpen] = useState<{ floor: number; unit: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const y = getActiveYear();
    setYear(y);
    const sp = new URLSearchParams(window.location.search);
    const m = sp.get("month");
    setMonth(m !== null && +m >= 0 && +m <= 11 ? +m : now.getFullYear() === y ? now.getMonth() : 0);
    const f = sp.get("floor"), u = sp.get("unit");
    if (f !== null && u) { setFloor(+f); setOpen({ floor: +f, unit: u }); }
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(SYNC_EVENT, bump);
    return () => window.removeEventListener(SYNC_EVENT, bump);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opened = useMemo(() => (year === null ? [] : openedMonths(year)), [year, tick]);
  const people = useMemo(() => (year === null ? null : tenantsAsOf(year, month)), [year, month, tick]);

  const cards = useMemo(() => {
    if (!people) return [];
    const out: { floor: number; unit: string; d: ReturnType<typeof tenantsAsOf> extends Map<string, infer T> ? T : never }[] = [];
    for (const f of FLOORS) for (const u of unitsForFloor(f)) out.push({ floor: f, unit: u.label, d: people.get(unitId(f, u.label))! });
    return out;
  }, [people]);

  const stats = useMemo(() => {
    let tenants = 0, vacant = 0, noPhone = 0, noName = 0;
    for (const c of cards) {
      if (c.d.vacant) { vacant++; continue; }
      const miss = missingDetails(c.d);
      if (!miss.includes("name")) tenants++; else noName++;
      if (miss.includes("phone")) noPhone++;
    }
    return { tenants, vacant, noPhone, noName };
  }, [cards]);

  const shown = cards.filter((c) => {
    if (floor !== "all" && c.floor !== floor) return false;
    if (needs && missingDetails(c.d).length === 0) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [c.unit, `floor ${c.floor}`, c.d.tenant, c.d.phone, c.d.idNo, c.d.email].some((v) => v.toLowerCase().includes(s));
  });

  function openMonth() {
    if (year === null) return;
    saveMonth(month, blankMonth(month, year), year);
    setTick((t) => t + 1);
  }

  const panelCard = open ? cards.find((c) => c.floor === open.floor && c.unit === open.unit) : null;
  const defaultFrom = opened.length === 0 ? month : [...opened].reverse().find((m) => m <= month) ?? opened[0];

  return (
    <main className="shell page" style={{ maxWidth: 1120 }}>
      <h1 className="h1 mb-8">Tenants</h1>
      <p className="lede mb-16">
        Fill in who lives in each unit once. Their name and phone then appear automatically in Collect rent, reminders, receipts
        and reports. When a tenant changes, update the unit from the month it happens; earlier months keep the old tenant.
      </p>

      {msg && (
        <div className="banner banner-ok" role="status">
          <IconCheck /><span>{msg}</span>
          <button className="x" aria-label="Dismiss" onClick={() => setMsg(null)}>✕</button>
        </div>
      )}

      {year !== null && opened.length === 0 && (
        <div className="card mb-16" style={{ textAlign: "center", padding: "28px 24px" }}>
          <h2 className="h2 mb-8">No month has been opened yet</h2>
          <p className="muted mb-16" style={{ maxWidth: "52ch", margin: "0 auto 16px" }}>
            Tenant details are saved into the months you open. Open {MONTHS[month]} to start filling them in.
          </p>
          <button className="btn btn-primary" onClick={openMonth}>Open {MONTHS[month]} {year}</button>
        </div>
      )}

      <dl className="tstats">
        <div className="kpi"><dt>Tenants on record</dt><dd>{stats.tenants}</dd></div>
        <div className="kpi"><dt>Vacant units</dt><dd>{stats.vacant}</dd></div>
        <div className="kpi"><dt>No name yet</dt><dd className={stats.noName ? "owe" : ""}>{stats.noName}</dd></div>
        <div className="kpi"><dt>No phone yet</dt><dd className={stats.noPhone ? "owe" : ""}>{stats.noPhone}</dd></div>
      </dl>

      <div className="toolbar">
        <label className="row gap-8">
          <span className="small muted">As of</span>
          <select className="select" style={{ width: 170 }} aria-label="Month shown" value={month} onChange={(e) => setMonth(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m} {year ?? ""}</option>)}
          </select>
        </label>
        <div className="seg" role="group" aria-label="Floor">
          <button aria-pressed={floor === "all"} onClick={() => setFloor("all")}>All</button>
          {FLOORS.map((f) => (
            <button key={f} aria-pressed={floor === f} onClick={() => setFloor(f)}><span className="hide-sm">Floor </span>{f}</button>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 240 }} type="search" placeholder="Search name, phone or unit" aria-label="Search tenants"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="row gap-8" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={needs} onChange={(e) => setNeeds(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--brand)" }} />
          <span>Needs details</span>
        </label>
      </div>

      {shown.length === 0 ? (
        <div className="card"><p className="muted">No units match. Clear the search or the filters.</p></div>
      ) : (
        <div className="tgrid">
          {shown.map((c) => {
            const miss = missingDetails(c.d);
            return (
              <button key={unitId(c.floor, c.unit)} type="button" className={`tcard ${c.d.vacant ? "is-vacant" : ""}`}
                onClick={() => setOpen({ floor: c.floor, unit: c.unit })}
                aria-label={`Floor ${c.floor}, ${c.unit}: ${c.d.vacant ? "vacant" : c.d.tenant || "no tenant recorded"}. Edit details`}>
                <div className="tcard-top">
                  <span className="avatar" aria-hidden>{c.d.vacant ? "–" : initials(c.d.tenant)}</span>
                  <div className="grow">
                    <div className="faint tiny" style={{ fontWeight: 700 }}>Floor {c.floor} · {c.unit}</div>
                    <div className="nm">{c.d.vacant ? "Vacant" : c.d.tenant || <span className="faint">No name yet</span>}</div>
                  </div>
                </div>
                {!c.d.vacant && (
                  <div className="meta">
                    <span className="row gap-8"><IconPhone width={15} height={15} />{c.d.phone || <span className="owe">No phone yet</span>}</span>
                    {c.d.moveIn && <span>Moved in {new Date(c.d.moveIn + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                    {c.d.deposit > 0 && <span>Deposit KSh {c.d.deposit.toLocaleString()}</span>}
                  </div>
                )}
                <div className="row gap-8 wrap">
                  {c.d.vacant ? <span className="pill pill-vacant">Vacant</span>
                    : miss.length === 0 ? <span className="pill pill-paid">Details complete</span>
                    : <span className="pill pill-part">Add {miss.join(" and ")}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {open && panelCard && year !== null && opened.length > 0 && (
        <TenantPanel
          key={`${open.floor}|${open.unit}|${month}`}
          year={year} floor={open.floor} unit={open.unit}
          current={panelCard.d} opened={opened} defaultFrom={defaultFrom}
          onClose={() => setOpen(null)}
          onSaved={(m) => { setMsg(m); setTick((t) => t + 1); }}
        />
      )}
    </main>
  );
}

export default function TenantsPage() {
  return (
    <AuthGuard>
      <TenantsInner />
    </AuthGuard>
  );
}
