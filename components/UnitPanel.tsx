"use client";

import { useEffect, useRef, useState } from "react";
import { MONTHS } from "@/lib/config";
import { EffEntry, Entry, whatsAppLink } from "@/lib/store";
import {
  Payment, canReverse, findDuplicateReceipt, nairobiDate, paymentsForUnit, reversalOf, reversedIds,
} from "@/lib/ledger";
import { UnitState, STATUS_LABEL } from "@/lib/status";
import { addPayment } from "@/lib/cloud";
import { IconChat, IconPhone, IconReceipt, IconUndo, IconX, IconPlus, IconCheck, IconAlert } from "./Icons";

export interface StkState {
  unit: string;
  phase: "sending" | "waiting" | "done" | "failed";
  msg: string;
}

const SOURCE_LABEL: Record<Payment["source"], string> = {
  stk: "M-Pesa prompt",
  csv: "Statement import",
  manual: "Entered by hand",
  reversal: "Reversal",
};

export default function UnitPanel({
  year, month, entry, earlier, state, payments, allPayments, stk, cloud, autoPrompt,
  onClose, onPatch, onPrompt,
}: {
  year: number;
  month: number;
  entry: EffEntry;
  earlier: number; // owed from earlier months, for context only
  state: UnitState;
  payments: Payment[]; // this unit, this month
  allPayments: Payment[]; // whole year, for duplicate-receipt checks
  stk: StkState | null;
  cloud: boolean;
  autoPrompt: boolean;
  onClose: () => void;
  onPatch: (patch: Partial<Entry>) => void;
  onPrompt: (amount: number) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState("");
  const [paidOn, setPaidOn] = useState(nairobiDate());
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [promptAmt, setPromptAmt] = useState(String(Math.max(state.balance, 0) || ""));

  // Focus, Escape to close, and keep the page behind from scrolling.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    if (autoPrompt) document.getElementById("prompt-amount")?.focus();
  }, [autoPrompt]);

  const reversed = reversedIds(payments);
  const waiting = stk !== null && stk.unit === entry.unit && (stk.phase === "sending" || stk.phase === "waiting");
  const busyElsewhere = stk !== null && stk.unit !== entry.unit && (stk.phase === "sending" || stk.phase === "waiting");

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.round(Number(amount));
    if (!Number.isFinite(n) || n < 1) return setErr("Enter an amount of at least 1.");
    const dup = findDuplicateReceipt(allPayments, receipt);
    if (dup) {
      return setErr(`Receipt ${dup.receipt} is already recorded for Floor ${dup.floor}, ${dup.unit} on ${dup.paidOn}.`);
    }
    setErr(null);
    const p: Payment = {
      id: crypto.randomUUID(), year, month, floor: entry.floor, unit: entry.unit,
      amount: n, receipt: receipt.trim().toUpperCase(), source: "manual",
      paidOn: paidOn.trim() || nairobiDate(), note: note.trim() || undefined,
      createdAt: new Date().toISOString(), synced: false,
    };
    await addPayment(p);
    setAmount(""); setReceipt(""); setNote("");
  }

  async function reverse(p: Payment) {
    if (!confirm(`Reverse the KSh ${p.amount.toLocaleString()} payment${p.receipt ? ` (${p.receipt})` : ""}? A reversal entry is added; the original stays on record.`)) return;
    await addPayment(reversalOf(p, crypto.randomUUID()));
  }

  async function receiptPdf() {
    const { downloadReceiptPdf } = await import("@/lib/exportPdf");
    const receipts = payments.filter((p) => p.source !== "reversal" && !reversed.has(p.id) && p.receipt).map((p) => p.receipt);
    downloadReceiptPdf(month, { ...entry, receipt: receipts.join(" ") });
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="panel-title">
        <div className="sheet-head">
          <div>
            <h2 className="h2" id="panel-title">Floor {entry.floor}, {entry.unit}</h2>
            <p className="muted small">
              {entry.tenant || (entry.vacant ? "Vacant" : "No tenant name yet")} · {MONTHS[month]} {year}
            </p>
          </div>
          <button ref={closeRef} className="btn btn-line btn-icon" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <div className="card card-flat mb-16">
          <div className="row between">
            <span className={`pill pill-${state.status}`}>{STATUS_LABEL[state.status]}</span>
            <span className="faint small">Rent {entry.rent.toLocaleString()}{entry.water ? ` + water ${entry.water.toLocaleString()}` : ""}</span>
          </div>
          <dl className="kv mt-12">
            <div><dt>Due</dt><dd>{state.due.toLocaleString()}</dd></div>
            <div><dt>Paid</dt><dd className="ok">{state.paid.toLocaleString()}</dd></div>
            <div>
              <dt>{state.balance < 0 ? "Overpaid" : "Balance"}</dt>
              <dd className={state.balance > 0 ? "owe" : ""}>{Math.abs(state.balance).toLocaleString()}</dd>
            </div>
          </dl>
          {earlier > 0 && (
            <p className="small muted mt-12">
              This unit also owes <b className="owe">{earlier.toLocaleString()}</b> from earlier months. It is not part of this month&apos;s due;
              see the Cumulative page.
            </p>
          )}
        </div>

        {!entry.vacant && (
          <section className="card card-flat mb-16" aria-labelledby="stk-h">
            <h3 className="h3 mb-8" id="stk-h">Ask for payment on M-Pesa</h3>
            {!cloud ? (
              <p className="muted small">Needs cloud accounts to be set up. Until then, record payments by hand below.</p>
            ) : !entry.phone.trim() ? (
              <p className="muted small">Add this tenant&apos;s phone number first.</p>
            ) : (
              <>
                <div className="row gap-8 wrap">
                  <label className="field grow" style={{ minWidth: 130 }}>
                    <span>Amount (KSh)</span>
                    <input id="prompt-amount" className="input" inputMode="numeric" value={promptAmt}
                      onChange={(e) => setPromptAmt(e.target.value.replace(/\D/g, ""))} />
                  </label>
                  <button className="btn btn-primary" style={{ alignSelf: "flex-end" }}
                    disabled={waiting || busyElsewhere || !Number(promptAmt)}
                    onClick={() => onPrompt(Math.round(Number(promptAmt)))}>
                    <IconPhone /> Send to {entry.phone}
                  </button>
                </div>
                {stk && stk.unit === entry.unit && (
                  <div className={`banner mt-12 ${stk.phase === "done" ? "banner-ok" : stk.phase === "failed" ? "banner-bad" : ""}`} role="status" style={{ marginBottom: 0 }}>
                    {stk.phase === "done" ? <IconCheck /> : stk.phase === "failed" ? <IconAlert /> : <IconPhone />}
                    <span>{stk.msg}</span>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <section className="card card-flat mb-16" aria-labelledby="pay-h">
          <h3 className="h3 mb-12" id="pay-h">Record a payment</h3>
          <form onSubmit={submitPayment} className="stack gap-12">
            <div className="row gap-8 wrap">
              <label className="field grow" style={{ minWidth: 120 }}>
                <span>Amount (KSh)</span>
                <input className="input" inputMode="numeric" value={amount} required
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
              </label>
              <label className="field grow" style={{ minWidth: 120 }}>
                <span>M-Pesa receipt</span>
                <input className="input" value={receipt} placeholder="optional" autoCapitalize="characters"
                  onChange={(e) => setReceipt(e.target.value)} />
              </label>
            </div>
            <div className="row gap-8 wrap">
              <label className="field" style={{ width: 140 }}>
                <span>Date paid</span>
                <input className="input" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
              </label>
              <label className="field grow" style={{ minWidth: 120 }}>
                <span>Note</span>
                <input className="input" value={note} placeholder="optional" onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            {err && <div className="banner banner-bad" role="alert" style={{ marginBottom: 0 }}><IconAlert /><span>{err}</span></div>}
            <button className="btn btn-soft" type="submit"><IconPlus /> Add payment</button>
          </form>
        </section>

        <section className="card card-flat mb-16" aria-labelledby="hist-h">
          <h3 className="h3 mb-8" id="hist-h">Payments this month</h3>
          {payments.length === 0 && entry.manualPaid === 0 ? (
            <p className="muted small">Nothing received yet.</p>
          ) : (
            <div>
              {payments.map((p) => {
                const isReversed = reversed.has(p.id);
                return (
                  <div key={p.id} className={`pay-row ${isReversed ? "is-reversed" : ""}`}>
                    <div>
                      <div className="strong small">
                        {SOURCE_LABEL[p.source]}{p.receipt ? ` · ${p.receipt}` : ""}
                        {p.synced === false && <span className="pill pill-part" style={{ marginLeft: 8 }}>Not sent yet</span>}
                      </div>
                      <div className="faint tiny">{p.paidOn}{p.note ? ` · ${p.note}` : ""}{isReversed ? " · reversed" : ""}</div>
                    </div>
                    <div className="amt" style={{ color: p.amount < 0 ? "var(--owe)" : undefined }}>
                      {p.amount < 0 ? "−" : ""}{Math.abs(p.amount).toLocaleString()}
                    </div>
                    {canReverse(p, payments) && (
                      <button className="btn btn-sm btn-line" style={{ gridColumn: "1 / -1", justifySelf: "start", marginTop: 6 }} onClick={() => reverse(p)}>
                        <IconUndo /> Reverse
                      </button>
                    )}
                  </div>
                );
              })}
              {entry.manualPaid !== 0 && (
                <div className="pay-row">
                  <div>
                    <div className="strong small">Entered before the ledger</div>
                    <div className="faint tiny">Typed into the month record in an earlier version. Edit if it was wrong.</div>
                  </div>
                  <input className="input" style={{ width: 110, textAlign: "right" }} inputMode="numeric"
                    aria-label="Amount entered before the ledger"
                    value={entry.manualPaid || ""}
                    onChange={(e) => onPatch({ paid: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
                </div>
              )}
            </div>
          )}
        </section>

        <section className="card card-flat" aria-labelledby="tools-h">
          <h3 className="h3 mb-12" id="tools-h">Tenant and tools</h3>
          <div className="stack gap-12">
            <label className="field"><span>Tenant name</span>
              <input className="input" value={entry.tenant} disabled={entry.vacant} onChange={(e) => onPatch({ tenant: e.target.value })} /></label>
            <div className="row gap-8 wrap">
              <label className="field grow" style={{ minWidth: 150 }}><span>Phone</span>
                <input className="input" inputMode="tel" placeholder="07XX XXX XXX" value={entry.phone} disabled={entry.vacant}
                  onChange={(e) => onPatch({ phone: e.target.value })} /></label>
              <label className="field" style={{ width: 130 }}><span>Water and other</span>
                <input className="input" inputMode="numeric" value={entry.water || ""} disabled={entry.vacant}
                  onChange={(e) => onPatch({ water: Number(e.target.value.replace(/\D/g, "")) || 0 })} /></label>
            </div>
            <label className="row gap-8" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={entry.vacant} style={{ width: 20, height: 20, accentColor: "var(--brand)" }}
                onChange={(e) => onPatch({ vacant: e.target.checked })} />
              <span>This unit is vacant this month</span>
            </label>
            <div className="row gap-8 wrap">
              <button className="btn btn-line btn-sm" disabled={state.paid <= 0} onClick={receiptPdf}><IconReceipt /> Receipt PDF</button>
              <a className={`btn btn-line btn-sm ${state.balance <= 0 || entry.vacant ? "" : ""}`}
                aria-disabled={state.balance <= 0 || entry.vacant}
                style={state.balance <= 0 || entry.vacant ? { opacity: 0.45, pointerEvents: "none" } : undefined}
                target="_blank" rel="noreferrer" href={whatsAppLink(entry, state.balance, MONTHS[month], year)}>
                <IconChat /> WhatsApp reminder
              </a>
            </div>
          </div>
        </section>
      </aside>
    </>
  );
}
