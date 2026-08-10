"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FLOORS, MONTHS, PROPERTY, unitsForFloor, fmt } from "@/lib/config";
import { monthTotalsFull, floorTotalsFull, getActiveYear, Totals } from "@/lib/store";
import { downloadYearExcel, downloadFloorExcel, downloadUnitExcel } from "@/lib/exportExcel";
import { downloadMonthPdf, downloadFloorPdf, downloadUnitPdf } from "@/lib/exportPdf";
import AuthGuard from "@/components/AuthGuard";

const selectStyle: React.CSSProperties = {
  background: "var(--panel2)", color: "var(--txt)",
  border: "0.5px solid var(--line)", borderRadius: 8,
  padding: "8px 12px", fontSize: 12.5,
};

const EMPTY: Totals = {
  monthCharges: 0, arrears: 0, totalDue: 0, paid: 0, balance: 0,
  rate: 100, fullyPaid: 0, defaulters: 0, occupied: 0, vacant: 0,
};

function ReportsPageInner() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(0);
  const [gt, setGt] = useState<Totals>(EMPTY);
  const [floorT, setFloorT] = useState<Totals[]>([]);
  const [trend, setTrend] = useState<number[]>([]);
  const [dlFloor, setDlFloor] = useState(0);
  const [dlUnit, setDlUnit] = useState("0|Unit 1");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const y = getActiveYear();
    setYear(y);
    const now = new Date();
    setMonth(now.getFullYear() === y ? now.getMonth() : 0);
  }, []);

  useEffect(() => {
    setGt(monthTotalsFull(month));
    setFloorT(FLOORS.map((f) => floorTotalsFull(month, f)));
    setTrend(MONTHS.map((_, mi) => monthTotalsFull(mi).rate));
  }, [month, year]);

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
        {MONTHS[month]} {year} — <span className="gold-text">Collection report</span>
      </h1>
      <p className="h-sub">
        {PROPERTY.name} · 5 floors · 34 units · {PROPERTY.paymentMode} · balances include arrears carried forward
      </p>

      <div style={{ marginBottom: 18 }}>
        <select value={month} onChange={(e) => setMonth(+e.target.value)} style={selectStyle}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i} style={{ color: "#000" }}>{m} {year}</option>
          ))}
        </select>
      </div>

      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
        <div className="kpi"><div className="n">{fmt(gt.monthCharges)}</div><div className="l">Month charges</div></div>
        <div className="kpi"><div className="n" style={{ color: gt.arrears > 0 ? "var(--red)" : "var(--green)" }}>{fmt(gt.arrears)}</div><div className="l">Arrears b/f</div></div>
        <div className="kpi"><div className="n" style={{ color: "var(--gold)" }}>{fmt(gt.totalDue)}</div><div className="l">Total due</div></div>
        <div className="kpi"><div className="n" style={{ color: "var(--green)" }}>{fmt(gt.paid)}</div><div className="l">Collected</div></div>
        <div className="kpi"><div className="n" style={{ color: gt.rate >= 80 ? "var(--green)" : "var(--red)" }}>{gt.rate}%</div><div className="l">Collection rate</div></div>
      </div>

      <div className="tbl-wrap" style={{ marginBottom: 22 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Floor</th><th>Occupied</th>
              <th style={{ textAlign: "right" }}>Charges</th>
              <th style={{ textAlign: "right" }}>Arrears</th>
              <th style={{ textAlign: "right" }}>Total due</th>
              <th style={{ textAlign: "right" }}>Collected</th>
              <th style={{ textAlign: "right" }}>Balance</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {FLOORS.map((f, fi) => {
              const t = floorT[fi] ?? EMPTY;
              return (
                <tr key={f}>
                  <td style={{ fontWeight: 600 }}>
                    Floor {f}{f === 0 && <span style={{ fontSize: 9, color: "rgba(200,169,81,0.65)" }}> (merged 6+7)</span>}
                  </td>
                  <td style={{ color: "var(--txt-3)" }}>{t.occupied}/{t.occupied + t.vacant}</td>
                  <td style={{ textAlign: "right" }}>{t.monthCharges.toLocaleString()}</td>
                  <td style={{ textAlign: "right", color: t.arrears > 0 ? "var(--red)" : "var(--txt-3)" }}>
                    {t.arrears !== 0 ? t.arrears.toLocaleString() : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>{t.totalDue.toLocaleString()}</td>
                  <td style={{ textAlign: "right", color: "var(--green)" }}>{t.paid.toLocaleString()}</td>
                  <td style={{ textAlign: "right", color: t.balance > 0 ? "var(--red)" : "var(--green)" }}>
                    {t.balance > 0 ? t.balance.toLocaleString() : "—"}
                  </td>
                  <td style={{ minWidth: 90 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: t.rate >= 80 ? "var(--green)" : "var(--red)" }}>{t.rate}%</span>
                    <div className="pbar"><div className="pfill" style={{ width: `${Math.min(t.rate, 100)}%`, background: t.rate >= 80 ? "var(--green)" : "var(--red)" }} /></div>
                  </td>
                </tr>
              );
            })}
            <tr style={{ borderTop: "0.5px solid rgba(255,255,255,0.16)" }}>
              <td style={{ fontWeight: 800, color: "var(--gold)" }}>Grand total</td>
              <td style={{ color: "var(--txt-3)" }}>{gt.occupied}/34</td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{gt.monthCharges.toLocaleString()}</td>
              <td style={{ textAlign: "right", fontWeight: 700, color: gt.arrears > 0 ? "var(--red)" : "var(--txt-3)" }}>
                {gt.arrears !== 0 ? gt.arrears.toLocaleString() : "—"}
              </td>
              <td style={{ textAlign: "right", fontWeight: 700 }}>{gt.totalDue.toLocaleString()}</td>
              <td style={{ textAlign: "right", fontWeight: 700, color: "var(--green)" }}>{gt.paid.toLocaleString()}</td>
              <td style={{ textAlign: "right", fontWeight: 700, color: gt.balance > 0 ? "var(--red)" : "var(--green)" }}>
                {gt.balance > 0 ? gt.balance.toLocaleString() : "—"}
              </td>
              <td style={{ fontWeight: 800 }}>{gt.rate}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--txt-3)", marginBottom: 14 }}>
          Collection rate by month — {year}
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
          {trend.map((r, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{
                height: r > 0 ? Math.round((Math.min(r, 100) / 100) * 74) + 4 : 4,
                background: r === 0 ? "rgba(255,255,255,0.08)" : r >= 80 ? "var(--blue)" : "var(--red)",
                borderRadius: "3px 3px 0 0",
              }} />
              <div style={{ fontSize: 8, color: "var(--txt-3)", marginTop: 4 }}>{MONTHS[i].slice(0, 3)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-gold" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 3 }}>Download centre</div>
        <p style={{ fontSize: 11, color: "var(--txt-2)", marginBottom: 18, lineHeight: 1.6 }}>
          Styled, print-ready documents with water charges, arrears, and vacancy
          reflected throughout. PDFs carry signature lines.
        </p>

        <div style={{ borderBottom: "0.5px solid var(--line)", paddingBottom: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--gold)", marginBottom: 10 }}>
            Whole building
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {dlBtn("yx", `⬇ ${year} Excel workbook (summary + 12 months)`, () => downloadYearExcel(), true)}
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
            Unit statements show rent, water, payments, and a running balance across all 12 months.
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


export default function ReportsPage() {
  return (
    <AuthGuard>
      <ReportsPageInner />
    </AuthGuard>
  );
}
