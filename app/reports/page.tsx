"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FLOORS, MONTHS, PROPERTY, GRAND_TOTAL, fmt } from "@/lib/config";
import { loadMonth, monthTotals, floorTotals, MonthData } from "@/lib/store";
import { downloadExcel } from "@/lib/exportExcel";
import { downloadPdf } from "@/lib/exportPdf";

export default function ReportsPage() {
  const now = new Date();
  const initialMonth = now.getFullYear() === PROPERTY.year ? now.getMonth() : 0;
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<MonthData>([]);
  const [trend, setTrend] = useState<number[]>([]);

  useEffect(() => {
    setData(loadMonth(month));
    setTrend(MONTHS.map((_, mi) => monthTotals(loadMonth(mi)).rate));
  }, [month]);

  const gt = monthTotals(data);

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
        <select
          value={month}
          onChange={(e) => setMonth(+e.target.value)}
          style={{
            background: "var(--panel2)", color: "var(--txt)",
            border: "0.5px solid var(--line)", borderRadius: 8,
            padding: "8px 12px", fontSize: 12.5,
          }}
        >
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
              const count = f === 0 ? 6 : 7;
              return (
                <tr key={f}>
                  <td style={{ fontWeight: 600 }}>
                    Floor {f}{f === 0 && <span style={{ fontSize: 9, color: "rgba(200,169,81,0.65)" }}> (merged 6+7)</span>}
                  </td>
                  <td style={{ color: "var(--txt-3)" }}>{count}</td>
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

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingBottom: 8 }}>
        <button className="btn-gold" onClick={() => downloadExcel()}>
          ⬇ Download Excel workbook (12 months)
        </button>
        <button className="btn-outline" onClick={() => downloadPdf(month)}>
          ⬇ Download PDF summary ({MONTHS[month]})
        </button>
        <Link href="/collect" className="btn-outline">✎ Edit entries</Link>
      </div>
    </main>
  );
}
