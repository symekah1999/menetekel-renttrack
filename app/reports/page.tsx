"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FLOORS, MONTHS, PROPERTY, GRAND_TOTAL, unitsForFloor, fmt } from "@/lib/config";
import { loadMonth, monthTotals, floorTotals, MonthData } from "@/lib/store";
import { downloadYearExcel, downloadFloorExcel, downloadUnitExcel } from "@/lib/exportExcel";
import { downloadMonthPdf, downloadFloorPdf, downloadUnitPdf } from "@/lib/exportPdf";

const selectStyle: React.CSSProperties = {
  background: "var(--panel2)", color: "var(--txt)",
  border: "0.5px solid var(--line)", borderRadius: 8,
  padding: "8px 12px", fontSize: 12.5,
};

export default function ReportsPage() {
  const now = new Date();
  const initialMonth = now.getFullYear() === PROPERTY.year ? now.getMonth() : 0;
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<MonthData>([]);
  const [trend, setTrend] = useState<number[]>([]);
  const [dlFloor, setDlFloor] = useState(0);
  const [dlUnit, setDlUnit] = useState("0|Unit 1");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setData(loadMonth(month));
    setTrend(MONTHS.map((_, mi) => monthTotals(loadMonth(mi)).rate));
  }, [month]);

  const gt = monthTotals(data);
  const [unitFloor, unitLabel] = dlUnit.split("|");

  async function run(key: string, fn: () => void | Promise<void>) {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  }

  const dlBtn = (key: string, label: string, fn: () => void | Promise<void>, gold = false) => (
    <button
      className={gold ? "btn-gold" : "btn-outline"}
      disabled={busy !== null}
      style={{ opacity: busy && busy !== key ? 0.5 : 1 }}
      onClick={() => run(key, fn)}
    >
      {busy === key ? "Preparing…" : label}
    </button>
  );

  return (
    <main className="shell" style={{ paddingTop: 36 }}>
      <div className="eyebrow">Summary</div>
      <h1 className="h-page">
        {MONTHS[month]} {PROPERTY.year} — <span className="gold-text">Collection report</span>
      </h1>
      <p className="h-sub">
        {PROPERTY.name} · 5 floors · 34 units · {PROPERTY.paymentMode}
      </p>

      <div style={{ marginBottom: 18 }}>
        <select value={month} onChange={(e) => setMonth(+e.target.value)} style={selectStyle}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i} style={{ color: "#000" }}>{m} {PROPERTY.year}</option>
          ))}
        </select>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="n" style={{ color: "var(--gold)" }}>{fmt(gt.required)}</div><div className="l">Total required</div></div>
        <div className="kpi"><div className="n" style={{ color: "var(--green)" }}>{fmt(gt.paid)}</div><div className="l">Collected</div></div>
        <div className="kpi"><div className="n" style={{ color: gt.balance > 0 ? "var(--red)" : "var(--green)" }}>{fmt(gt.balance)}</div><div className="l">Outstanding</div></div>
        <div className="kpi"><div className="n" style={{ color: gt.rate >= 80 ? "var(--green)" : "var(--red)" }}>{gt.rate}%</div><div className="l">Collection rate</div></div>
      </div>

      <div className="tbl-wrap" style={{ marginBottom: 22 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Floor</th><th>Units</th>
              <th style={{ textAlign: "right" }}>Required</th>
              <th style={{ textAlign: "right" }}>Collected</th>
              <th style={{ textAlign: "right" }}>Balance</th>
              <th>Rate</th>
              <th style={{ textAlign: "right" }}>Defaulters</th>
            </tr>
          </thead>
          <tbody>
            {FLOORS.map((f) => {
              const t = floorTotals(data, f);
              return (
                <tr key={f}>
                  <td style={{ fontWeight: 600 }}>
                    Floor {f}{f === 0 && <span style={{ fontSize: 9, color: "rgba(200,169,81,0.65)" }}> (merged 6+7)</span>}
                  </td>
                  <td style={{ color: "var(--txt-3)" }}>{f === 0 ? 6 : 7}</td>
                  <td style={{ textAlign: "right" }}>{t.required.toLocaleString()}</td>
                  <td style={{ textAlign: "right", color: "var(--green)" }}>{t.paid.toLocaleString()}</td>
                  <td style={{ textAlign: "right", color: t.balance > 0 ? "var(--red)" : "var(--green)" }}>
                    {t.balance > 0 ? t.balance.toLocaleString() : "—"}
                  </td>
                  <td style={{ minWidth: 90 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: t.rate >= 80 ? "var(--green)" : "var(--red)" }}>{t.rate}%</span>
                    <div className="pbar"><div className="pfill" style={{ width: `${t.rate}%`, background: t.rate >= 80 ? "var(--green)" : "var(--red)" }} /></div>
                  </td>
                  <td style={{ textAlign: "right", color: t.defaulters > 0 ? "var(--red)" : "var(--green)" }}>
                    {t.defaulters > 0 ? t.defaulters : "—"}
                  </td>
                </tr>
              );
            })}
            <tr style={{ borderTop: "0.5px solid rgba(255,255,255,0.16)" }}>
              <td colSpan={2} style={{ fontWeight: 800, color: "var(--gold)" }}>Grand total</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{gt.required.toLocaleString()}</td>
              <td style={{ textAlign: "right", fontWeight: 700, color: "var(--green)" }}>{gt.paid.toLocaleString()}</td>
              <td style={{ textAlign: "right", fontWeight: 700, color: gt.balance > 0 ? "var(--red)" : "var(--green)" }}>
                {gt.balance > 0 ? gt.balance.toLocaleString() : "—"}
              </td>
              <td style={{ fontWeight: 800 }}>{gt.rate}%</td>
              <td style={{ textAlign: "right", color: gt.defaulters > 0 ? "var(--red)" : "var(--green)" }}>
                {gt.defaulters > 0 ? gt.defaulters : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--txt-3)", marginBottom: 14 }}>
          Collection rate by month — {PROPERTY.year}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
          {trend.map((r, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                height: r > 0 ? Math.round((r / 100) * 74) + 4 : 4,
                background: r === 0 ? "rgba(255,255,255,0.08)" : r >= 80 ? "var(--blue)" : "var(--red)",
                borderRadius: "3px 3px 0 0",
              }} />
              <div style={{ fontSize: 8, color: "var(--txt-3)", marginTop: 4 }}>{MONTHS[i].slice(0, 3)}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "var(--txt-3)", marginTop: 10 }}>
          Target: {fmt(GRAND_TOTAL)} per month · bars show % collected
        </div>
      </div>

      <div className="card card-gold" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 3 }}>Download centre</div>
        <p style={{ fontSize: 11, color: "var(--txt-2)", marginBottom: 18, lineHeight: 1.6 }}>
          Styled, print-ready documents. Excel files carry the full ledger; PDFs
          include totals, defaulter lists, and signature lines.
        </p>

        <div style={{ borderBottom: "0.5px solid var(--line)", paddingBottom: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--gold)", marginBottom: 10 }}>
            Whole building
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dlBtn("yx", "⬇ Year Excel workbook (summary + 12 months)", () => downloadYearExcel(), true)}
            {dlBtn("mp", `⬇ ${MONTHS[month]} PDF report`, () => downloadMonthPdf(month))}
          </div>
        </div>

        <div style={{ borderBottom: "0.5px solid var(--line)", paddingBottom: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--gold)", marginBottom: 10 }}>
            Per floor · {MONTHS[month]}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={dlFloor} onChange={(e) => setDlFloor(+e.target.value)} style={selectStyle}>
              {FLOORS.map((f) => (
                <option key={f} value={f} style={{ color: "#000" }}>
                  Floor {f} ({f === 0 ? "6 units" : "7 units"})
                </option>
              ))}
            </select>
            {dlBtn("fx", "⬇ Floor Excel", () => downloadFloorExcel(month, dlFloor))}
            {dlBtn("fp", "⬇ Floor PDF", () => downloadFloorPdf(month, dlFloor))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--gold)", marginBottom: 10 }}>
            Individual unit · full-year statement
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={dlUnit} onChange={(e) => setDlUnit(e.target.value)} style={selectStyle}>
              {FLOORS.map((f) => (
                <optgroup key={f} label={`Floor ${f}`}>
                  {unitsForFloor(f).map((u) => (
                    <option key={`${f}|${u.label}`} value={`${f}|${u.label}`} style={{ color: "#000" }}>
                      Floor {f} · {u.label}{u.merged ? " (merged)" : ""} — KShs {u.rent.toLocaleString()}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {dlBtn("ux", "⬇ Unit statement Excel", () => downloadUnitExcel(+unitFloor, unitLabel))}
            {dlBtn("up", "⬇ Unit statement PDF", () => downloadUnitPdf(+unitFloor, unitLabel))}
          </div>
          <div style={{ fontSize: 10, color: "var(--txt-3)", marginTop: 10 }}>
            A unit statement shows all 12 months for that unit — ideal for tenant records or disputes.
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingBottom: 8 }}>
        <Link href="/collect" className="btn-outline">✎ Edit entries</Link>
        <Link href="/" className="btn-outline">← Property</Link>
      </div>
    </main>
  );
}
