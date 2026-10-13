"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FLOORS, MONTHS, PROPERTY, TOTAL_UNITS, unitsForFloor, fmt } from "@/lib/config";
import { monthTotalsFull, floorTotalsFull, getActiveYear, hasMonthData, Totals } from "@/lib/store";
import { SYNC_EVENT } from "@/lib/cloud";
import AuthGuard from "@/components/AuthGuard";
import { IconDownload } from "@/components/Icons";

const EMPTY: Totals = {
  monthCharges: 0, totalDue: 0, paid: 0, balance: 0,
  rate: 0, fullyPaid: 0, defaulters: 0, occupied: 0, vacant: 0,
};

function ReportsInner() {
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState(new Date().getMonth());
  const [gt, setGt] = useState<Totals>(EMPTY);
  const [floorT, setFloorT] = useState<Totals[]>([]);
  const [trend, setTrend] = useState<{ rate: number; billed: boolean }[]>([]);
  const [billed, setBilled] = useState(false);
  const [dlFloor, setDlFloor] = useState(0);
  const [dlUnit, setDlUnit] = useState("0|Unit 1");
  const [busy, setBusy] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const y = getActiveYear();
    setYear(y);
    setMonth(new Date().getFullYear() === y ? new Date().getMonth() : 0);
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(SYNC_EVENT, bump);
    return () => window.removeEventListener(SYNC_EVENT, bump);
  }, []);

  useEffect(() => {
    setBilled(hasMonthData(month, year));
    setGt(monthTotalsFull(month, year));
    setFloorT(FLOORS.map((f) => floorTotalsFull(month, f, year)));
    setTrend(MONTHS.map((_, mi) => ({ rate: monthTotalsFull(mi, year).rate, billed: hasMonthData(mi, year) })));
  }, [month, year, tick]);

  const [unitFloor, unitLabel] = dlUnit.split("|");

  async function run(key: string, fn: () => void | Promise<void>) {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  }
  const dl = (key: string, label: string, fn: () => void | Promise<void>, primary = false) => (
    <button className={`btn btn-sm ${primary ? "btn-primary" : "btn-line"}`} disabled={busy !== null} onClick={() => run(key, fn)}>
      <IconDownload /> {busy === key ? "Preparing…" : label}
    </button>
  );

  return (
    <main className="shell page">
      <div className="row between wrap gap-12 mb-8">
        <h1 className="h1">{MONTHS[month]} {year}</h1>
        <select className="select" style={{ width: 190 }} aria-label="Month" value={month} onChange={(e) => setMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m} {year}</option>)}
        </select>
      </div>
      <p className="lede mb-24">
        {PROPERTY.name}, {TOTAL_UNITS} units, paid by {PROPERTY.paymentMode}. Each month stands on its own; see Cumulative for running totals.
      </p>

      {!billed ? (
        <div className="banner" role="note">
          <span>{MONTHS[month]} hasn&apos;t been opened, so there is nothing to report yet. Open it from <Link href="/collect" style={{ textDecoration: "underline" }}>Collect rent</Link>.</span>
        </div>
      ) : (
        <dl className="kpis kpis-4">
          <div className="kpi"><dt>Due this month</dt><dd>{fmt(gt.totalDue)}</dd></div>
          <div className="kpi"><dt>Collected</dt><dd className="ok">{fmt(gt.paid)}</dd></div>
          <div className="kpi"><dt>Outstanding</dt><dd className={gt.balance > 0 ? "owe" : "ok"}>{fmt(Math.max(gt.balance, 0))}</dd></div>
          <div className="kpi"><dt>Collection rate</dt><dd className={gt.rate >= 80 ? "ok" : "owe"}>{gt.rate}%</dd></div>
        </dl>
      )}

      <div className="tbl-wrap mb-24">
        <table className="data">
          <caption className="sr-only">Collection by floor</caption>
          <thead>
            <tr>
              <th>Floor</th><th>Occupied</th>
              <th className="right">Due</th>
              <th className="right">Collected</th><th className="right">Balance</th><th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {FLOORS.map((f, fi) => {
              const t = floorT[fi] ?? EMPTY;
              return (
                <tr key={f}>
                  <td className="strong">Floor {f}{f === 0 && <span className="faint tiny"> · 6 and 7 merged</span>}</td>
                  <td className="faint">{t.occupied}/{t.occupied + t.vacant}</td>
                  <td className="right num strong">{t.totalDue.toLocaleString()}</td>
                  <td className="right num ok">{t.paid.toLocaleString()}</td>
                  <td className={`right num ${t.balance > 0 ? "owe" : "ok"}`}>{t.balance > 0 ? t.balance.toLocaleString() : "—"}</td>
                  <td style={{ minWidth: 120 }}>
                    <div className="row gap-8">
                      <div className={`meter grow ${t.rate < 80 ? "low" : ""}`} role="img" aria-label={`${t.rate}% collected`}><i style={{ width: `${Math.min(t.rate, 100)}%` }} /></div>
                      <span className="tiny strong" style={{ minWidth: 34, textAlign: "right" }}>{t.rate}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Whole building</td><td>{gt.occupied}/{TOTAL_UNITS}</td>
              <td className="right num">{gt.totalDue.toLocaleString()}</td>
              <td className="right num ok">{gt.paid.toLocaleString()}</td>
              <td className={`right num ${gt.balance > 0 ? "owe" : "ok"}`}>{gt.balance > 0 ? gt.balance.toLocaleString() : "—"}</td>
              <td>{gt.rate}%</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <section className="card mb-24" aria-labelledby="trend">
        <h2 className="h2 mb-4" id="trend">Collection rate through {year}</h2>
        <p className="muted small mb-16">Months under 80% are shown in red. The month you&apos;re viewing has an outline.</p>
        <div className="bars" role="img" aria-label={`Collection rate by month: ${trend.map((t, i) => `${MONTHS[i].slice(0, 3)} ${t.billed ? t.rate + "%" : "not started"}`).join(", ")}`}>
          {trend.map((t, i) => (
            <div className="bar" key={i}>
              {t.billed && <b>{t.rate}</b>}
              <div className={`bar-col ${!t.billed ? "none" : t.rate < 80 ? "low" : ""} ${i === month ? "current" : ""}`}
                style={{ height: t.billed ? `${Math.max(4, Math.min(t.rate, 100)) * 0.95}px` : "4px" }} />
              <span>{MONTHS[i].slice(0, 3)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="dl">
        <h2 className="h2 mb-4" id="dl">Download</h2>
        <p className="muted small mb-16">Print-ready PDFs and Excel workbooks. Water, arrears and vacancies are included, and PDFs carry signature lines.</p>

        <div className="dl-group">
          <h3 className="h3 mb-12">Whole building</h3>
          <div className="row gap-8 wrap">
            {dl("yx", `${year} Excel workbook`, async () => (await import("@/lib/exportExcel")).downloadYearExcel(), true)}
            {dl("mp", `${MONTHS[month]} PDF report`, async () => (await import("@/lib/exportPdf")).downloadMonthPdf(month))}
          </div>
        </div>

        <div className="dl-group">
          <h3 className="h3 mb-12">One floor, {MONTHS[month]}</h3>
          <div className="row gap-8 wrap">
            <select className="select" style={{ width: 200 }} aria-label="Floor" value={dlFloor} onChange={(e) => setDlFloor(+e.target.value)}>
              {FLOORS.map((f) => <option key={f} value={f}>Floor {f} ({f === 0 ? "6 units" : "7 units"})</option>)}
            </select>
            {dl("fx", "Excel", async () => (await import("@/lib/exportExcel")).downloadFloorExcel(month, dlFloor))}
            {dl("fp", "PDF", async () => (await import("@/lib/exportPdf")).downloadFloorPdf(month, dlFloor))}
          </div>
        </div>

        <div className="dl-group">
          <h3 className="h3 mb-12">One unit, full-year statement</h3>
          <div className="row gap-8 wrap">
            <select className="select" style={{ width: 280, maxWidth: "100%" }} aria-label="Unit" value={dlUnit} onChange={(e) => setDlUnit(e.target.value)}>
              {FLOORS.map((f) => (
                <optgroup key={f} label={`Floor ${f}`}>
                  {unitsForFloor(f).map((u) => (
                    <option key={`${f}|${u.label}`} value={`${f}|${u.label}`}>{u.label}{u.merged ? " (merged)" : ""}, KSh {u.rent.toLocaleString()}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {dl("ux", "Excel", async () => (await import("@/lib/exportExcel")).downloadUnitExcel(+unitFloor, unitLabel))}
            {dl("up", "PDF", async () => (await import("@/lib/exportPdf")).downloadUnitPdf(+unitFloor, unitLabel))}
          </div>
          <p className="faint small mt-8">Shows rent, water, payments and a running balance across all twelve months.</p>
        </div>
      </section>
    </main>
  );
}

export default function ReportsPage() {
  return (
    <AuthGuard>
      <ReportsInner />
    </AuthGuard>
  );
}
