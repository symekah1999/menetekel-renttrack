"use client";

import { useState } from "react";
import { FLOORS, MONTHS, unitsForFloor } from "@/lib/config";
import { expenseTotals, CATEGORY_LABEL } from "@/lib/expenses";
import { MRI_DEFAULT_RATE, mriSchedule } from "@/lib/tax";
import { ReportData } from "./data";
import { IconDownload } from "@/components/Icons";

/** The year in one pack: a PDF summary, CSV files for an accountant, and the older downloads. */
export default function YearEnd({ d, month }: { d: ReportData; month: number }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [dlFloor, setDlFloor] = useState(0);
  const [dlUnit, setDlUnit] = useState("0|Unit 1");
  const opened = d.facts.filter((f) => f.opened);
  const charged = opened.reduce((s, f) => s + f.charged, 0), collected = opened.reduce((s, f) => s + f.collected, 0);
  const spent = expenseTotals(d.expenses).total;

  async function run(key: string, fn: () => void | Promise<void>) {
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  }
  const btn = (key: string, label: string, fn: () => void | Promise<void>, primary = false) => (
    <button className={`btn btn-sm ${primary ? "btn-primary" : "btn-line"}`} disabled={busy !== null} onClick={() => run(key, fn)}>
      <IconDownload /> {busy === key ? "Preparing…" : label}
    </button>
  );

  function rentChanges() {
    const out: { floor: number; unit: string; from: number; to: number; month: number }[] = [];
    for (const f of FLOORS) for (const u of unitsForFloor(f)) {
      let last: number | null = null;
      for (let m = 0; m < 12; m++) {
        const r = d.rows[m]?.find((e) => e.floor === f && e.unit === u.label);
        if (!r) continue;
        if (last !== null && r.rent !== last) out.push({ floor: f, unit: u.label, from: last, to: r.rent, month: m });
        last = r.rent;
      }
    }
    return out;
  }

  async function pdf() {
    const { downloadYearEndPdf } = await import("@/lib/reportExports");
    let rate = MRI_DEFAULT_RATE;
    try { const r = Number(localStorage.getItem("menetekel:mriRate")); if (r > 0 && r < 100) rate = r; } catch { /* ignore */ }
    const tax = mriSchedule(d.facts.map((f) => ({ month: f.month, opened: f.opened, amount: f.rentReceived })), rate, d.year);
    downloadYearEndPdf({
      year: d.year, months: d.facts, rentChanges: rentChanges(),
      expensesByMonth: MONTHS.map((_, i) => expenseTotals(d.expenses, [i]).total),
      tax: { rows: tax.rows, totalTax: tax.totalTax, ratePct: rate },
    });
  }
  async function csvUnits() {
    const { downloadCsv } = await import("@/lib/reportExports");
    const rows: (string | number)[][] = [["Year", "Month", "Floor", "Unit", "Tenant", "Rent", "Water", "Due", "Paid", "Balance", "Status", "Receipts"]];
    for (const f of opened) for (const u of f.units) rows.push([d.year, MONTHS[f.month], u.floor, u.unit, u.tenant, u.rent, u.water, u.due, u.paid, u.status === "vacant" ? 0 : u.balance, u.status, u.receipts.join(" ")]);
    downloadCsv(`Menetekel_Units_by_month_${d.year}.csv`, rows);
  }
  async function csvPayments() {
    const { downloadCsv } = await import("@/lib/reportExports");
    downloadCsv(`Menetekel_Payments_${d.year}.csv`, [
      ["Paid on", "For month", "Floor", "Unit", "Amount", "Receipt", "Source", "Note", "Reverses"],
      ...[...d.payments].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((p) => [p.paidOn, MONTHS[p.month], p.floor, p.unit, p.amount, p.receipt, p.source, p.note ?? "", p.reverses ?? ""]),
    ]);
  }
  async function csvExpenses() {
    const { downloadCsv } = await import("@/lib/reportExports");
    downloadCsv(`Menetekel_Expenses_${d.year}.csv`, [
      ["Date", "Month", "Category", "Amount", "Note", "Reverses"],
      ...[...d.expenses].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((e) => [e.date, MONTHS[e.month], CATEGORY_LABEL[e.category], e.amount, e.note ?? "", e.reverses ?? ""]),
    ]);
  }
  const [uf, ul] = dlUnit.split("|");

  return (
    <>
      <dl className="kpis rkpis stagger">
        <div className="kpi"><dt>Months recorded</dt><dd>{opened.length} of 12</dd></div>
        <div className="kpi"><dt>Charged</dt><dd>KSh {charged.toLocaleString()}</dd></div>
        <div className="kpi"><dt>Collected</dt><dd className="ok">KSh {collected.toLocaleString()}</dd></div>
        <div className="kpi"><dt>Expenses</dt><dd>KSh {spent.toLocaleString()}</dd></div>
        <div className="kpi"><dt>Net</dt><dd>KSh {(collected - spent).toLocaleString()}</dd></div>
      </dl>

      <section className="card mb-16" aria-labelledby="ye-h">
        <h3 className="h2 mb-4" id="ye-h">Year-end pack</h3>
        <p className="muted small mb-16">A summary PDF with every month, rent changes, expenses and the MRI tax column, plus CSV files your accountant can open in Excel.</p>
        <div className="row gap-8 wrap">
          {btn("ye", `${d.year} summary PDF`, pdf, true)}
          {btn("cu", "Units by month (CSV)", csvUnits)}
          {btn("cp", "Payments (CSV)", csvPayments)}
          {btn("ce", "Expenses (CSV)", csvExpenses)}
          {btn("yx", `${d.year} Excel workbook`, async () => (await import("@/lib/exportExcel")).downloadYearExcel())}
        </div>
      </section>

      <section className="card" aria-labelledby="od-h">
        <h3 className="h2 mb-4" id="od-h">Other downloads</h3>
        <div className="dl-group">
          <h4 className="h3 mb-12">{MONTHS[month]} collection report</h4>
          <div className="row gap-8 wrap">{btn("mp", "PDF with cover", async () => (await import("@/lib/exportPdf")).downloadMonthPdf(month))}</div>
        </div>
        <div className="dl-group">
          <h4 className="h3 mb-12">One floor, {MONTHS[month]}</h4>
          <div className="row gap-8 wrap">
            <select className="select" style={{ width: 200 }} aria-label="Floor" value={dlFloor} onChange={(e) => setDlFloor(+e.target.value)}>
              {FLOORS.map((f) => <option key={f} value={f}>Floor {f}</option>)}
            </select>
            {btn("fx", "Excel", async () => (await import("@/lib/exportExcel")).downloadFloorExcel(month, dlFloor))}
            {btn("fp", "PDF", async () => (await import("@/lib/exportPdf")).downloadFloorPdf(month, dlFloor))}
          </div>
        </div>
        <div className="dl-group">
          <h4 className="h3 mb-12">One unit, full year</h4>
          <div className="row gap-8 wrap">
            <select className="select" style={{ width: 240, maxWidth: "100%" }} aria-label="Unit" value={dlUnit} onChange={(e) => setDlUnit(e.target.value)}>
              {FLOORS.map((f) => <optgroup key={f} label={`Floor ${f}`}>{unitsForFloor(f).map((u) => <option key={u.label} value={`${f}|${u.label}`}>{u.label}</option>)}</optgroup>)}
            </select>
            {btn("ux", "Excel", async () => (await import("@/lib/exportExcel")).downloadUnitExcel(+uf, ul))}
            {btn("up", "PDF", async () => (await import("@/lib/exportPdf")).downloadUnitPdf(+uf, ul))}
          </div>
        </div>
      </section>
    </>
  );
}
