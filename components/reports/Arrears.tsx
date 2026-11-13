"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MONTHS, PROPERTY } from "@/lib/config";
import { ageDebts, BUCKETS } from "@/lib/ageing";
import { ReportData } from "./data";
import { IconDownload } from "@/components/Icons";

/** What is owed across the year so far, by how long it has been owed. */
export default function Arrears({ d, month, setMonth }: { d: ReportData; month: number; setMonth: (m: number) => void }) {
  const asOf = useMemo(() => {
    const now = new Date();
    return month === d.current && now.getFullYear() === d.year ? now : new Date(Date.UTC(d.year, month + 1, 0));
  }, [month, d.current, d.year]);

  const rows = useMemo(() => {
    const lastFacts = [...d.facts.slice(0, month + 1)].reverse().find((f) => f.opened);
    if (!lastFacts) return [];
    return lastFacts.units.map((u) => {
      const cells = d.facts.slice(0, month + 1).filter((m) => m.opened)
        .map((m) => ({ month: m.month, balance: m.units.find((x) => x.floor === u.floor && x.unit === u.unit && x.status !== "vacant")?.balance ?? 0 }));
      const b = ageDebts(cells, d.year, PROPERTY.dueDay, asOf);
      return { floor: u.floor, unit: u.unit, tenant: u.tenant, b, total: b.reduce((s, v) => s + v, 0) };
    }).filter((r) => r.total > 0).sort((a, b) => b.b[3] - a.b[3] || b.total - a.total);
  }, [d.facts, month, d.year, asOf]);

  const sums = BUCKETS.map((_, i) => rows.reduce((s, r) => s + r.b[i], 0));
  const total = sums.reduce((s, v) => s + v, 0);

  async function csv() {
    const { downloadCsv } = await import("@/lib/reportExports");
    downloadCsv(`Menetekel_Arrears_${MONTHS[month]}_${d.year}.csv`, [
      ["Floor", "Unit", "Tenant", ...BUCKETS, "Total owed"],
      ...rows.map((r) => [r.floor, r.unit, r.tenant, ...r.b, r.total]),
      ["", "", "Whole building", ...sums, total],
    ]);
  }

  return (
    <>
      <div className="period-bar">
        <span className="small muted">Owed as at the end of</span>
        <select className="select" style={{ width: 190 }} aria-label="As at" value={month} onChange={(e) => setMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m} {d.year}</option>)}
        </select>
        <button className="btn btn-line btn-sm" disabled={rows.length === 0} onClick={csv}><IconDownload /> CSV</button>
      </div>
      <p className="muted small mb-16">Each month&apos;s unpaid balance is aged from that month&apos;s due day (the {PROPERTY.dueDay}th). Overpayments clear the oldest debt first. Older debts are harder to recover, so chase them first.</p>

      <dl className="kpis rkpis stagger">
        {BUCKETS.map((l, i) => (
          <div className="kpi" key={l}><dt>{l}</dt><dd className={sums[i] > 0 ? (i >= 2 ? "owe" : "") : "ok"}>KSh {sums[i].toLocaleString()}</dd></div>
        ))}
        <div className="kpi"><dt>Total owed</dt><dd className={total > 0 ? "owe" : "ok"}>KSh {total.toLocaleString()}</dd></div>
        <div className="kpi"><dt>Units owing</dt><dd>{rows.length}</dd></div>
      </dl>

      {total > 0 && (
        <div className="agebar mb-16" aria-hidden>
          {sums.map((v, i) => v > 0 && <i key={i} className={`a${i}`} style={{ flex: v }} title={`${BUCKETS[i]}: KSh ${v.toLocaleString()}`} />)}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card empty-state"><h3 className="h2 mb-8">Nothing owed</h3><p className="muted">Every occupied unit is clear up to {MONTHS[month]}.</p></div>
      ) : (
        <div className="tbl-wrap tall">
          <table className="data" style={{ minWidth: 760 }}>
            <thead><tr><th>Unit</th><th>Tenant</th>{BUCKETS.map((b) => <th key={b} className="right">{b}</th>)}<th className="right">Total</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.floor}${r.unit}`}>
                  <td><Link className="inline-link" href={`/collect?month=${month}&floor=${r.floor}&unit=${encodeURIComponent(r.unit)}`}>F{r.floor} · {r.unit.replace("Unit ", "")}</Link></td>
                  <td>{r.tenant || <span className="faint">No name</span>}</td>
                  {r.b.map((v, i) => <td key={i} className={`right num ${v > 0 ? (i >= 2 ? "owe strong" : "part") : "faint"}`}>{v > 0 ? v.toLocaleString() : "—"}</td>)}
                  <td className="right num strong owe">{r.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={2}>Whole building</td>{sums.map((v, i) => <td key={i} className="right num">{v.toLocaleString()}</td>)}<td className="right num owe">{total.toLocaleString()}</td></tr></tfoot>
          </table>
        </div>
      )}
    </>
  );
}
