"use client";

import { useEffect, useState } from "react";
import { MONTHS } from "@/lib/config";
import { MRI_DEFAULT_RATE, MRI_MAX_YEAR, MRI_MIN_YEAR, mriSchedule } from "@/lib/tax";
import { ReportData } from "./data";
import { IconDownload, IconInfo } from "@/components/Icons";

const RATE_KEY = "menetekel:mriRate";
const STATE_LABEL = { "not-opened": "Not opened", upcoming: "Upcoming", "due-soon": "Due soon", "due-passed": "Due date passed" } as const;

/** Monthly Rental Income tax: what the building's rent means for KRA, month by month. */
export default function Tax({ d }: { d: ReportData }) {
  const [rate, setRate] = useState(MRI_DEFAULT_RATE);
  const [basis, setBasis] = useState<"rent" | "all">("rent");
  useEffect(() => {
    try { const r = Number(localStorage.getItem(RATE_KEY)); if (r > 0 && r < 100) setRate(r); } catch { /* ignore */ }
  }, []);
  function changeRate(v: string) {
    const r = Math.min(99, Math.max(0, Number(v) || 0));
    setRate(r);
    try { localStorage.setItem(RATE_KEY, String(r)); } catch { /* ignore */ }
  }

  const s = mriSchedule(d.facts.map((f) => ({ month: f.month, opened: f.opened, amount: basis === "rent" ? f.rentReceived : f.collected })), rate, d.year);

  async function csv() {
    const { downloadCsv } = await import("@/lib/reportExports");
    downloadCsv(`Menetekel_MRI_${d.year}.csv`, [
      ["Month", basis === "rent" ? "Rent received" : "Money received", `Tax at ${rate}%`, "Due by", "Status"],
      ...s.rows.map((r) => [`${MONTHS[r.month]} ${d.year}`, r.received, r.tax, r.dueDate, r.nil ? "NIL return" : STATE_LABEL[r.state]]),
      ["Year so far", s.total, s.totalTax, "", ""],
    ]);
  }

  return (
    <>
      <div className="banner" role="note">
        <IconInfo />
        <span>
          KRA&apos;s Monthly Rental Income tax is {MRI_DEFAULT_RATE}% of gross residential rent received, a final tax with no expense deductions, filed and paid by the 20th of the following month on eRITS or iTax. It applies to rent of KSh {MRI_MIN_YEAR.toLocaleString()} to KSh {MRI_MAX_YEAR.toLocaleString()} a year. A NIL return is still due for months with no rent. This is a working aid, not tax advice: confirm your obligations on <a className="inline-link" href="https://erits.kra.go.ke/faqs" target="_blank" rel="noreferrer">KRA eRITS</a>.
        </span>
      </div>

      <div className="period-bar">
        <label className="row gap-8"><span className="small muted">Rate</span>
          <input className="input" style={{ width: 90 }} inputMode="decimal" aria-label="Tax rate in percent" value={rate} onChange={(e) => changeRate(e.target.value)} /><span className="small muted">%</span></label>
        <div className="seg" role="group" aria-label="Tax on">
          <button aria-pressed={basis === "rent"} onClick={() => setBasis("rent")}>Rent share</button>
          <button aria-pressed={basis === "all"} onClick={() => setBasis("all")}>All money received</button>
        </div>
        <button className="btn btn-line btn-sm" onClick={csv}><IconDownload /> CSV</button>
      </div>
      <p className="muted small mb-16">
        {basis === "rent"
          ? "Rent share leaves out water and other charges, assuming each tenant pays rent before water. Use all money received if you declare everything."
          : "Counts every shilling received, including water and other charges."}
      </p>

      <dl className="kpis rkpis stagger">
        <div className="kpi"><dt>Received this year</dt><dd>KSh {s.total.toLocaleString()}</dd></div>
        <div className="kpi"><dt>Tax at {rate}%</dt><dd>KSh {s.totalTax.toLocaleString()}</dd></div>
        <div className="kpi"><dt>A full year at this pace</dt><dd>KSh {s.annualised.toLocaleString()}</dd></div>
        <div className="kpi"><dt>Regime</dt><dd className={s.regime === "mri" ? "ok" : ""}>{s.regime === "mri" ? "Inside MRI band" : s.regime === "below" ? "Below the band" : s.regime === "above" ? "Above the band" : "—"}</dd></div>
      </dl>
      {s.regime === "below" && <p className="small muted mb-16">At this pace the building would receive less than KSh {MRI_MIN_YEAR.toLocaleString()} a year, which is outside the monthly regime. Rent is then declared in the annual return.</p>}
      {s.regime === "above" && <p className="small muted mb-16">At this pace the building would receive more than KSh {MRI_MAX_YEAR.toLocaleString()} a year, so rent goes in the annual return instead.</p>}

      <div className="tbl-wrap">
        <table className="data">
          <thead><tr><th>Month</th><th className="right">Received</th><th className="right">Tax</th><th>Due by</th><th>Status</th></tr></thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.month} className={r.state === "not-opened" ? "is-vacant" : ""}>
                <td className="strong">{MONTHS[r.month]}</td>
                <td className="right num">{r.state === "not-opened" ? "—" : r.received.toLocaleString()}</td>
                <td className="right num strong">{r.state === "not-opened" ? "—" : r.tax.toLocaleString()}</td>
                <td className="small">{r.dueDate}</td>
                <td>{r.nil ? <span className="pill pill-none">NIL return</span> : <span className={`pill ${r.state === "due-passed" ? "pill-owe" : r.state === "due-soon" ? "pill-part" : r.state === "upcoming" ? "pill-paid" : "pill-none"}`}>{STATE_LABEL[r.state]}</span>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td>Year so far</td><td className="right num">{s.total.toLocaleString()}</td><td className="right num">{s.totalTax.toLocaleString()}</td><td colSpan={2} /></tr></tfoot>
        </table>
      </div>
      <p className="faint small mt-8">&quot;Due date passed&quot; only means the deadline has gone by. The app cannot see whether you filed.</p>
    </>
  );
}
