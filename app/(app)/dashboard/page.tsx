"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MONTHS, PROPERTY, TOTAL_UNITS, GRAND_TOTAL, fmt } from "@/lib/config";
import { getActiveYear, whatsAppLink } from "@/lib/store";
import { useMonth } from "@/lib/useMonth";
import { unitState, STATUS_LABEL } from "@/lib/status";
import { loadCumulative, earlierBalance } from "@/lib/cumulative";
import AuthGuard from "@/components/AuthGuard";
import Building, { unitId } from "@/components/Building";
import { IconChevron, IconChat, IconPhone, IconCoins, IconX, IconArrowRight } from "@/components/Icons";

function DashboardPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const mv = useMonth(month);

  useEffect(() => {
    const y = getActiveYear();
    setMonth(now.getFullYear() === y ? now.getMonth() : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const states = useMemo(
    () => mv.eff.map((e) => ({ e, s: unitState(e, mv.billed) })),
    [mv.eff, mv.billed]
  );
  const cum = useMemo(() => (mv.loaded ? loadCumulative(month, mv.year) : null), [mv.loaded, mv.eff, month, mv.year]);

  const owing = states
    .filter(({ s }) => s.status === "owe" || s.status === "part")
    .sort((a, b) => b.s.balance - a.s.balance);
  const sel = states.find(({ e }) => unitId(e.floor, e.unit) === selected) ?? null;
  const t = mv.totals;
  const year = mv.year || PROPERTY.year;
  const earlier = sel && cum ? earlierBalance(cum, sel.e.floor, sel.e.unit, month) : 0;

  return (
    <main className="shell page">
      <div className="row between wrap gap-12 mb-16">
        <div className="month-nav" role="group" aria-label="Month">
          <button className="btn btn-line btn-icon" aria-label="Previous month" disabled={month === 0}
            onClick={() => { setMonth((m) => m - 1); setSelected(null); }}>
            <IconChevron dir="left" />
          </button>
          <strong aria-live="polite">{MONTHS[month]} {year}</strong>
          <button className="btn btn-line btn-icon" aria-label="Next month" disabled={month === 11}
            onClick={() => { setMonth((m) => m + 1); setSelected(null); }}>
            <IconChevron />
          </button>
        </div>
        <Link href="/collect" className="btn btn-primary"><IconCoins /> Collect rent</Link>
      </div>

      <section className="hero" aria-label="Collection this month">
        {mv.billed ? (
          <>
            <div className="display-num"><small>KSh</small>{t.paid.toLocaleString()}</div>
            <p className="lede">
              collected of {fmt(t.totalDue)} due this month, <b>{t.rate}%</b>.{" "}
              {t.fullyPaid} of {t.occupied} occupied units are clear.
              {cum && cum.totals.outstanding > 0 && (
                <> Across {MONTHS[0]} to {MONTHS[month]}, <Link href="/cumulative" className="inline-link">{fmt(cum.totals.outstanding)} is still outstanding</Link>.</>
              )}
            </p>
          </>
        ) : (
          <>
            <div className="display-num" style={{ color: "var(--ink-3)" }}>Not started</div>
            <p className="lede">
              Nothing has been recorded for {MONTHS[month]} yet. A full month is {fmt(GRAND_TOTAL)} across {TOTAL_UNITS} units,
              due on the {PROPERTY.dueDay}th. <Link href={`/collect?month=${month}`} className="inline-link">Open the month</Link> to begin.
            </p>
          </>
        )}
      </section>

      <div className="home-grid">
        <Building rows={mv.eff} billed={mv.billed} selected={selected}
          onSelect={(id) => setSelected((s) => (s === id ? null : id))} />

        <aside className="card side-card" aria-live="polite">
          {sel ? (
            <>
              <div className="row between gap-8 mb-12">
                <div>
                  <h2 className="h2">Floor {sel.e.floor}, {sel.e.unit}</h2>
                  <p className="muted small">{sel.e.tenant || (sel.e.vacant ? "Vacant" : "No tenant name yet")}</p>
                </div>
                <button className="btn btn-line btn-icon" aria-label="Close unit" onClick={() => setSelected(null)}><IconX /></button>
              </div>
              <span className={`pill pill-${sel.s.status}`}>{STATUS_LABEL[sel.s.status]}</span>
              <dl className="kv mt-16">
                <div><dt>Due</dt><dd>{sel.s.due.toLocaleString()}</dd></div>
                <div><dt>Paid</dt><dd className="ok">{sel.s.paid.toLocaleString()}</dd></div>
                <div>
                  <dt>{sel.s.balance < 0 ? "Overpaid" : "Balance"}</dt>
                  <dd className={sel.s.balance > 0 ? "owe" : ""}>{Math.abs(sel.s.balance).toLocaleString()}</dd>
                </div>
              </dl>
              {earlier > 0 && (
                <p className="small muted mt-16">
                  Also owes <b className="owe">{earlier.toLocaleString()}</b> from earlier months.{" "}
                  <Link href="/cumulative" className="inline-link">See the running total</Link>
                </p>
              )}
              <div className="stack gap-8 mt-24">
                <Link className="btn btn-primary"
                  href={`/collect?month=${month}&floor=${sel.e.floor}&unit=${encodeURIComponent(sel.e.unit)}`}>
                  Open unit <IconArrowRight />
                </Link>
                {sel.s.balance > 0 && !sel.e.vacant && (
                  <a className="btn btn-line" target="_blank" rel="noreferrer"
                    href={whatsAppLink(sel.e, sel.s.balance, MONTHS[month], year)}>
                    <IconChat /> WhatsApp reminder
                  </a>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="h2 mb-8">Still to collect</h2>
              {!mv.billed ? (
                <p className="muted">Once {MONTHS[month]} is opened, units that still owe will be listed here, largest balance first. Tap any window to see its unit.</p>
              ) : owing.length === 0 ? (
                <p className="muted">Every occupied unit is clear for {MONTHS[month]}. Nothing to chase. Tap any window to see its unit.</p>
              ) : (
                <div>
                  {owing.slice(0, 6).map(({ e, s }) => (
                    <div className="attn-item" key={unitId(e.floor, e.unit)}>
                      <div>
                        <div className="strong">Floor {e.floor}, {e.unit}</div>
                        <div className="muted small">
                          {e.tenant || "No name yet"}
                          {s.status === "part" ? `, paid ${s.paid.toLocaleString()}` : ""}
                        </div>
                      </div>
                      <div className="amt">{s.balance.toLocaleString()}</div>
                      <div className="attn-actions">
                        <Link className="btn btn-soft btn-sm"
                          href={`/collect?month=${month}&floor=${e.floor}&unit=${encodeURIComponent(e.unit)}&prompt=1`}>
                          <IconPhone /> M-Pesa prompt
                        </Link>
                        <a className="btn btn-line btn-sm" target="_blank" rel="noreferrer"
                          href={whatsAppLink(e, s.balance, MONTHS[month], year)}>
                          <IconChat /> Remind
                        </a>
                      </div>
                    </div>
                  ))}
                  {owing.length > 6 && <p className="muted small mt-12">and {owing.length - 6} more on the Collect page.</p>}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <AuthGuard>
      <DashboardPage />
    </AuthGuard>
  );
}
