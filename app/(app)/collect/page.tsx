"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FLOORS, MONTHS, fmt, unitsForFloor } from "@/lib/config";
import { Entry, saveMonth, blankMonth, getActiveYear, monthDue } from "@/lib/store";
import { loadCumulative, earlierBalance } from "@/lib/cumulative";
import { useMonth } from "@/lib/useMonth";
import { unitState, STATUS_LABEL } from "@/lib/status";
import { parseMpesaCsv, autoMatch, MpesaTxn } from "@/lib/mpesa";
import { getSupabase, cloudConfigured } from "@/lib/supabase";
import { pullPayments, addPayment } from "@/lib/cloud";
import { Payment, findDuplicateReceipt, normalizeDate } from "@/lib/ledger";
import AuthGuard from "@/components/AuthGuard";
import UnitPanel, { StkState } from "@/components/UnitPanel";
import { IconUpload, IconCheck, IconAlert, IconX, IconChevron } from "@/components/Icons";

function CollectInner() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [floor, setFloor] = useState(0);
  const [open, setOpen] = useState<{ floor: number; unit: string; prompt: boolean } | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [stk, setStk] = useState<StkState | null>(null);
  const mv = useMonth(month);
  const cloud = cloudConfigured();

  // M-Pesa statement import
  const fileRef = useRef<HTMLInputElement>(null);
  const [txns, setTxns] = useState<MpesaTxn[]>([]);
  const [assign, setAssign] = useState<number[]>([]);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Start on the current month, or whatever the Building page linked to.
  useEffect(() => {
    const y = getActiveYear();
    const q = new URLSearchParams(window.location.search);
    const m = q.get("month");
    setMonth(m !== null && +m >= 0 && +m <= 11 ? +m : now.getFullYear() === y ? now.getMonth() : 0);
    const f = q.get("floor");
    const u = q.get("unit");
    if (f !== null && u) {
      setFloor(+f);
      setOpen({ floor: +f, unit: u, prompt: q.get("prompt") === "1" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setTxns([]); setAssign([]); setImportMsg(null); }, [month]);

  const rows = mv.raw;
  const idx = (f: number, u: string) => rows.findIndex((r) => r.floor === f && r.unit === u);

  function patch(i: number, p: Partial<Entry>) {
    if (!mv.loaded || i < 0) return;
    const next = rows.map((r, k) => (k === i ? { ...r, ...p, ts: Date.now() } : r));
    saveMonth(month, next, mv.year);
    setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    mv.reload();
  }

  function startMonth() {
    saveMonth(month, blankMonth(month, mv.year), mv.year);
    mv.reload();
  }

  const states = useMemo(
    () => mv.eff.map((e) => ({ e, s: unitState(e, mv.billed) })),
    [mv.eff, mv.billed]
  );
  const floorStates = states.filter(({ e }) => e.floor === floor);
  const openState = open ? states.find(({ e }) => e.floor === open.floor && e.unit === open.unit) : null;

  const floorTotals = useMemo(() => {
    let due = 0, paid = 0, clear = 0;
    for (const { e, s } of floorStates) {
      due += monthDue(e);
      paid += e.paid;
      if (s.status === "paid") clear++;
    }
    return { due, paid, balance: due - paid, clear, rate: due > 0 ? Math.round((paid / due) * 100) : 100 };
  }, [floorStates]);

  // What the open unit still owes from earlier months, shown for context only.
  const earlier = useMemo(() => {
    if (!open || !mv.loaded) return 0;
    return earlierBalance(loadCumulative(month, mv.year), open.floor, open.unit, month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mv.loaded, mv.eff, month, mv.year]);

  /* ---- M-Pesa prompt ---- */
  async function requestPayment(e: Entry, amount: number) {
    const sb = getSupabase();
    const { data: sess } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    const token = sess.session?.access_token;
    if (!token) { setStk({ unit: e.unit, phase: "failed", msg: "Sign in again, then retry." }); return; }

    setStk({ unit: e.unit, phase: "sending", msg: `Sending the prompt to ${e.phone}…` });
    try {
      const res = await fetch("/api/mpesa/stk", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ year: mv.year, month, floor: e.floor, unit: e.unit, phone: e.phone, amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "The prompt could not be sent.");

      setStk({ unit: e.unit, phase: "waiting", msg: `Prompt sent. Waiting for ${e.tenant || "the tenant"} to enter their M-Pesa PIN…` });
      const checkoutId = json.checkoutId as string;
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((ok) => setTimeout(ok, 4000));
        const sres = await fetch(`/api/mpesa/status?id=${encodeURIComponent(checkoutId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!sres.ok) continue;
        const s = await sres.json();
        if (s.status === "success") {
          await pullPayments([mv.year]);
          setStk({ unit: e.unit, phase: "done", msg: `Received KSh ${amount.toLocaleString()} from ${e.unit}${s.receipt ? ` (receipt ${s.receipt})` : ""}.` });
          return;
        }
        if (s.status === "success_unrecorded") {
          setStk({ unit: e.unit, phase: "done", msg: `Money received (receipt ${s.receipt}) but it couldn't be saved. Add it under Record a payment.` });
          return;
        }
        if (s.status === "failed") {
          setStk({ unit: e.unit, phase: "failed", msg: `Not completed: ${s.result_desc || "declined or cancelled"}. You can send it again.` });
          return;
        }
      }
      setStk({ unit: e.unit, phase: "failed", msg: "No answer after 2 minutes. The prompt may have expired. Send it again, or check your M-Pesa messages." });
    } catch (err) {
      setStk({ unit: e.unit, phase: "failed", msg: err instanceof Error ? err.message : "The prompt could not be sent." });
    }
  }

  /* ---- statement import (writes ledger rows, never overwrites) ---- */
  function onCsvChosen(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const { txns: parsed, error } = parseMpesaCsv(String(reader.result ?? ""));
      if (error) { setImportMsg({ ok: false, text: error }); setTxns([]); setAssign([]); return; }
      if (parsed.length === 0) { setImportMsg({ ok: false, text: "No incoming payments found in that file." }); setTxns([]); setAssign([]); return; }
      setTxns(parsed);
      setAssign(autoMatch(parsed, mv.eff));
      setImportMsg(null);
    };
    reader.readAsText(file);
  }

  async function applyImport() {
    let added = 0, skipped = 0;
    const seen = [...mv.payments];
    for (let i = 0; i < txns.length; i++) {
      const t = txns[i];
      const ri = assign[i];
      if (ri === undefined || ri < 0 || !mv.eff[ri]) continue;
      if (findDuplicateReceipt(seen, t.receipt)) { skipped++; continue; }
      const r = mv.eff[ri];
      const p: Payment = {
        id: crypto.randomUUID(), year: mv.year, month, floor: r.floor, unit: r.unit,
        amount: t.amount, receipt: t.receipt.toUpperCase(), source: "csv",
        paidOn: normalizeDate(t.date), createdAt: new Date().toISOString(), synced: false,
      };
      seen.push(p);
      await addPayment(p);
      added++;
    }
    setImportMsg({
      ok: true,
      text: `Recorded ${added} payment${added === 1 ? "" : "s"}.` + (skipped ? ` Skipped ${skipped} already on record.` : ""),
    });
    setTxns([]); setAssign([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  const matched = assign.filter((v) => v >= 0).length;
  const total = floor === 0 ? 6 : 7;

  return (
    <main className="shell page" style={{ maxWidth: 1120 }}>
      <div className="row between wrap gap-12 mb-8">
        <h1 className="h1">Collect rent</h1>
        <div className="row gap-12">
          {savedAt && <span className="saved" role="status"><IconCheck /> Saved {savedAt}</span>}
        </div>
      </div>
      <p className="lede mb-16">
        Tap a unit to take a payment, send an M-Pesa prompt or fix a tenant&apos;s details.
        Each month stands on its own: what is due is that month&apos;s rent and water. Running totals live on the Cumulative page.
      </p>

      <div className="toolbar">
        <div className="row gap-8">
          <button className="btn btn-line btn-icon" aria-label="Previous month" disabled={month === 0} onClick={() => setMonth(month - 1)}><IconChevron dir="left" /></button>
          <select className="select" style={{ width: 190 }} aria-label="Month" value={month} onChange={(e) => setMonth(+e.target.value)}>
            {MONTHS.map((m, i) => <option key={m} value={i}>{m} {mv.year || ""}</option>)}
          </select>
          <button className="btn btn-line btn-icon" aria-label="Next month" disabled={month === 11} onClick={() => setMonth(month + 1)}><IconChevron /></button>
        </div>
        <div className="seg" role="group" aria-label="Floor">
          {FLOORS.map((f) => {
            const fs = states.filter(({ e }) => e.floor === f);
            const done = mv.billed && fs.length > 0 && fs.every(({ s }) => s.status === "paid" || s.status === "vacant");
            return (
              <button key={f} aria-pressed={floor === f} onClick={() => setFloor(f)}>
                <span className="hide-sm">Floor </span>{f}{done && <span className="dot" title="All clear" />}
              </button>
            );
          })}
        </div>
      </div>

      {!mv.loaded ? null : !mv.billed ? (
        <div className="card" style={{ textAlign: "center", padding: "36px 24px" }}>
          <h2 className="h2 mb-8">{MONTHS[month]} hasn&apos;t been opened yet</h2>
          <p className="muted mb-16" style={{ maxWidth: "46ch", margin: "0 auto 18px" }}>
            Opening a month sets up every unit with its rent and carries over tenant names and phone numbers.
            Nothing owed from earlier months is added to it; that is tracked on the Cumulative page.
          </p>
          <button className="btn btn-primary" onClick={startMonth}>Open {MONTHS[month]}</button>
        </div>
      ) : (
        <>
          {floor === 0 && (
            <div className="banner" role="note"><span>Floor 0 has six units. Units 6 and 7 are merged into <b>Unit 6+7</b> at KSh 7,500.</span></div>
          )}

          {stk && (
            <div className={`banner ${stk.phase === "done" ? "banner-ok" : stk.phase === "failed" ? "banner-bad" : ""}`} role="status">
              {stk.phase === "done" ? <IconCheck /> : stk.phase === "failed" ? <IconAlert /> : null}
              <span><b>{stk.unit}:</b> {stk.msg}</span>
              <button className="x" aria-label="Dismiss" onClick={() => setStk(null)}><IconX width={16} height={16} /></button>
            </div>
          )}

          {/* wide screens: a table you can type into */}
          <div className="tbl-wrap desktop-only">
            <table className="data" style={{ minWidth: 940 }}>
              <thead>
                <tr>
                  <th>Unit</th><th>Tenant</th><th>Phone</th>
                  <th className="right">Rent</th><th className="right">Water</th>
                  <th className="right">Due</th>
                  <th className="right">Paid</th><th className="right">Balance</th>
                  <th>Status</th><th><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {floorStates.map(({ e, s }) => {
                  const i = idx(e.floor, e.unit);
                  return (
                    <tr key={e.unit} className={e.vacant ? "is-vacant" : ""}>
                      <td><span className="pill pill-brand">{e.unit}</span></td>
                      <td style={{ minWidth: 170 }}>
                        <input className="cell-input" aria-label={`${e.unit} tenant`} value={e.tenant} placeholder="Tenant name" disabled={e.vacant}
                          onChange={(ev) => patch(i, { tenant: ev.target.value })} />
                      </td>
                      <td style={{ minWidth: 150 }}>
                        <input className="cell-input" aria-label={`${e.unit} phone`} inputMode="tel" value={e.phone} placeholder="07XX XXX XXX" disabled={e.vacant}
                          onChange={(ev) => patch(i, { phone: ev.target.value })} />
                      </td>
                      <td className="right num">{e.vacant ? "—" : e.rent.toLocaleString()}</td>
                      <td style={{ minWidth: 96 }}>
                        <input className="cell-input right" aria-label={`${e.unit} water and other charges`} inputMode="numeric" value={e.water || ""} placeholder="0" disabled={e.vacant}
                          onChange={(ev) => patch(i, { water: Number(ev.target.value.replace(/\D/g, "")) || 0 })} />
                      </td>
                      <td className="right num strong">{s.due > 0 ? s.due.toLocaleString() : "—"}</td>
                      <td className="right num ok strong">{s.paid > 0 ? s.paid.toLocaleString() : "—"}</td>
                      <td className={`right num strong ${s.balance > 0 ? "owe" : "ok"}`}>
                        {e.vacant ? "—" : s.balance > 0 ? s.balance.toLocaleString() : s.balance < 0 ? `Over ${(-s.balance).toLocaleString()}` : "—"}
                      </td>
                      <td><span className={`pill pill-${s.status}`}>{STATUS_LABEL[s.status]}</span></td>
                      <td className="right">
                        <button className="btn btn-soft btn-sm" onClick={() => setOpen({ floor: e.floor, unit: e.unit, prompt: false })}>
                          Payments
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* phones: one card per unit */}
          <div className="unit-cards">
            {floorStates.map(({ e, s }) => {
              const i = idx(e.floor, e.unit);
              return (
                <article key={e.unit} className={`ucard ${e.vacant ? "is-vacant" : ""}`}>
                  <div className="ucard-head">
                    <span className="u">{e.unit}</span>
                    <span className={`pill pill-${s.status}`}>{STATUS_LABEL[s.status]}</span>
                  </div>
                  <div className="ucard-edit">
                    <label className="field"><span>Tenant</span>
                      <input className="input" value={e.tenant} disabled={e.vacant} placeholder="Name" onChange={(ev) => patch(i, { tenant: ev.target.value })} /></label>
                    <label className="field"><span>Phone</span>
                      <input className="input" inputMode="tel" value={e.phone} disabled={e.vacant} placeholder="07XX XXX XXX" onChange={(ev) => patch(i, { phone: ev.target.value })} /></label>
                  </div>
                  <dl className="ucard-figs">
                    <div><dt>Due</dt><dd>{s.due.toLocaleString()}</dd></div>
                    <div><dt>Paid</dt><dd className="ok">{s.paid.toLocaleString()}</dd></div>
                    <div><dt>{s.balance < 0 ? "Overpaid" : "Balance"}</dt><dd className={s.balance > 0 ? "owe" : ""}>{e.vacant ? "—" : Math.abs(s.balance).toLocaleString()}</dd></div>
                  </dl>
                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setOpen({ floor: e.floor, unit: e.unit, prompt: false })}>
                    Payments and tools
                  </button>
                </article>
              );
            })}
          </div>

          <dl className="sumbar">
            <div><dt>Due this month</dt><dd>{fmt(floorTotals.due)}</dd></div>
            <div><dt>Collected</dt><dd className="ok">{fmt(floorTotals.paid)}</dd></div>
            <div><dt>Outstanding</dt><dd className={floorTotals.balance > 0 ? "owe" : "ok"}>{fmt(Math.max(floorTotals.balance, 0))}</dd></div>
            <div><dt>Rate</dt><dd className={floorTotals.rate >= 80 ? "ok" : "owe"}>{floorTotals.rate}%</dd></div>
            <div><dt>Units clear</dt><dd>{floorTotals.clear}/{total}</dd></div>
          </dl>

          <section className="card mt-24" aria-labelledby="imp">
            <h2 className="h2 mb-8" id="imp">Import an M-Pesa statement</h2>
            <p className="muted mb-16">
              Upload the CSV from your M-Pesa statement. Incoming payments are matched to units by tenant name,
              or by an exact outstanding amount. Check the matches, then record them. Receipts already on file are skipped.
            </p>
            <button className="btn btn-line" onClick={() => fileRef.current?.click()}><IconUpload /> Choose a CSV file</button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} aria-label="Choose an M-Pesa statement CSV"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsvChosen(f); }} />
            {importMsg && (
              <div className={`banner mt-16 ${importMsg.ok ? "banner-ok" : "banner-bad"}`} role="status" style={{ marginBottom: 0 }}>
                {importMsg.ok ? <IconCheck /> : <IconAlert />}<span>{importMsg.text}</span>
              </div>
            )}
            {txns.length > 0 && (
              <>
                <div className="tbl-wrap mt-16" style={{ boxShadow: "none" }}>
                  <table className="data">
                    <thead><tr><th>Receipt</th><th>Date</th><th>Details</th><th className="right">Amount</th><th>Assign to</th></tr></thead>
                    <tbody>
                      {txns.map((t, ti) => (
                        <tr key={ti}>
                          <td style={{ whiteSpace: "nowrap" }}>{t.receipt || "—"}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{t.date || "—"}</td>
                          <td className="small" style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.details || "—"}</td>
                          <td className="right strong">{t.amount.toLocaleString()}</td>
                          <td>
                            <select className="select" aria-label={`Assign payment ${t.receipt || ti + 1} to a unit`} value={assign[ti] ?? -1}
                              onChange={(e) => setAssign((p) => p.map((v, k) => (k === ti ? +e.target.value : v)))}>
                              <option value={-1}>Skip</option>
                              {mv.eff.map((r, ri) => (
                                <option key={ri} value={ri}>Floor {r.floor}, {r.unit}{r.tenant ? ` (${r.tenant})` : ""}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="row gap-8 mt-16" style={{ justifyContent: "flex-end" }}>
                  <button className="btn btn-line" onClick={() => { setTxns([]); setAssign([]); if (fileRef.current) fileRef.current.value = ""; }}>Cancel</button>
                  <button className="btn btn-primary" disabled={matched === 0} onClick={applyImport}>
                    Record {matched} payment{matched === 1 ? "" : "s"}
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}

      <div className="row gap-8 mt-24" style={{ justifyContent: "flex-end" }}>
        <Link href="/dashboard" className="btn btn-line">Back to the dashboard</Link>
        <Link href="/reports" className="btn btn-primary">See the report</Link>
      </div>

      {open && openState && (
        <UnitPanel
          key={`${open.floor}|${open.unit}`}
          year={mv.year} month={month}
          entry={openState.e} earlier={earlier}
          state={openState.s}
          payments={mv.payments.filter((p) => p.month === month && p.floor === open.floor && p.unit === open.unit).sort((a, b) => a.createdAt.localeCompare(b.createdAt))}
          allPayments={mv.payments}
          stk={stk} cloud={cloud} autoPrompt={open.prompt}
          onClose={() => setOpen(null)}
          onPatch={(p) => patch(idx(open.floor, open.unit), p)}
          onPrompt={(amt) => requestPayment(openState.e, amt)}
        />
      )}
    </main>
  );
}

export default function CollectPage() {
  return (
    <AuthGuard>
      <CollectInner />
    </AuthGuard>
  );
}
