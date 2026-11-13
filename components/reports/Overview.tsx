"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { FLOORS, MONTHS, PROPERTY } from "@/lib/config";
import { change, periodFacts, MonthFacts } from "@/lib/reportData";
import { expenseTotals } from "@/lib/expenses";
import { ageDebts } from "@/lib/ageing";
import { STATUS_LABEL } from "@/lib/status";
import { ReportData, Period, PeriodKind, makePeriod, periodMonths, previousPeriod } from "./data";
import { IconDownload, IconChevron } from "@/components/Icons";

const ksh = (n: number) => `KSh ${Math.round(n).toLocaleString()}`;

function Delta({ now, before, good = "up", money = true }: { now: number; before: number | null; good?: "up" | "down"; money?: boolean }) {
  const c = change(now, before);
  if (!c || c.dir === "same") return c ? <span className="delta same">no change</span> : null;
  const better = (c.dir === "up") === (good === "up");
  return (
    <span className={`delta ${better ? "good" : "bad"}`} title="Compared with the previous period">
      {c.dir === "up" ? "▲" : "▼"} {money ? Math.abs(c.diff).toLocaleString() : `${Math.abs(c.diff)} pts`}
    </span>
  );
}

/** Collected (solid) and still owed (light) for each month, with occupancy as a line. Tap a month to report on it. */
function TrendChart({ facts, sel, onPick }: { facts: MonthFacts[]; sel: number[]; onPick: (m: number) => void }) {
  const W = 720, H = 220, P = 30, bw = (W - P * 2) / 12;
  const max = Math.max(1, ...facts.map((f) => f.collected + f.outstanding));
  const y = (v: number) => H - P - (v / max) * (H - P * 2);
  const occ = facts.map((f, i) => (f.opened ? { x: P + i * bw + bw / 2, y: P + (1 - f.occupied / Math.max(1, f.occupied + f.vacant)) * (H - P * 2) } : null));
  const line = occ.filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p!.x.toFixed(1)},${p!.y.toFixed(1)}`).join(" ");
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="trend" role="img"
        aria-label={facts.map((f) => `${MONTHS[f.month]}: ${f.opened ? `${f.collected.toLocaleString()} collected, ${f.outstanding.toLocaleString()} owed` : "not opened"}`).join("; ")}>
        {[0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1={P} x2={W - P} y1={y(max * t)} y2={y(max * t)} className="grid" />)}
        {facts.map((f, i) => {
          const x = P + i * bw + bw * 0.18, w = bw * 0.64;
          const on = sel.includes(f.month);
          return (
            <g key={i} className={`bar ${on ? "on" : ""}`} onClick={() => f.opened && onPick(f.month)} style={{ cursor: f.opened ? "pointer" : "default" }}>
              <rect x={P + i * bw} y={P} width={bw} height={H - P * 2} className="hit" />
              {f.opened ? (
                <>
                  <rect x={x} y={y(f.collected)} width={w} height={H - P - y(f.collected)} rx="3" className="paid" />
                  <rect x={x} y={y(f.collected + f.outstanding)} width={w} height={y(f.collected) - y(f.collected + f.outstanding)} rx="3" className="owed" />
                </>
              ) : <rect x={x} y={H - P - 3} width={w} height={3} rx="1.5" className="none" />}
              <text x={P + i * bw + bw / 2} y={H - 10} className="lbl">{MONTHS[i].slice(0, 3)}</text>
            </g>
          );
        })}
        {line && <path d={line} className="occ" />}
        {occ.map((p, i) => p && <circle key={i} cx={p.x} cy={p.y} r="3.2" className="occ-dot" />)}
      </svg>
      <div className="chart-legend">
        <span><i className="k-paid" />Collected</span><span><i className="k-owed" />Still owed</span><span><i className="k-occ" />Occupancy</span>
        <span className="faint">Tap a month to report on it</span>
      </div>
    </div>
  );
}

export default function Overview({ d, period, setPeriod }: { d: ReportData; period: Period; setPeriod: (p: Period) => void }) {
  const [openFloor, setOpenFloor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const months = periodMonths(period);
  const prev = previousPeriod(period);
  const now = useMemo(() => periodFacts(months.map((m) => d.facts[m])), [d.facts, months.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const before = useMemo(() => (prev ? periodFacts(periodMonths(prev).map((m) => d.facts[m])) : null), [d.facts, prev?.from, prev?.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const spent = expenseTotals(d.expenses, months);
  const spentBefore = prev ? expenseTotals(d.expenses, periodMonths(prev)).total : null;
  const single = months.length === 1 ? d.facts[months[0]] : null;
  const label = period.kind === "month" ? `${MONTHS[period.from]} ${d.year}`
    : period.kind === "quarter" ? `Q${Math.floor(period.from / 3) + 1} ${d.year}`
    : period.kind === "ytd" ? `January to ${MONTHS[period.to]} ${d.year}` : `${MONTHS[period.from]} to ${MONTHS[period.to]} ${d.year}`;
  const anchor = period.to;
  const t = now.timing;
  const pct = (n: number) => (now.charged > 0 ? Math.round((n / now.charged) * 100) : 0);
  const chTotal = now.channels.stk + now.channels.manual + now.channels.csv + now.channels.earlier;

  async function ownerReport() {
    setBusy(true);
    try {
      const asOf = new Date(Date.UTC(d.year, period.to + 1, 0));
      const ageing: [number, number, number, number] = [0, 0, 0, 0];
      const owing: { floor: number; unit: string; tenant: string; balance: number }[] = [];
      for (const f of FLOORS) {
        for (const u of d.facts[period.to].units.filter((x) => x.floor === f)) {
          const cells = d.facts.slice(0, period.to + 1).filter((m) => m.opened).map((m) => ({ month: m.month, balance: m.units.find((x) => x.floor === f && x.unit === u.unit)?.balance ?? 0 }));
          const b = ageDebts(cells, d.year, PROPERTY.dueDay, asOf);
          b.forEach((v, i) => (ageing[i] += v));
          const tot = b.reduce((s, v) => s + v, 0);
          if (tot > 0) owing.push({ floor: f, unit: u.unit, tenant: u.tenant, balance: tot });
        }
      }
      owing.sort((a, b) => b.balance - a.balance);
      const { downloadOwnerReportPdf } = await import("@/lib/reportExports");
      downloadOwnerReportPdf({ year: d.year, label, now, before, ageing, expenses: spent, topOwing: owing });
    } finally { setBusy(false); }
  }

  return (
    <>
      <div className="period-bar">
        <div className="seg" role="group" aria-label="Period">
          {([["month", "Month"], ["quarter", "Quarter"], ["ytd", "Year so far"], ["custom", "Custom"]] as [PeriodKind, string][]).map(([k, l]) => (
            <button key={k} aria-pressed={period.kind === k} onClick={() => setPeriod(makePeriod(k, anchor, period.from, period.to))}>{l}</button>
          ))}
        </div>
        {period.kind === "custom" ? (
          <span className="row gap-8">
            <select className="select" aria-label="From" value={period.from} onChange={(e) => setPeriod(makePeriod("custom", anchor, +e.target.value, period.to))}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <span className="faint">to</span>
            <select className="select" aria-label="To" value={period.to} onChange={(e) => setPeriod(makePeriod("custom", anchor, period.from, +e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
          </span>
        ) : (
          <select className="select" style={{ width: 190 }} aria-label="Ending" value={anchor} onChange={(e) => setPeriod(makePeriod(period.kind, +e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{period.kind === "quarter" ? `Q${Math.floor(i / 3) + 1} (${m})` : `${m} ${d.year}`}</option>)}
          </select>
        )}
        <button className="btn btn-primary btn-sm" disabled={!now.opened || busy} onClick={ownerReport}><IconDownload /> {busy ? "Preparing…" : "Owner report (PDF)"}</button>
      </div>

      <h2 className="h2 mb-12">{label}</h2>
      {!now.opened ? (
        <div className="card empty-state"><p className="muted">No month in this period has been opened yet. Open one from <Link className="inline-link" href="/collect">Collect rent</Link>.</p></div>
      ) : (
        <>
          <dl className="kpis rkpis stagger">
            <div className="kpi"><dt>Collected</dt><dd className="ok">{ksh(now.collected)}</dd><Delta now={now.collected} before={before?.collected ?? null} /></div>
            <div className="kpi"><dt>Collection rate</dt><dd>{now.rate}%</dd><Delta now={now.rate} before={before?.rate ?? null} money={false} /></div>
            <div className="kpi"><dt>Still owed</dt><dd className={now.outstanding > 0 ? "owe" : "ok"}>{ksh(now.outstanding)}</dd><Delta now={now.outstanding} before={before?.outstanding ?? null} good="down" /></div>
            <div className="kpi"><dt>Occupancy</dt><dd>{now.occupancy}%</dd><Delta now={now.occupancy} before={before?.occupancy ?? null} money={false} /></div>
            <div className="kpi"><dt>Lost to vacancies</dt><dd className={now.vacancyLoss > 0 ? "owe" : ""}>{ksh(now.vacancyLoss)}</dd><Delta now={now.vacancyLoss} before={before?.vacancyLoss ?? null} good="down" /></div>
            <div className="kpi"><dt>Net after expenses</dt><dd>{ksh(now.collected - spent.total)}</dd><Delta now={now.collected - spent.total} before={before && spentBefore !== null ? before.collected - spentBefore : null} /></div>
          </dl>
          {before === null && <p className="faint small mb-16">There is no earlier period of the same length in {d.year} to compare with.</p>}

          <section className="card mb-16" aria-labelledby="trend-h">
            <h3 className="h2 mb-4" id="trend-h">The year so far</h3>
            <TrendChart facts={d.facts} sel={months} onPick={(m) => setPeriod(makePeriod("month", m))} />
          </section>

          <div className="rgrid mb-16">
            <section className="card" aria-labelledby="timing-h">
              <h3 className="h3 mb-12" id="timing-h">When the money came in</h3>
              {[["By the " + PROPERTY.dueDay + "th (due day)", t.byDue], ["By the 10th", t.by10], ["By month end", t.byEnd]].map(([l, v]) => (
                <div className="meter-row" key={l as string}>
                  <span>{l}</span>
                  <div className="meter grow"><i style={{ width: `${Math.min(100, pct(v as number))}%` }} /></div>
                  <b>{pct(v as number)}%</b>
                </div>
              ))}
              <p className="small muted mt-12">
                {single?.timing.clearDayMedian
                  ? <>A paid-up unit typically cleared by the <b>{single.timing.clearDayMedian}th</b>. {t.onTime} of {t.clearedWithDates} paid in full by the due day.</>
                  : <>{t.onTime} of {t.clearedWithDates} units with dated payments paid in full by the due day.</>}
                {t.dated < now.collected && <> Money entered before the payment ledger has no date, so {ksh(now.collected - t.dated)} is left out of timing.</>}
              </p>
            </section>

            <section className="card" aria-labelledby="ch-h">
              <h3 className="h3 mb-12" id="ch-h">How tenants paid</h3>
              <div className="stackbar" aria-hidden>
                {(["stk", "manual", "csv", "earlier"] as const).map((k) => now.channels[k] > 0 && <i key={k} className={`c-${k}`} style={{ flex: now.channels[k] }} />)}
              </div>
              <ul className="ch-list">
                <li><i className="c-stk" />M-Pesa prompt<b>{ksh(now.channels.stk)}</b></li>
                <li><i className="c-manual" />Entered by hand<b>{ksh(now.channels.manual)}</b></li>
                <li><i className="c-csv" />Statement import<b>{ksh(now.channels.csv)}</b></li>
                {now.channels.earlier > 0 && <li><i className="c-earlier" />Before the ledger<b>{ksh(now.channels.earlier)}</b></li>}
              </ul>
              <p className="small muted mt-8">{chTotal > 0 ? `${Math.round((now.channels.stk / chTotal) * 100)}% came through M-Pesa prompts.` : ""} {now.channels.reversalCount > 0 ? `${now.channels.reversalCount} reversal${now.channels.reversalCount === 1 ? "" : "s"} took back ${ksh(now.channels.reversals)}.` : "No reversals."}</p>
            </section>

            <section className="card" aria-labelledby="rw-h">
              <h3 className="h3 mb-12" id="rw-h">Rent and water</h3>
              <ul className="ch-list">
                <li><i className="c-stk" />Rent charged<b>{ksh(now.rentCharged)}</b></li>
                <li><i className="c-csv" />Water and other charged<b>{ksh(now.waterCharged)}</b></li>
                <li><i className="c-manual" />Rent received (estimate)<b>{ksh(now.rentReceived)}</b></li>
              </ul>
              <p className="small muted mt-8">Payments are not split between rent and water, so rent received assumes each tenant pays rent before water.</p>
            </section>
          </div>

          <section className="tbl-wrap mb-16" aria-labelledby="fl-h">
            <h3 className="sr-only" id="fl-h">By floor</h3>
            <table className="data">
              <thead><tr><th>Floor</th><th className="right">Charged</th><th className="right">Collected</th><th className="right">Owed</th><th className="right">Vacancy loss</th><th>Rate</th><th /></tr></thead>
              <tbody>
                {FLOORS.map((f) => {
                  const fm = months.map((m) => d.facts[m]).filter((m) => m.opened);
                  const units = fm.flatMap((m) => m.units.filter((u) => u.floor === f));
                  const charged = units.reduce((s, u) => s + u.due, 0), paid = units.reduce((s, u) => s + u.paid, 0);
                  const owed = units.reduce((s, u) => s + (u.status !== "vacant" && u.balance > 0 ? u.balance : 0), 0);
                  const lost = units.reduce((s, u) => s + (u.status === "vacant" ? u.rent : 0), 0);
                  const rate = charged > 0 ? Math.round((paid / charged) * 100) : 100;
                  const open = openFloor === f;
                  return (
                    <Fragment key={f}>
                      <tr className="clickable" onClick={() => setOpenFloor(open ? null : f)} aria-expanded={open}>
                        <td className="strong">Floor {f}</td>
                        <td className="right num">{charged.toLocaleString()}</td>
                        <td className="right num ok">{paid.toLocaleString()}</td>
                        <td className={`right num ${owed > 0 ? "owe" : ""}`}>{owed > 0 ? owed.toLocaleString() : "—"}</td>
                        <td className="right num faint">{lost > 0 ? lost.toLocaleString() : "—"}</td>
                        <td style={{ minWidth: 120 }}><div className="row gap-8"><div className={`meter grow ${rate < 80 ? "low" : ""}`}><i style={{ width: `${Math.min(rate, 100)}%` }} /></div><span className="tiny strong">{rate}%</span></div></td>
                        <td><IconChevron className={`drill ${open ? "open" : ""}`} aria-hidden /></td>
                      </tr>
                      {open && single && single.units.filter((u) => u.floor === f).map((u) => (
                        <tr key={u.unit} className="sub-row">
                          <td><Link className="inline-link" href={`/collect?month=${single.month}&floor=${f}&unit=${encodeURIComponent(u.unit)}`}>{u.unit}</Link> <span className="faint small">{u.tenant}</span></td>
                          <td className="right num">{u.due ? u.due.toLocaleString() : "—"}</td>
                          <td className="right num ok">{u.paid ? u.paid.toLocaleString() : "—"}</td>
                          <td className={`right num ${u.balance > 0 && u.status !== "vacant" ? "owe" : ""}`}>{u.status !== "vacant" && u.balance > 0 ? u.balance.toLocaleString() : "—"}</td>
                          <td className="right num faint">{u.status === "vacant" ? u.rent.toLocaleString() : "—"}</td>
                          <td colSpan={2}><span className={`pill pill-${u.status}`}>{STATUS_LABEL[u.status]}</span></td>
                        </tr>
                      ))}
                      {open && !single && <tr className="sub-row"><td colSpan={7} className="faint small">Pick a single month to see each unit. For a whole range, use the Statement or Arrears tabs.</td></tr>}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </>
  );
}
