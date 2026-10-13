"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FLOORS, MONTHS, fmt } from "@/lib/config";
import { getActiveYear, whatsAppLink, loadMonth } from "@/lib/store";
import { SYNC_EVENT } from "@/lib/cloud";
import { loadCumulative, UnitCumulative, MonthCell } from "@/lib/cumulative";
import { STATUS_LABEL, compact } from "@/lib/status";
import AuthGuard from "@/components/AuthGuard";
import { IconChat, IconChevron } from "@/components/Icons";

function Outstanding({ series, through }: { series: { month: number; billed: number; paid: number; opened: boolean }[]; through: number }) {
  const pts = series.map((p) => ({ m: p.month, out: p.billed - p.paid, shown: p.month <= through && p.opened }));
  const max = Math.max(1, ...pts.map((p) => (p.shown ? Math.max(p.out, 0) : 0)));
  return (
    <div className="bars" role="img"
      aria-label={`Outstanding at the end of each month: ${pts.filter((p) => p.shown).map((p) => `${MONTHS[p.m].slice(0, 3)} ${Math.max(p.out, 0).toLocaleString()} shillings`).join(", ")}`}>
      {pts.map((p) => (
        <div className="bar" key={p.m}>
          {p.shown && <b>{compact(Math.max(p.out, 0))}</b>}
          <div className={`bar-col ${!p.shown ? "none" : p.out > 0 ? "low" : ""}`}
            style={{ height: p.shown ? `${Math.max(4, (Math.max(p.out, 0) / max) * 100)}px` : "4px" }} />
          <span>{MONTHS[p.m].slice(0, 3)}</span>
        </div>
      ))}
    </div>
  );
}

function Strip({ cells, through }: { cells: MonthCell[]; through: number }) {
  return (
    <span className="strip" role="img"
      aria-label={cells.slice(0, through + 1).map((c) => `${MONTHS[c.month].slice(0, 3)} ${c.opened ? STATUS_LABEL[c.status] : "not started"}`).join(", ")}>
      {cells.map((c) => (
        <i key={c.month} data-status={c.opened ? c.status : "none"} data-off={c.month > through ? "1" : undefined}
          title={`${MONTHS[c.month]}: ${c.opened ? (c.status === "vacant" ? "Vacant" : `due ${c.due.toLocaleString()}, paid ${c.paid.toLocaleString()}`) : "not started"}`} />
      ))}
    </span>
  );
}

