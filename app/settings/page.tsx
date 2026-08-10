"use client";

import { useEffect, useRef, useState } from "react";
import {
  PROPERTY, FLOOR0_UNITS, FLOOR14_UNITS,
  FLOOR0_TOTAL, FLOOR14_TOTAL, GRAND_TOTAL, fmt,
} from "@/lib/config";
import { getActiveYear, setActiveYear, exportBackup, importBackup } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { getMyProfile, listProfiles, setApproved, pushAllLocal, Profile } from "@/lib/cloud";
import AuthGuard from "@/components/AuthGuard";

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

function SettingsPageInner() {
  const [year, setYear] = useState(2026);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [me, setMe] = useState<Profile | null>(null);
  const [team, setTeam] = useState<Profile[]>([]);

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
    setMsg("Uploading local records to the cloud…");
    const n = await pushAllLocal();
    setMsg(n > 0 ? `Uploaded ${n} month record${n === 1 ? "" : "s"} to the cloud. All signed-in devices now share them.` : "No local records found to upload.");
  }

  function changeYear(y: number) {
    setActiveYear(y);
    setYear(y);
    setMsg(`Active year is now ${y}. Collect rent and Reports pages now work on ${y} records.`);
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
    setMsg("Backup downloaded. Keep it somewhere safe (Google Drive, email to yourself).");
  }

  function doImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (!confirm("Importing will overwrite any months present in the backup. Continue?")) return;
      const res = importBackup(String(reader.result ?? ""));
      setMsg(res.ok ? `Restored ${res.keys} record${res.keys === 1 ? "" : "s"}. Reload any open pages.` : `Import failed: ${res.error}`);
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsText(file);
  }

  return (
    <main className="shell" style={{ paddingTop: 36, maxWidth: 760 }}>
      <div className="eyebrow">Configuration</div>
      <h1 className="h-page">Property settings</h1>
      <p className="h-sub">
        The rent schedule lives in <code style={{ color: "var(--gold)" }}>lib/config.ts</code> —
        edit and redeploy to change rates. Everything else is managed here.
      </p>

      {msg && <div className="info-banner">{msg}</div>}

      {cloudConfigured() && me?.role === "owner" && (
        <div className="card card-gold" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Team</div>
          <p style={{ fontSize: 11, color: "var(--txt-2)", marginBottom: 14, lineHeight: 1.6 }}>
            Everyone who has created an account. Approved members can view and
            edit all building records; unapproved accounts see nothing.
          </p>
          {team.length === 0 ? (
            <p style={{ fontSize: 11, color: "var(--txt-3)" }}>Loading members…</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {team.map((p) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "var(--panel2)",
                  border: "0.5px solid var(--line)", borderRadius: 9,
                }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600 }}>
                      {p.email}
                      {p.role === "owner" && <span className="badge gold" style={{ marginLeft: 8 }}>owner</span>}
                    </div>
                    <div style={{ fontSize: 10, color: p.approved ? "var(--green)" : "var(--red)", marginTop: 2 }}>
                      {p.approved ? "Approved — full access" : "Awaiting approval — no access"}
                    </div>
                  </div>
                  {p.role !== "owner" && (
                    <button
                      className={p.approved ? "btn-outline" : "btn-gold"}
                      style={{ padding: "7px 14px", fontSize: 11.5 }}
                      onClick={() => toggleApproval(p)}
                    >
                      {p.approved ? "Revoke access" : "Approve"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "0.5px solid var(--line)" }}>
            <button className="btn-outline" onClick={migrateToCloud} style={{ fontSize: 11.5 }}>
              ⬆ Upload this device&apos;s local records to the cloud
            </button>
            <div style={{ fontSize: 10, color: "var(--txt-3)", marginTop: 8 }}>
              One-time migration: pushes every month saved in this browser so all
              approved accounts share it. Cloud copies are overwritten.
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Active year</div>
        <p style={{ fontSize: 11, color: "var(--txt-2)", marginBottom: 12, lineHeight: 1.6 }}>
          Each year keeps its own records. To start a new year (e.g. January),
          simply switch — the old year stays saved and can be revisited any time.
          Tenant names and closing balances carry into the new year automatically.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {YEARS.map((y) => (
            <button
              key={y}
              className={y === year ? "btn-gold" : "btn-outline"}
              style={{ padding: "8px 18px" }}
              onClick={() => changeYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="card card-gold" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Backup &amp; restore</div>
        <p style={{ fontSize: 11, color: "var(--txt-2)", marginBottom: 14, lineHeight: 1.6 }}>
          Records live in this browser only. Export a backup file regularly and
          store it safely — it also moves your data between phone and laptop:
          export on one device, import on the other.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn-gold" onClick={doExport}>⬇ Export backup (JSON)</button>
          <button className="btn-outline" onClick={() => fileRef.current?.click()}>⬆ Import backup</button>
          <input
            ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); }}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Property details</div>
        {[
          ["Property name", PROPERTY.name],
          ["Location", PROPERTY.location],
          ["Property manager", PROPERTY.manager],
          ["Payment mode", PROPERTY.paymentMode],
          ["Due date", `${PROPERTY.dueDay}th of every month`],
        ].map(([k, v]) => (
          <div className="set-row" key={k}>
            <span className="set-label">{k}</span>
            <span className="set-value">{v}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
          Rent schedule — Floor 0 <span style={{ color: "var(--txt-3)", fontWeight: 400 }}>(6 units)</span>
        </div>
        <div style={{ fontSize: 10.5, color: "var(--txt-3)", marginBottom: 12 }}>
          Unit 6 and Unit 7 merged into one unit at KShs 7,500
        </div>
        <div className="rent-grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {FLOOR0_UNITS.map((u) => (
            <div key={u.label} className={`rent-box ${u.merged ? "merged" : ""}`}>
              <div className="u">{u.label}{u.merged ? " · merged" : ""}</div>
              <div className="r">{u.rent.toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--txt-2)", marginTop: 12 }}>
          Floor 0 total: <b style={{ color: "var(--gold)" }}>{fmt(FLOOR0_TOTAL)} / month</b>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
          Rent schedule — Floors 1–4 <span style={{ color: "var(--txt-3)", fontWeight: 400 }}>(7 units each)</span>
        </div>
        <div className="rent-grid" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
          {FLOOR14_UNITS.map((u) => (
            <div key={u.label} className="rent-box">
              <div className="u">{u.label}</div>
              <div className="r">{u.rent.toLocaleString()}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "var(--txt-2)", marginTop: 12 }}>
          Per floor: <b style={{ color: "var(--gold)" }}>{fmt(FLOOR14_TOTAL)} / month</b>
          {" · "}All floors: <b style={{ color: "var(--gold)" }}>{fmt(GRAND_TOTAL)} / month</b>
        </div>
      </div>
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
