"use client";

import { useState } from "react";
import Link from "next/link";
import { MONTHS } from "@/lib/config";
import { STATUS_LABEL, UnitStatus } from "@/lib/status";
import { ReportData } from "./data";
import { IconDownload } from "@/components/Icons";

const FILTERS: { id: "all" | UnitStatus; label: string }[] = [
  { id: "all", label: "All units" }, { id: "paid", label: "Paid" }, { id: "part", label: "Part-paid" },
  { id: "owe", label: "Owing" }, { id: "vacant", label: "Vacant" },
];

/** The whole building for one month: every unit, paid or in debt. */
export default function Statement({ d, month, setMonth }: { d: ReportData; month: number; setMonth: (m: number) => void }) {
  const [filter, setFilter] = useState<"all" | UnitStatus>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const f = d.facts[month];
  const s = q.trim().toLowerCase();
  const units = f.units.filter((u) => (filter === "all" || u.status === filter) && (!s || `${u.tenant} ${u.unit} floor ${u.floor}`.toLowerCase().includes(s)));

  async function dl(kind: "pdf" | "xlsx") {
    setBusy(kind);
    try {
      const m = await import("@/lib/reportExports");
      if (kind === "pdf") m.downloadBuildingStatementPdf(d.year, f);
      else await m.downloadBuildingStatementExcel(d.year, f);
    } finally { setBusy(null); }
  }

  return (
    <>
      <div className="period-bar">
        <select className="select" style={{ width: 190 }} aria-label="Month" value={month} onChange={(e) => setMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m} {d.year}{d.facts[i].opened ? "" : " (not opened)"}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" disabled={!f.opened || busy !== null} onClick={() => dl("pdf")}><IconDownload /> {busy === "pdf" ? "Preparing…" : "Statement PDF"}</button>
        <button className="btn btn-line btn-sm" disabled={!f.opened || busy !== null} onClick={() => dl("xlsx")}><IconDownload /> {busy === "xlsx" ? "Preparing…" : "Excel"}</button>
      </div>

      {!f.opened ? (
        <div className="card empty-state"><p className="muted">{MONTHS[month]} has not been opened. Open it from <Link className="inline-link" href={`/collect?month=${month}`}>Collect rent</Link>.</p></div>
      ) : (
        <>
          <dl className="kpis rkpis stagger">
            <div className="kpi"><dt>Charged</dt><dd>KSh {f.charged.toLocaleString()}</dd></div>
            <div className="kpi"><dt>Collected</dt><dd className="ok">KSh {f.collected.toLocaleString()}</dd></div>
            <div className="kpi"><dt>Still owed</dt><dd className={f.outstanding > 0 ? "owe" : "ok"}>KSh {f.outstanding.toLocaleString()}</dd></div>
            <div className="kpi"><dt>Paid in full</dt><dd className="ok">{f.clear}</dd></div>
            <div className="kpi"><dt>Part-paid / owing</dt><dd className={f.part + f.owing ? "owe" : ""}>{f.part} / {f.owing}</dd></div>
            <div className="kpi"><dt>Vacant</dt><dd>{f.vacant}</dd></div>
          </dl>

          <div className="toolbar">
            <div className="seg" role="group" aria-label="Show">
              {FILTERS.map((x) => {
                const n = x.id === "all" ? f.units.length : f.units.filter((u) => u.status === x.id).length;
                return <button key={x.id} aria-pressed={filter === x.id} onClick={() => setFilter(x.id)}>{x.label} <span className="faint">{n}</span></button>;
              })}
            </div>
            <input className="input" type="search" style={{ maxWidth: 240 }} placeholder="Search tenant or unit" aria-label="Search units" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="tbl-wrap tall">
            <table className="data" style={{ minWidth: 860 }}>
              <thead><tr><th>Unit</th><th>Tenant</th><th className="right">Due</th><th className="right">Paid</th><th className="right">Balance</th><th>Status</th><th>Last paid</th><th>Receipts</th></tr></thead>
              <tbody>
                {units.map((u) => (
                  <tr key={`${u.floor}${u.unit}`} className={u.status === "vacant" ? "is-vacant" : ""}>
                    <td><Link className="inline-link" href={`/collect?month=${month}&floor=${u.floor}&unit=${encodeURIComponent(u.unit)}`}>F{u.floor} · {u.unit.replace("Unit ", "")}</Link></td>
                    <td>{u.tenant || <span className="faint">{u.status === "vacant" ? "—" : "No name"}</span>}</td>
                    <td className="right num">{u.due ? u.due.toLocaleString() : "—"}</td>
                    <td className="right num ok">{u.paid ? u.paid.toLocaleString() : "—"}</td>
                    <td className={`right num strong ${u.balance > 0 && u.status !== "vacant" ? "owe" : "ok"}`}>
                      {u.status === "vacant" ? "—" : u.balance > 0 ? u.balance.toLocaleString() : u.balance < 0 ? `Credit ${(-u.balance).toLocaleString()}` : "0"}
                    </td>
                    <td><span className={`pill pill-${u.status}`}>{STATUS_LABEL[u.status]}</span></td>
                    <td className="faint small">{u.lastPaid || "—"}</td>
                    <td className="faint small" style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.receipts.join(" ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
              {filter === "all" && !s && (
                <tfoot><tr><td colSpan={2}>Whole building</td><td className="right num">{f.charged.toLocaleString()}</td><td className="right num ok">{f.collected.toLocaleString()}</td><td className="right num owe">{f.outstanding.toLocaleString()}</td><td colSpan={3}>{f.rate}% collected</td></tr></tfoot>
              )}
            </table>
          </div>
          {units.length === 0 && <p className="muted mt-12">No units match.</p>}
        </>
      )}
    </>
  );
}
