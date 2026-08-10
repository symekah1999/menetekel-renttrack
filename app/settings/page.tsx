"use client";

import { useEffect, useRef, useState } from "react";
import {
  PROPERTY, FLOOR0_UNITS, FLOOR14_UNITS,
  FLOOR0_TOTAL, FLOOR14_TOTAL, GRAND_TOTAL, fmt,
} from "@/lib/config";
import { getActiveYear, setActiveYear, exportBackup, importBackup } from "@/lib/store";

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

export default function SettingsPage() {
  const [year, setYear] = useState(2026);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setYear(getActiveYear()); }, []);

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
