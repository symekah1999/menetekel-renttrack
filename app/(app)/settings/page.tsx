"use client";

import { useEffect, useRef, useState } from "react";
import {
  PROPERTY, FLOOR0_UNITS, FLOOR14_UNITS,
  FLOOR0_TOTAL, FLOOR14_TOTAL, GRAND_TOTAL, fmt,
} from "@/lib/config";
import { getActiveYear, setActiveYear, exportBackup, importBackup } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { getMyProfile, listProfiles, setApproved, pushAllLocal, Profile } from "@/lib/cloud";
import { loadDemoData } from "@/lib/demo";
import AuthGuard from "@/components/AuthGuard";
import { IconDownload, IconUpload, IconInfo, IconCheck } from "@/components/Icons";

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

function SettingsPageInner() {
  const [year, setYear] = useState(2026);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Profile[]>([]);
  const local = !cloudConfigured();

  useEffect(() => {
    setYear(getActiveYear());
    if (cloudConfigured()) {
      getMyProfile().then((p) => {
        setMe(p);
        if (p?.role === "owner") listProfiles().then(setTeam);
      });
    }
  }, []);

  async function toggleApproval(p: Profile) {
    const ok = await setApproved(p.id, !p.approved);
    if (ok) setTeam((t) => t.map((x) => (x.id === p.id ? { ...x, approved: !p.approved } : x)));
    else setMsg("Could not update that member. Check your connection and try again.");
  }

  async function migrateToCloud() {
    setMsg("Uploading this device's records…");
    const n = await pushAllLocal();
    setMsg(n > 0
      ? `Uploaded ${n} month record${n === 1 ? "" : "s"}. Where the cloud already had edits to the same units, the most recent edit was kept.`
      : "No local records found to upload.");
  }

  function changeYear(y: number) {
    setActiveYear(y);
    setYear(y);
    setMsg(`Active year is now ${y}. Collect and Reports now work on ${y}.`);
  }

  function doExport() {
    const json = exportBackup();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `menetekel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Backup downloaded. Keep a copy somewhere safe, such as Google Drive.");
  }

  function doImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (!confirm("Importing replaces any month or ledger that is also in the backup. Continue?")) return;
      const res = importBackup(String(reader.result ?? ""));
      setMsg(res.ok ? `Restored ${res.keys} record${res.keys === 1 ? "" : "s"}. Reload any open pages.` : `Import failed: ${res.error}`);
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  }

  function doDemo() {
    if (!confirm("Fill this browser with fictional sample tenants and payments for the year? It replaces any records already saved here.")) return;
    const y = getActiveYear();
    const month = new Date().getFullYear() === y ? new Date().getMonth() : 9;
    const n = loadDemoData(y, month);
    setMsg(`Loaded sample data: ${month + 1} months and ${n} payments, all fictional.`);
  }

  return (
    <main className="shell page" style={{ maxWidth: 780 }}>
      <h1 className="h1 mb-8">Settings</h1>
      <p className="lede mb-24">
        Accounts, backups and the rent schedule. Rents are set in <code>lib/config.ts</code>;
        change them there and redeploy.
      </p>

      {msg && (
        <div className="banner banner-ok" role="status">
          <IconCheck /><span>{msg}</span>
          <button className="x" aria-label="Dismiss" onClick={() => setMsg(null)}>✕</button>
        </div>
      )}

      {cloudConfigured() && me?.role === "owner" && (
        <section className="card mb-16" aria-labelledby="team">
          <h2 className="h2 mb-8" id="team">Team</h2>
          <p className="muted mb-16">
            Everyone who has made an account. Approved members can see and edit all building records;
            anyone else sees nothing.
          </p>
          {team.length === 0 ? (
            <p className="faint">Loading members…</p>
          ) : (
            <div className="stack gap-8">
              {team.map((p) => (
                <div key={p.id} className="member">
                  <div className="grow">
                    <div className="strong" style={{ overflowWrap: "anywhere" }}>
                      {p.email} {p.role === "owner" && <span className="pill pill-brand" style={{ marginLeft: 6 }}>Owner</span>}
                    </div>
                    <div className={`small ${p.approved ? "ok" : "owe"}`}>
                      {p.approved ? "Approved, full access" : "Waiting for approval, no access"}
                    </div>
                  </div>
                  {p.role !== "owner" && (
                    <button className={`btn btn-sm ${p.approved ? "btn-line" : "btn-primary"}`} onClick={() => toggleApproval(p)}>
                      {p.approved ? "Revoke" : "Approve"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <hr className="divider" />
          <button className="btn btn-line btn-sm" onClick={migrateToCloud}><IconUpload /> Upload this device&apos;s records</button>
          <p className="faint small mt-8">
            One-time move of everything saved in this browser to the cloud, so every approved account shares it.
            If someone already edited the same unit, the most recent edit wins.
          </p>
        </section>
      )}

      <section className="card mb-16" aria-labelledby="year">
        <h2 className="h2 mb-8" id="year">Active year</h2>
        <p className="muted mb-16">
          Each year keeps its own records. Switching to a new year leaves the old one saved, and
          tenant names and unpaid balances carry across.
        </p>
        <div className="seg" role="group" aria-label="Year">
          {YEARS.map((y) => (
            <button key={y} aria-pressed={y === year} onClick={() => changeYear(y)}>{y}</button>
          ))}
        </div>
      </section>

      <section className="card mb-16" aria-labelledby="backup">
        <h2 className="h2 mb-8" id="backup">Backup and restore</h2>
        <p className="muted mb-16">
          {local
            ? "Records live in this browser only. Export a backup regularly; it also moves your data between phone and laptop."
            : "Records are saved to the cloud and cached on this device. A downloaded backup is still worth keeping, and includes the payments ledger."}
        </p>
        <div className="row gap-8 wrap">
          <button className="btn btn-primary" onClick={doExport}><IconDownload /> Export backup</button>
          <button className="btn btn-line" onClick={() => fileRef.current?.click()}><IconUpload /> Import backup</button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }} aria-label="Choose a backup file"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); }} />
        </div>
      </section>

      {local && (
        <section className="card mb-16" aria-labelledby="demo">
          <h2 className="h2 mb-8" id="demo">Try it with sample data</h2>
          <p className="muted mb-16">
            Fills this browser with fictional tenants and payments so you can explore every screen.
            Only available while accounts aren&apos;t configured, so it can never touch real records.
          </p>
          <button className="btn btn-soft" onClick={doDemo}>Load sample data</button>
        </section>
      )}

      <section className="card mb-16" aria-labelledby="details">
        <h2 className="h2 mb-8" id="details">Property</h2>
        {[
          ["Name", PROPERTY.name],
          ["Location", PROPERTY.location],
          ["Manager", PROPERTY.manager],
          ["Payment mode", PROPERTY.paymentMode],
          ["Rent due", `The ${PROPERTY.dueDay}th of every month`],
        ].map(([k, v]) => (
          <div className="set-row" key={k}><span className="muted">{k}</span><span className="strong">{v}</span></div>
        ))}
      </section>

      <section className="card mb-16" aria-labelledby="rent0">
        <h2 className="h2 mb-8" id="rent0">Rent schedule, floor 0</h2>
        <p className="muted small mb-12">Units 6 and 7 are one merged unit at KSh 7,500.</p>
        <div className="rentgrid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {FLOOR0_UNITS.map((u) => (
            <div key={u.label} className={`rentbox ${u.merged ? "merged" : ""}`}>
              <div className="u">{u.label}{u.merged ? ", merged" : ""}</div>
              <div className="r">{u.rent.toLocaleString()}</div>
            </div>
          ))}
        </div>
        <p className="mt-12 small muted">Floor 0 total <b className="ok">{fmt(FLOOR0_TOTAL)}</b> a month</p>
      </section>

      <section className="card" aria-labelledby="rent14">
        <h2 className="h2 mb-8" id="rent14">Rent schedule, floors 1 to 4</h2>
        <p className="muted small mb-12">Seven units on each floor.</p>
        <div className="rentgrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}>
          {FLOOR14_UNITS.map((u) => (
            <div key={u.label} className="rentbox">
              <div className="u">{u.label}</div>
              <div className="r">{u.rent.toLocaleString()}</div>
            </div>
          ))}
        </div>
        <p className="mt-12 small muted">
          Per floor <b className="ok">{fmt(FLOOR14_TOTAL)}</b>. Whole building <b className="ok">{fmt(GRAND_TOTAL)}</b> a month.
        </p>
        <p className="faint small mt-8" style={{ display: "flex", gap: 8 }}><IconInfo width={16} height={16} /> These figures are added up from the rents above, so they always match what the building is set to charge.</p>
      </section>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <AuthGuard>
      <SettingsPageInner />
    </AuthGuard>
  );
}
