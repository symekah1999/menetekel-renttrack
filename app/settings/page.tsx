"use client";

import {
  PROPERTY, FLOOR0_UNITS, FLOOR14_UNITS,
  FLOOR0_TOTAL, FLOOR14_TOTAL, GRAND_TOTAL, fmt,
} from "@/lib/config";

export default function SettingsPage() {
  return (
    <main className="shell" style={{ paddingTop: 36, maxWidth: 760 }}>
      <div className="eyebrow">Configuration</div>
      <h1 className="h-page">Property settings</h1>
      <p className="h-sub">
        The rent schedule lives in <code style={{ color: "var(--gold)" }}>lib/config.ts</code>.
        Edit that file and redeploy to change rates — every page, export, and
        total updates automatically.
      </p>

      <div className="card" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Property details</div>
        {[
          ["Property name", PROPERTY.name],
          ["Location", PROPERTY.location],
          ["Property manager", PROPERTY.manager],
          ["Payment mode", PROPERTY.paymentMode],
          ["Due date", `${PROPERTY.dueDay}th of every month`],
          ["Active year", String(PROPERTY.year)],
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

      <div className="info-banner">
        Entries are stored in this browser (localStorage) per month. Clearing
        browser data clears the entries — download the Excel workbook regularly
        as your permanent record.
      </div>
    </main>
  );
}
