"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FLOORS, MONTHS, fmt } from "@/lib/config";
import {
  Entry, loadMonth, saveMonth, blankMonth, defaultDate,
  arrearsMapFor, computeTotals, monthDue, getActiveYear, whatsAppLink,
} from "@/lib/store";
import { downloadReceiptPdf } from "@/lib/exportPdf";
import { parseMpesaCsv, autoMatch, MpesaTxn } from "@/lib/mpesa";
import AuthGuard from "@/components/AuthGuard";

function CollectPageInner() {
  const [year, setYear] = useState(2026);
  const now = new Date();
  const [month, setMonth] = useState(0);
  const [floor, setFloor] = useState(0);
  const [rows, setRows] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // M-Pesa import state
  const fileRef = useRef<HTMLInputElement>(null);
  const [txns, setTxns] = useState<MpesaTxn[]>([]);
  const [assign, setAssign] = useState<number[]>([]);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  useEffect(() => {
    const y = getActiveYear();
    setYear(y);
    setMonth(now.getFullYear() === y ? now.getMonth() : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoaded(false);
    setRows(loadMonth(month));
    setTxns([]); setAssign([]); setImportMsg(null);
    setLoaded(true);
  }, [month, year]);

  useEffect(() => {
    if (!loaded) return;
    saveMonth(month, rows);
    setSavedAt(new Date().toLocaleTimeString());
  }, [rows, month, loaded]);

  const arrears = useMemo(() => (loaded ? arrearsMapFor(month) : {}), [month, loaded]);

  const floorRows = useMemo(
    () => rows.map((r, i) => ({ r, i })).filter(({ r }) => r.floor === floor),
    [rows, floor]
  );
  const ft = computeTotals(rows.filter((r) => r.floor === floor), arrears);

  function update(i: number, patch: Partial<Entry>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function clearMonth() {
    if (confirm(`Clear all ${MONTHS[month]} ${year} entries? This cannot be undone.`)) {
      setRows(blankMonth(month));
    }
  }

  /* ---- M-Pesa import ---- */
  function onCsvChosen(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const { txns: parsed, error } = parseMpesaCsv(String(reader.result ?? ""));
      if (error) { setImportMsg(error); setTxns([]); setAssign([]); return; }
      if (parsed.length === 0) { setImportMsg("No incoming payments found in that file."); setTxns([]); setAssign([]); return; }
      setTxns(parsed);
      setAssign(autoMatch(parsed, rows, arrears));
      setImportMsg(null);
    };
    reader.readAsText(file);
  }

  function applyImport() {
    let applied = 0;
    setRows((prev) => {
      const next = [...prev];
      txns.forEach((t, ti) => {
        const idx = assign[ti];
        if (idx === undefined || idx < 0 || !next[idx]) return;
        const r = next[idx];
        next[idx] = {
          ...r,
          paid: r.paid + t.amount,
          receipt: r.receipt ? r.receipt : t.receipt,
          date: t.date ? t.date.split(" ")[0] : r.date,
        };
        applied++;
      });
      return next;
    });
    setImportMsg(`Applied ${applied} payment${applied === 1 ? "" : "s"}. Review the table above.`);
    setTxns([]); setAssign([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  const selectStyle: React.CSSProperties = {
    background: "var(--panel2)", color: "var(--txt)",
    border: "0.5px solid var(--line)", borderRadius: 8,
    padding: "8px 12px", fontSize: 12.5,
  };

  return (
    <main className="shell" style={{ paddingTop: 36, maxWidth: 1080 }}>
      <div className="eyebrow">Data entry</div>
      <h1 className="h-page">
        Enter <span className="gold-text">{MONTHS[month]} {year}</span> payments
      </h1>
      <p className="h-sub">
        Balances carry forward automatically: total due = rent + water + previous
        balance. Tenant names roll over from last month. Entries autosave.
      </p>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
        <select value={month} onChange={(e) => setMonth(+e.target.value)} style={selectStyle}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i} style={{ color: "#000" }}>{m} {year}</option>
          ))}
        </select>
        {savedAt && <span className="saved-flash">Saved · {savedAt}</span>}
        <button onClick={clearMonth} className="btn-outline" style={{ marginLeft: "auto", padding: "7px 14px", fontSize: 11 }}>
          Clear month
        </button>
      </div>

      <div className="floor-tabs">
        {FLOORS.map((f) => {
          const t = computeTotals(rows.filter((r) => r.floor === f), arrears);
          const total = f === 0 ? 6 : 7;
          const done = t.fullyPaid === total && rows.some((r) => r.floor === f && r.paid > 0);
          return (
            <button key={f} className={`ftab ${floor === f ? "active" : ""} ${done ? "done" : ""}`} onClick={() => setFloor(f)}>
              Floor {f} <span style={{ fontSize: 9, opacity: 0.6 }}>({total})</span>
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
        <table className="data" style={{ minWidth: 1020 }}>
          <thead>
            <tr>
              <th>Unit</th>
              <th>Tenant</th>
              <th>Phone (WhatsApp)</th>
              <th style={{ textAlign: "right" }}>Rent</th>
              <th style={{ textAlign: "right" }}>Water/other</th>
              <th style={{ textAlign: "right" }}>Prev bal</th>
              <th style={{ textAlign: "right" }}>Total due</th>
              <th style={{ textAlign: "right" }}>Paid</th>
              <th style={{ textAlign: "right" }}>Balance</th>
              <th>Receipt</th>
              <th style={{ textAlign: "center" }}>Vacant</th>
              <th style={{ textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {floorRows.map(({ r, i }) => {
              const a = arrears[`${r.floor}|${r.unit}`] ?? 0;
              const due = monthDue(r) + a;
              const bal = due - r.paid;
              return (
                <tr key={r.unit} style={{ opacity: r.vacant ? 0.55 : 1 }}>
                  <td><span className={`badge ${r.merged ? "gold" : ""}`}>{r.unit}</span></td>
                  <td style={{ minWidth: 130 }}>
                    <input value={r.tenant} placeholder="Tenant name" disabled={r.vacant}
                      onChange={(e) => update(i, { tenant: e.target.value })} />
                  </td>
                  <td style={{ minWidth: 110 }}>
                    <input value={r.phone} placeholder="07XX…" disabled={r.vacant}
                      onChange={(e) => update(i, { phone: e.target.value })} />
                  </td>
                  <td style={{ textAlign: "right", color: "var(--gold)", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {r.vacant ? "—" : r.rent.toLocaleString()}
                  </td>
                  <td style={{ minWidth: 80 }}>
                    <input type="number" value={r.water || ""} placeholder="0" disabled={r.vacant}
                      style={{ textAlign: "right" }}
                      onChange={(e) => update(i, { water: +e.target.value || 0 })} />
                  </td>
                  <td style={{
                    textAlign: "right", whiteSpace: "nowrap",
                    color: a > 0 ? "var(--red)" : a < 0 ? "var(--green)" : "var(--txt-3)",
                  }}>
                    {a > 0 ? a.toLocaleString() : a < 0 ? `CR ${(-a).toLocaleString()}` : "—"}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>
                    {due > 0 ? due.toLocaleString() : "—"}
                  </td>
                  <td style={{ minWidth: 86 }}>
                    <input type="number" className={r.paid > 0 ? "paid-yes" : ""}
                      value={r.paid || ""} placeholder="0" style={{ textAlign: "right" }}
                      onChange={(e) => update(i, { paid: +e.target.value || 0 })} />
                  </td>
                  <td style={{
                    textAlign: "right", fontWeight: 700, whiteSpace: "nowrap",
                    color: bal <= 0 && r.paid > 0 ? "var(--green)" : bal > 0 ? "var(--red)" : "var(--txt-3)",
                  }}>
                    {bal <= 0 && r.paid > 0 ? (bal < 0 ? `CR ${(-bal).toLocaleString()}` : "Paid") : bal > 0 ? bal.toLocaleString() : "—"}
                  </td>
                  <td style={{ minWidth: 84 }}>
                    <input value={r.receipt} placeholder="MP-…" style={{ fontSize: 11 }}
                      onChange={(e) => update(i, { receipt: e.target.value })} />
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={r.vacant}
                      onChange={(e) => update(i, { vacant: e.target.checked })}
                      style={{ accentColor: "var(--gold)", width: 15, height: 15, cursor: "pointer" }} />
                  </td>
                  <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                    <button title="Download receipt (PDF)" className="btn-outline"
                      style={{ padding: "4px 8px", fontSize: 11, marginRight: 4 }}
                      disabled={r.paid <= 0}
                      onClick={() => downloadReceiptPdf(month, r, a)}>
                      🧾
                    </button>
                    <button title="WhatsApp balance reminder" className="btn-outline"
                      style={{ padding: "4px 8px", fontSize: 11 }}
                      disabled={bal <= 0 || r.vacant}
                      onClick={() => window.open(whatsAppLink(r, bal, MONTHS[month], year), "_blank")}>
                      💬
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sumbar">
        <div className="item"><div className="v">{fmt(ft.monthCharges)}</div><div className="k">Charges</div></div>
        <div className="sep" />
        <div className="item">
          <div className="v" style={{ color: ft.arrears > 0 ? "var(--red)" : "var(--green)" }}>{fmt(ft.arrears)}</div>
          <div className="k">Arrears b/f</div>
        </div>
        <div className="sep" />
        <div className="item"><div className="v">{fmt(ft.totalDue)}</div><div className="k">Total due</div></div>
        <div className="sep" />
        <div className="item"><div className="v" style={{ color: "var(--green)" }}>{fmt(ft.paid)}</div><div className="k">Collected</div></div>
        <div className="sep" />
        <div className="item">
          <div className="v" style={{ color: ft.rate >= 80 ? "var(--green)" : "var(--red)" }}>{ft.rate}%</div>
          <div className="k">Rate</div>
        </div>
        <div className="sep" />
        <div className="item"><div className="v">{ft.fullyPaid}/{floor === 0 ? 6 : 7}</div><div className="k">Clear</div></div>
      </div>

      {/* M-Pesa import */}
      <div className="card card-gold" style={{ marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 3 }}>Import M-Pesa statement (CSV)</div>
        <p style={{ fontSize: 11, color: "var(--txt-2)", marginBottom: 12, lineHeight: 1.6 }}>
          Upload the CSV export of your M-Pesa statement. Incoming payments are
          matched to units by tenant name in the transaction details, or by exact
          outstanding amount. Review the matches, fix any, then apply.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ fontSize: 12, color: "var(--txt-2)" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsvChosen(f); }}
        />
        {importMsg && (
          <div className="info-banner" style={{ marginTop: 12, marginBottom: 0 }}>{importMsg}</div>
        )}
        {txns.length > 0 && (
          <>
            <div className="tbl-wrap" style={{ marginTop: 14 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Receipt</th><th>Date</th><th>Details</th>
                    <th style={{ textAlign: "right" }}>Amount</th><th>Assign to unit</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t, ti) => (
                    <tr key={ti}>
                      <td style={{ whiteSpace: "nowrap" }}>{t.receipt || "—"}</td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 11 }}>{t.date || "—"}</td>
                      <td style={{ fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.details || "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{t.amount.toLocaleString()}</td>
                      <td>
                        <select
                          value={assign[ti] ?? -1}
                          onChange={(e) => setAssign((prev) => prev.map((v, i2) => (i2 === ti ? +e.target.value : v)))}
                          style={{ ...selectStyle, padding: "5px 8px", fontSize: 11, width: "100%" }}
                        >
                          <option value={-1} style={{ color: "#000" }}>— skip —</option>
                          {rows.map((r, ri) => (
                            <option key={ri} value={ri} style={{ color: "#000" }}>
                              Floor {r.floor} · {r.unit} {r.tenant ? `(${r.tenant})` : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button className="btn-outline" onClick={() => { setTxns([]); setAssign([]); if (fileRef.current) fileRef.current.value = ""; }}>
                Cancel
              </button>
              <button className="btn-gold" onClick={applyImport}>
                Apply {assign.filter((v) => v >= 0).length} matched payment{assign.filter((v) => v >= 0).length === 1 ? "" : "s"}
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20, paddingBottom: 8 }}>
        <Link href="/" className="btn-outline">← Property</Link>
        <Link href="/reports" className="btn-gold">Review summary →</Link>
      </div>
    </main>
  );
}


export default function CollectPage() {
  return (
    <AuthGuard>
      <CollectPageInner />
    </AuthGuard>
  );
}
