"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FLOORS, unitsForFloor, FLOOR0_TOTAL, FLOOR14_TOTAL,
  GRAND_TOTAL, TOTAL_UNITS, fmt,
} from "@/lib/config";

export default function PropertyPage() {
  const [sel, setSel] = useState(0);
  const units = unitsForFloor(sel);
  const floorTotal = sel === 0 ? FLOOR0_TOTAL : FLOOR14_TOTAL;

  return (
    <main className="shell" style={{ paddingTop: 44, paddingBottom: 24 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 36, alignItems: "center", marginBottom: 48 }}>
        <div>
          <div className="eyebrow">Est. 2026 · Residential</div>
          <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.02, letterSpacing: -1.5, marginBottom: 14 }}>
            Where every<br /><span className="gold-text">shilling counts.</span>
          </h1>
          <p className="h-sub" style={{ maxWidth: 320 }}>
            Thirty-four homes across five floors. One living ledger that tracks
            every payment, every balance, every month.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/collect" className="btn-gold">Begin collection</Link>
            <Link href="/reports" className="btn-outline">View reports</Link>
          </div>
          <div style={{ display: "flex", gap: 26, marginTop: 34 }}>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>{TOTAL_UNITS}</div><div style={{ fontSize: 9, color: "var(--txt-3)", letterSpacing: 1.5, textTransform: "uppercase" }}>Units</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 800 }}>5</div><div style={{ fontSize: 9, color: "var(--txt-3)", letterSpacing: 1.5, textTransform: "uppercase" }}>Floors</div></div>
            <div><div style={{ fontSize: 22, fontWeight: 800, color: "var(--gold)" }}>198.9K</div><div style={{ fontSize: 9, color: "var(--txt-3)", letterSpacing: 1.5, textTransform: "uppercase" }}>KShs / month</div></div>
          </div>
        </div>

        <div className="card card-gold">
          <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--txt-3)", marginBottom: 14 }}>Property snapshot</div>
          {[
            ["Floors", "5 (Floor 0 – 4)"],
            ["Floor 0 units", "6 · Unit 6+7 merged"],
            ["Floors 1–4 units", "7 each"],
            ["Total units", String(TOTAL_UNITS)],
            ["Payment mode", "M-Pesa"],
            ["Due date", "5th of every month"],
            ["Monthly target", fmt(GRAND_TOTAL)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "0.5px solid rgba(255,255,255,0.05)", fontSize: 12 }}>
              <span style={{ color: "var(--txt-2)" }}>{k}</span>
              <span style={{ fontWeight: 600, color: k === "Monthly target" ? "var(--gold)" : undefined }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="eyebrow">Structure</div>
      <h2 className="h-page" style={{ fontSize: 21 }}>Floors and unit schedule</h2>
      <p className="h-sub">Select a floor to inspect its layout. The merged Unit 6+7 on Floor 0 is marked in gold.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 16 }}>
        {FLOORS.map((f) => (
          <button
            key={f}
            onClick={() => setSel(f)}
            className="card"
            style={{
              textAlign: "center", padding: "14px 8px",
              borderColor: sel === f ? "var(--gold)" : undefined,
              background: sel === f ? "rgba(200,169,81,0.07)" : undefined,
            }}
          >
            <div style={{ fontSize: 17, fontWeight: 800, color: sel === f ? "var(--gold)" : "var(--txt-2)" }}>{f}</div>
            <div style={{ fontSize: 10, color: "var(--txt-3)", marginTop: 3 }}>{f === 0 ? "6 units" : "7 units"}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${units.length},1fr)`, gap: 6, marginBottom: 12 }}>
        {units.map((u) => (
          <div key={u.label} className={`rent-box ${u.merged ? "merged" : ""}`}>
            <div className="u">{u.label}{u.merged ? " · merged" : ""}</div>
            <div className="r">{u.rent.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="card card-gold" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--txt-3)" }}>Floor {sel} monthly total</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "var(--gold)" }}>{fmt(floorTotal)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "var(--txt-3)" }}>All floors combined</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--txt-2)" }}>{fmt(GRAND_TOTAL)} / mo</div>
        </div>
      </div>
    </main>
  );
}
