"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MONTHS } from "@/lib/config";
import { getActiveYear, loadMonth, loadPayments } from "@/lib/store";
import { SYNC_EVENT } from "@/lib/cloud";
import { ActivityFilter, buildActivity } from "@/lib/activity";
import type { Payment } from "@/lib/ledger";
import AuthGuard from "@/components/AuthGuard";
import Intro from "@/components/Intro";
import Amt from "@/components/Amt";
import { IconPhone, IconReceipt, IconUndo, IconUpload, IconChevron } from "@/components/Icons";

const FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "stk", label: "M-Pesa prompts" },
  { id: "manual", label: "By hand" },
  { id: "csv", label: "Statements" },
  { id: "reversal", label: "Reversals" },
];

const SOURCE: Record<Payment["source"], { label: string; Icon: typeof IconPhone }> = {
  stk: { label: "M-Pesa prompt", Icon: IconPhone },
  manual: { label: "Entered by hand", Icon: IconReceipt },
  csv: { label: "Statement import", Icon: IconUpload },
  reversal: { label: "Reversal", Icon: IconUndo },
};

function ActivityInner() {
  const [year, setYear] = useState<number | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);
  const [limit, setLimit] = useState(14);

  useEffect(() => {
    setYear(getActiveYear());
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(SYNC_EVENT, bump);
    return () => window.removeEventListener(SYNC_EVENT, bump);
  }, []);

  const payments = useMemo(() => (year === null ? [] : loadPayments(year)), [year, tick]);

  // Tenant names as they were in the month each payment belongs to (read each month once).
  const tenantOf = useMemo(() => {
    const byMonth = new Map<number, Map<string, string>>();
    return (p: Payment) => {
      if (year === null) return "";
      let m = byMonth.get(p.month);
      if (!m) {
        m = new Map(loadMonth(p.month, year).map((e) => [`${e.floor}|${e.unit}`, e.tenant]));
        byMonth.set(p.month, m);
      }
      return m.get(`${p.floor}|${p.unit}`) ?? "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, tick]);

  const days = useMemo(() => buildActivity(payments, tenantOf, filter, q), [payments, tenantOf, filter, q]);
  const count = days.reduce((n, d) => n + d.items.length, 0);
  const total = days.reduce((n, d) => n + d.total, 0);

  return (
    <main className="shell page">
      <h1 className="h1 mb-8">Activity</h1>
      <div className="mb-16">
        <Intro>Every payment recorded this year, newest first: M-Pesa prompts, payments entered by hand, statement imports and reversals. Tap one to open its unit.</Intro>
      </div>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Kind of payment">
          {FILTERS.map((f) => <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
        </div>
        <input className="input" type="search" style={{ maxWidth: 280 }} placeholder="Search name, receipt, unit or amount"
          aria-label="Search payments" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <dl className="tstats act-stats stagger">
        <div className="kpi"><dt>Payments</dt><dd>{count}</dd></div>
        <div className="kpi"><dt>Total</dt><dd className="ok"><Amt n={total} /></dd></div>
        <div className="kpi"><dt>Days</dt><dd>{days.length}</dd></div>
      </dl>

      {days.length === 0 ? (
        <div className="card empty-state">
          <h2 className="h2 mb-8">{payments.length === 0 ? "No payments recorded yet" : "Nothing matches"}</h2>
          <p className="muted">
            {payments.length === 0
              ? <>Payments appear here as soon as they are recorded in <Link className="inline-link" href="/collect">Collect rent</Link>.</>
              : "Try another filter or clear the search."}
          </p>
        </div>
      ) : (
        <div className="feed">
          {days.slice(0, limit).map((d) => (
            <section key={d.key} className="feed-day" aria-label={d.label}>
              <header className="feed-head">
                <span className="feed-date">{d.label}</span>
                <span className={`feed-total ${d.total < 0 ? "owe" : ""}`}>{d.total < 0 ? "−" : ""}KSh {Math.abs(d.total).toLocaleString()}</span>
              </header>
              <ul className="feed-list">
                {d.items.map(({ p, tenant, reversed }) => {
                  const S = SOURCE[p.source];
                  return (
                    <li key={p.id}>
                      <Link className={`feed-row ${reversed ? "is-reversed" : ""} src-${p.source}`}
                        href={`/collect?month=${p.month}&floor=${p.floor}&unit=${encodeURIComponent(p.unit)}`}>
                        <span className="feed-ic" aria-hidden><S.Icon /></span>
                        <span className="feed-main">
                          <span className="feed-title">{tenant || `Floor ${p.floor}, ${p.unit}`}</span>
                          <span className="feed-meta">
                            Floor {p.floor}, {p.unit} · {S.label}{p.receipt ? ` · ${p.receipt}` : ""} · {MONTHS[p.month].slice(0, 3)} rent{reversed ? " · reversed" : ""}
                          </span>
                        </span>
                        <span className={`feed-amt ${p.amount < 0 ? "owe" : "ok"}`}>{p.amount < 0 ? "−" : "+"}{Math.abs(p.amount).toLocaleString()}</span>
                        <IconChevron className="feed-go" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {days.length > limit && (
            <button className="btn btn-line" style={{ alignSelf: "center" }} onClick={() => setLimit((l) => l + 14)}>Show earlier days</button>
          )}
        </div>
      )}
    </main>
  );
}

export default function ActivityPage() {
  return <AuthGuard><ActivityInner /></AuthGuard>;
}
