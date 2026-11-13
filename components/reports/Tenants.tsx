"use client";

import { useMemo, useState } from "react";
import { FLOORS, MONTHS, unitsForFloor } from "@/lib/config";
import { ReportData } from "./data";
import { IconDownload } from "@/components/Icons";

interface Stay {
  key: string; floor: number; unit: string; tenant: string; phone: string; deposit: number; moveIn: string;
  from: number; to: number; charged: number; paid: number;
  lines: { month: number; rent: number; water: number; paid: number; receipts: string[] }[];
}

/** One statement per tenant, covering just their stay. */
export default function Tenants({ d }: { d: ReportData }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const stays = useMemo(() => {
    const out: Stay[] = [];
    for (const f of FLOORS) for (const u of unitsForFloor(f)) {
      let cur: Stay | null = null;
      for (let m = 0; m < 12; m++) {
        const row = d.rows[m]?.find((e) => e.floor === f && e.unit === u.label);
        const name = row && !row.vacant ? row.tenant.trim() : "";
        if (!row || !name) { if (cur) { out.push(cur); cur = null; } continue; }
        const line = d.facts[m].units.find((x) => x.floor === f && x.unit === u.label);
        if (!cur || cur.tenant !== name) {
          if (cur) out.push(cur);
          cur = { key: `${f}|${u.label}|${m}`, floor: f, unit: u.label, tenant: name, phone: "", deposit: 0, moveIn: "", from: m, to: m, charged: 0, paid: 0, lines: [] };
        }
        cur.to = m;
        cur.phone = row.phone; cur.deposit = row.deposit ?? 0; cur.moveIn = row.moveIn ?? "";
        cur.charged += row.rent + row.water; cur.paid += row.paid;
        cur.lines.push({ month: m, rent: row.rent, water: row.water, paid: row.paid, receipts: line?.receipts ?? [] });
      }
      if (cur) out.push(cur);
    }
    return out;
  }, [d.rows, d.facts]);

  const s = q.trim().toLowerCase();
  const shown = stays.filter((x) => !s || `${x.tenant} ${x.unit} floor ${x.floor} ${x.phone}`.toLowerCase().includes(s));

  async function statement(x: Stay) {
    setBusy(x.key);
    try {
      const { downloadTenantStatementPdf } = await import("@/lib/reportExports");
      downloadTenantStatementPdf({ year: d.year, tenant: x.tenant, floor: x.floor, unit: x.unit, phone: x.phone, deposit: x.deposit, moveIn: x.moveIn, lines: x.lines });
    } finally { setBusy(null); }
  }

  return (
    <>
      <div className="period-bar">
        <input className="input" type="search" style={{ maxWidth: 300 }} placeholder="Search tenant, unit or phone" aria-label="Search tenants" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="faint small">{shown.length} {shown.length === 1 ? "stay" : "stays"} in {d.year}</span>
      </div>
      <p className="muted small mb-16">A statement follows the person, from the month they arrived to the month they left, with the deposit held. Useful when a tenant moves out.</p>
      {shown.length === 0 ? (
        <div className="card empty-state"><p className="muted">No tenants recorded yet. Add them on the Tenants page.</p></div>
      ) : (
        <div className="tbl-wrap tall">
          <table className="data" style={{ minWidth: 720 }}>
            <thead><tr><th>Tenant</th><th>Unit</th><th>Stay</th><th className="right">Charged</th><th className="right">Paid</th><th className="right">Balance</th><th>Deposit</th><th /></tr></thead>
            <tbody>
              {shown.map((x) => {
                const bal = x.charged - x.paid;
                return (
                  <tr key={x.key}>
                    <td className="strong">{x.tenant}</td>
                    <td>F{x.floor} · {x.unit.replace("Unit ", "")}</td>
                    <td className="small">{x.from === x.to ? MONTHS[x.from].slice(0, 3) : `${MONTHS[x.from].slice(0, 3)} to ${MONTHS[x.to].slice(0, 3)}`}</td>
                    <td className="right num">{x.charged.toLocaleString()}</td>
                    <td className="right num ok">{x.paid.toLocaleString()}</td>
                    <td className={`right num strong ${bal > 0 ? "owe" : "ok"}`}>{bal > 0 ? bal.toLocaleString() : bal < 0 ? `Credit ${(-bal).toLocaleString()}` : "0"}</td>
                    <td className="small">{x.deposit ? x.deposit.toLocaleString() : <span className="faint">—</span>}</td>
                    <td className="right"><button className="btn btn-soft btn-sm" disabled={busy !== null} onClick={() => statement(x)}><IconDownload /> {busy === x.key ? "…" : "Statement"}</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
