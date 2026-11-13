"use client";

import Link from "next/link";
import { runChecks } from "@/lib/dataChecks";
import { ReportData } from "./data";
import { IconAlert, IconCheck, IconChevron } from "@/components/Icons";

const SEV = { high: { label: "Fix first", cls: "pill-owe" }, medium: { label: "Worth checking", cls: "pill-part" }, low: { label: "Minor", cls: "pill-none" } } as const;

/** Things that would make the reports wrong or incomplete. */
export default function Checks({ d }: { d: ReportData }) {
  const issues = runChecks(d.year, d.rows, d.payments, d.current);
  const n = { high: 0, medium: 0, low: 0 };
  for (const i of issues) n[i.severity]++;
  return (
    <>
      <dl className="kpis rkpis stagger">
        <div className="kpi"><dt>Fix first</dt><dd className={n.high ? "owe" : "ok"}>{n.high}</dd></div>
        <div className="kpi"><dt>Worth checking</dt><dd className={n.medium ? "part" : "ok"}>{n.medium}</dd></div>
        <div className="kpi"><dt>Minor</dt><dd>{n.low}</dd></div>
      </dl>
      {issues.length === 0 ? (
        <div className="card empty-state"><IconCheck width={28} height={28} className="ok" /><h3 className="h2 mt-8 mb-8">Everything checks out</h3><p className="muted">No gaps, duplicates or missing details found.</p></div>
      ) : (
        <ul className="feed-list">
          {issues.map((i) => (
            <li key={i.id}>
              <Link className="feed-row" href={i.href ?? "#"}>
                <span className={`feed-ic sev-${i.severity}`} aria-hidden><IconAlert /></span>
                <span className="feed-main"><span className="feed-title">{i.title}</span><span className="feed-meta">{i.detail}</span></span>
                <span className={`pill ${SEV[i.severity].cls}`}>{SEV[i.severity].label}</span>
                <IconChevron className="feed-go" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