function CumulativeInner() {
  const [through, setThrough] = useState(new Date().getMonth());
  const [floor, setFloor] = useState<number | "all">("all");
  const [onlyOwing, setOnlyOwing] = useState(false);
  const [year, setYear] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const y = getActiveYear();
    setYear(y);
    setThrough(new Date().getFullYear() === y ? new Date().getMonth() : 11);
    if (window.innerWidth < 860) setOnlyOwing(true); // a short list is more useful on a phone
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(SYNC_EVENT, bump);
    return () => window.removeEventListener(SYNC_EVENT, bump);
  }, []);

  const cum = useMemo(() => (year ? loadCumulative(through, year) : null), [through, year, tick]);

  if (!cum) return null;
  const t = cum.totals;
  const rows = cum.units
    .filter((u) => floor === "all" || u.floor === floor)
    .filter((u) => !onlyOwing || u.balance > 0)
    .sort((a, b) => b.balance - a.balance || a.floor - b.floor);

  const remind = (u: UnitCumulative) => {
    const latest = [...Array(through + 1).keys()].reverse().map((m) => loadMonth(m, year).find((r) => r.floor === u.floor && r.unit === u.unit)).find(Boolean);
    return latest ? whatsAppLink(latest, u.balance, MONTHS[through], year, "cumulative") : "#";
  };

  return (
    <main className="shell page">
      <div className="row between wrap gap-12 mb-8">
        <h1 className="h1">Cumulative</h1>
        <div className="row gap-8">
          <button className="btn btn-line btn-icon" aria-label="Earlier month" disabled={through === 0} onClick={() => setThrough(through - 1)}><IconChevron dir="left" /></button>
          <select className="select" style={{ width: 210 }} aria-label="Total up to" value={through} onChange={(e) => setThrough(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={m} value={i}>Up to {m} {year}</option>)}
          </select>
          <button className="btn btn-line btn-icon" aria-label="Later month" disabled={through === 11} onClick={() => setThrough(through + 1)}><IconChevron /></button>
        </div>
      </div>
      <p className="lede mb-24">
        Months stand on their own everywhere else in RentTrack. This page is the one place they are added together:
        what each unit has been charged and has paid since January, and what is still outstanding.
      </p>

      {t.monthsOpened === 0 ? (
        <div className="banner" role="note">
          <span>No months have been opened up to {MONTHS[through]}. Open one from <Link href="/collect" className="inline-link">Collect rent</Link> and its totals will appear here.</span>
        </div>
      ) : (
        <>
          <dl className="kpis kpis-4">
            <div className="kpi"><dt>Charged, {t.monthsOpened} month{t.monthsOpened === 1 ? "" : "s"}</dt><dd>{fmt(t.billed)}</dd></div>
            <div className="kpi"><dt>Collected</dt><dd className="ok">{fmt(t.paid)}</dd></div>
            <div className="kpi"><dt>Outstanding</dt><dd className={t.outstanding > 0 ? "owe" : "ok"}>{fmt(Math.max(t.outstanding, 0))}</dd></div>
            <div className="kpi"><dt>Units owing</dt><dd className={t.unitsOwing > 0 ? "owe" : "ok"}>{t.unitsOwing} of 34</dd></div>
          </dl>

          <section className="card mb-24" aria-labelledby="trend">
            <div className="row between wrap gap-8 mb-4">
              <h2 className="h2" id="trend">Outstanding at the end of each month</h2>
              <span className="pill pill-brand">{t.rate}% of everything charged is collected</span>
            </div>
            <p className="muted small mb-16">Charged so far {fmt(t.billed)}, collected {fmt(t.paid)}. A bar shrinks when tenants pay off earlier months.</p>
            <Outstanding series={cum.series} through={through} />
          </section>

          <section aria-labelledby="units">
            <div className="row between wrap gap-12 mb-12">
              <h2 className="h2" id="units">Unit by unit</h2>
              <div className="row gap-12 wrap">
                <div className="seg" role="group" aria-label="Floor">
                  <button aria-pressed={floor === "all"} onClick={() => setFloor("all")}>All</button>
                  {FLOORS.map((f) => (
                    <button key={f} aria-pressed={floor === f} onClick={() => setFloor(f)}><span className="hide-sm">Floor </span>{f}</button>
                  ))}
                </div>
                <label className="row gap-8" style={{ cursor: "pointer" }}>
                  <input type="checkbox" checked={onlyOwing} onChange={(e) => setOnlyOwing(e.target.checked)} style={{ width: 20, height: 20, accentColor: "var(--brand)" }} />
                  <span>Only units that owe</span>
                </label>
              </div>
            </div>

            <div className="tbl-wrap cum-table">
              <table className="data">
                <caption className="sr-only">Cumulative charges, payments and balance for each unit</caption>
                <thead>
                  <tr>
                    <th>Unit</th><th>Tenant</th>
                    <th className="right">Charged</th><th className="right">Paid</th><th className="right">Outstanding</th>
                    <th>Month by month</th><th><span className="sr-only">Reminder</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((u) => (
                    <tr key={`${u.floor}|${u.unit}`}>
                      <td><span className="pill pill-brand">F{u.floor} · {u.unit.replace(/^Unit /, "")}</span></td>
                      <td>{u.tenant || <span className="faint">No name</span>}</td>
                      <td className="right num">{u.billed.toLocaleString()}</td>
                      <td className="right num ok">{u.paid.toLocaleString()}</td>
                      <td className={`right num strong ${u.balance > 0 ? "owe" : "ok"}`}>
                        {u.balance > 0 ? u.balance.toLocaleString() : u.balance < 0 ? `Ahead ${(-u.balance).toLocaleString()}` : "—"}
                      </td>
                      <td><Strip cells={u.cells} through={through} /></td>
                      <td className="right">
                        {u.balance > 0 && (
                          <a className="btn btn-line btn-sm" target="_blank" rel="noreferrer" href={remind(u)} aria-label={`WhatsApp reminder to ${u.tenant || u.unit}`}>
                            <IconChat /> Remind
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="muted" style={{ padding: 24, textAlign: "center" }}>Nothing matches. Every unit here is clear.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="cum-cards">
              {rows.map((u) => (
                <article className="ucard" key={`${u.floor}|${u.unit}`}>
                  <div className="ucard-head">
                    <span className="u">Floor {u.floor}, {u.unit}</span>
                    <span className={`pill ${u.balance > 0 ? "pill-owe" : "pill-paid"}`}>{u.balance > 0 ? "Owing" : "Clear"}</span>
                  </div>
                  <p className="muted small">{u.tenant || "No name"}</p>
                  <dl className="ucard-figs">
                    <div><dt>Charged</dt><dd>{u.billed.toLocaleString()}</dd></div>
                    <div><dt>Paid</dt><dd className="ok">{u.paid.toLocaleString()}</dd></div>
                    <div><dt>{u.balance < 0 ? "Ahead" : "Outstanding"}</dt><dd className={u.balance > 0 ? "owe" : ""}>{Math.abs(u.balance).toLocaleString()}</dd></div>
                  </dl>
                  <Strip cells={u.cells} through={through} />
                  {u.balance > 0 && (
                    <a className="btn btn-line btn-sm mt-12" target="_blank" rel="noreferrer" href={remind(u)}><IconChat /> Remind</a>
                  )}
                </article>
              ))}
              {rows.length === 0 && <p className="muted">Nothing matches. Every unit here is clear.</p>}
            </div>
            <p className="faint small mt-12">
              In the month-by-month strip: green is paid, amber part-paid, red owing, hatched vacant, grey not started. Hover a square for the figures.
            </p>
          </section>
        </>
      )}
    </main>
  );
}

export default function CumulativePage() {
  return (
    <AuthGuard>
      <CumulativeInner />
    </AuthGuard>
  );
}
