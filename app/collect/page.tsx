"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FLOORS, MONTHS, PROPERTY, fmt } from "@/lib/config";
import {
  Entry, loadMonth, saveMonth, blankMonth, floorTotals, defaultDate,
} from "@/lib/store";

export default function CollectPage() {
  const now = new Date();
  const initialMonth = now.getFullYear() === PROPERTY.year ? now.getMonth() : 0;

  const [month, setMonth] = useState(initialMonth);
  const [floor, setFloor] = useState(0);
  const [rows, setRows] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    setRows(loadMonth(month));
    setLoaded(true);
  }, [month]);

  useEffect(() => {
    if (!loaded) return;
    saveMonth(month, rows);
    setSavedAt(new Date().toLocaleTimeString());
  }, [rows, month, loaded]);

  const floorRows = useMemo(
    () => rows.map((r, i) => ({ r, i })).filter(({ r }) => r.floor === floor),
    [rows, floor]
  );
  const ft = floorTotals(rows, floor);

  function update(i: number, patch: Partial<Entry>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function clearMonth() {
    if (confirm(`Clear all ${MONTHS[month]} entries? This cannot be undone.`)) {
      setRows(blankMonth(month));
    }
  }

  return (
    <main className="shell" style={{ paddingTop: 36 }}>
      <div className="eyebrow">Data entry</div>
      <h1 className="h-page">
        Enter <span className="gold-text">{MONTHS[month]} {PROPERTY.year}</span> payments
      </h1>
      <p className="h-sub">
        Pick a month and floor, then type the amount paid per unit. Entries save
        automatically in this browser.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <select
          value={month}
          onChange={(e) => { setLoaded(false); setMonth(+e.target.value); }}
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
        {savedAt && <span className="saved-flash">Saved · {savedAt}</span>}
        <button onClick={clearMonth} className="btn-outline" style={{ marginLeft: "auto", padding: "7px 14px", fontSize: 11 }}>
          Clear month
        </button>
      </div>

      <div className="floor-tabs">
        {FLOORS.map((f) => {
          const t = floorTotals(rows, f);
          const done = t.fullyPaid > 0 && t.fullyPaid === (f === 0 ? 6 : 7);
          return (
            <button
              key={f}
              className={`ftab ${floor === f ? "active" : ""} ${done ? "done" : ""}`}
              onClick={() => setFloor(f)}
            >
              Floor {f} <span style={{ fontSize: 9, opacity: 0.6 }}>({f === 0 ? 6 : 7})</span>
            </button>
          );
        })}
      </div>

      {floor === 0 && (
        <div className="info-banner">
          Floor 0 has 6 units — Unit 6 and Unit 7 are merged into <b>&nbsp;Unit 6+7 at KShs 7,500</b>.
        </div>
      )}

      <div className="tbl-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Tenant name</th>
              <th style={{ textAlign: "right" }}>Rent (KShs)</th>
              <th style={{ textAlign: "right" }}>Paid (KShs)</th>
              <th style={{ textAlign: "right" }}>Balance</th>
              <th>Date</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {floorRows.map(({ r, i }) => {
              const bal = r.rent - r.paid;
              return (
                <tr key={r.unit}>
                  <td><span className={`badge ${r.merged ? "gold" : ""}`}>{r.unit}</span></td>
                  <td>
                    <input
                      value={r.tenant}
                      placeholder="Tenant name"
                      onChange={(e) => update(i, { tenant: e.target.value })}
                    />
                  </td>
                  <td style={{ textAlign: "right", color: "var(--gold)", fontWeight: 600 }}>
                    {r.rent.toLocaleString()}
                  </td>
                  <td>
                    <input
                      type="number"
                      className={r.paid > 0 ? "paid-yes" : ""}
                      value={r.paid || ""}
                      placeholder="0"
                      style={{ textAlign: "right" }}
                      onChange={(e) => update(i, { paid: +e.target.value || 0 })}
                    />
                  </td>
                  <td style={{
                    textAlign: "right", fontWeight: 700,
                    color: bal === 0 && r.paid > 0 ? "var(--green)" : bal > 0 ? "var(--red)" : "var(--txt-3)",
                  }}>
                    {bal === 0 && r.paid > 0 ? "Paid" : bal > 0 ? bal.toLocaleString() : bal < 0 ? `+${(-bal).toLocaleString()}` : "—"}
                  </td>
                  <td>
                    <input
                      value={r.date}
                      style={{ fontSize: 11 }}
                      placeholder={defaultDate(month)}
                      onChange={(e) => update(i, { date: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={r.receipt}
                      placeholder={`MP-${floor}${String(i % 10)}`}
                      style={{ fontSize: 11 }}
                      onChange={(e) => update(i, { receipt: e.target.value })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sumbar">
        <div className="item"><div className="v">{fmt(ft.required)}</div><div className="k">Required</div></div>
        <div className="sep" />
        <div className="item"><div className="v">{fmt(ft.paid)}</div><div className="k">Collected</div></div>
        <div className="sep" />
        <div className="item">
          <div className="v" style={{ color: ft.balance > 0 ? "var(--red)" : "var(--green)" }}>{fmt(ft.balance)}</div>
          <div className="k">Balance</div>
        </div>
        <div className="sep" />
        <div className="item">
          <div className="v" style={{ color: ft.rate >= 80 ? "var(--green)" : "var(--red)" }}>{ft.rate}%</div>
          <div className="k">Rate</div>
        </div>
        <div className="sep" />
        <div className="item"><div className="v">{ft.fullyPaid}/{floor === 0 ? 6 : 7}</div><div className="k">Fully paid</div></div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
        <Link href="/" className="btn-outline">← Property</Link>
        <Link href="/reports" className="btn-gold">Review summary →</Link>
      </div>
    </main>
  );
}
