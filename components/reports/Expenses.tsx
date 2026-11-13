"use client";

import { useState } from "react";
import { MONTHS } from "@/lib/config";
import { CATEGORY_LABEL, Expense, ExpenseCategory, canReverseExpense, expenseReversal, expenseTotals, reversedExpenseIds } from "@/lib/expenses";
import { addExpense, expensesSyncError } from "@/lib/expensesStore";
import { cloudConfigured } from "@/lib/supabase";
import { nairobiDate } from "@/lib/ledger";
import { ReportData } from "./data";
import { IconPlus, IconUndo, IconAlert } from "@/components/Icons";

/** Money spent on the building, so reports can show net income, not just collections. */
export default function Expenses({ d, month, setMonth }: { d: ReportData; month: number; setMonth: (m: number) => void }) {
  const [category, setCategory] = useState<ExpenseCategory>("repairs");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(nairobiDate());
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const list = d.expenses.filter((e) => e.month === month).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reversed = reversedExpenseIds(d.expenses);
  const monthTot = expenseTotals(d.expenses, [month]);
  const yearTot = expenseTotals(d.expenses);
  const collected = d.facts[month].collected;
  const ytdCollected = d.facts.slice(0, month + 1).reduce((s, f) => s + f.collected, 0);
  const ytdSpent = expenseTotals(d.expenses, Array.from({ length: month + 1 }, (_, i) => i)).total;
  const unsynced = d.expenses.some((e) => e.synced === false);
  const syncErr = expensesSyncError();

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.round(Number(amount));
    if (!Number.isFinite(n) || n < 1) return setErr("Enter an amount of at least 1.");
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date.trim())) return setErr("Write the date as dd/mm/yyyy.");
    setErr(null);
    const x: Expense = {
      id: crypto.randomUUID(), year: d.year, month, date: date.trim(), category, amount: n,
      note: note.trim().slice(0, 500) || undefined, createdAt: new Date().toISOString(), synced: false,
    };
    await addExpense(x);
    setAmount(""); setNote(""); d.reload();
  }

  async function reverse(x: Expense) {
    if (!confirm(`Reverse the KSh ${x.amount.toLocaleString()} ${CATEGORY_LABEL[x.category].toLowerCase()} entry? A reversal is added; the original stays on record.`)) return;
    await addExpense(expenseReversal(x, crypto.randomUUID()));
    d.reload();
  }

  return (
    <>
      <div className="period-bar">
        <select className="select" style={{ width: 190 }} aria-label="Month" value={month} onChange={(e) => setMonth(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m} {d.year}</option>)}
        </select>
      </div>

      {cloudConfigured() && unsynced && (
        <div className="banner banner-warn" role="status">
          <IconAlert /><span>Some expenses are saved on this device only.{syncErr && /expenses|relation|schema/i.test(syncErr) ? " The expenses table has not been created yet: run supabase-expenses.sql in Supabase." : " They will be sent when the connection allows."}</span>
        </div>
      )}

      <dl className="kpis rkpis stagger">
        <div className="kpi"><dt>Spent in {MONTHS[month]}</dt><dd>KSh {monthTot.total.toLocaleString()}</dd></div>
        <div className="kpi"><dt>Collected in {MONTHS[month]}</dt><dd className="ok">KSh {collected.toLocaleString()}</dd></div>
        <div className="kpi"><dt>Net for {MONTHS[month]}</dt><dd className={collected - monthTot.total < 0 ? "owe" : ""}>KSh {(collected - monthTot.total).toLocaleString()}</dd></div>
        <div className="kpi"><dt>Net, year to {MONTHS[month].slice(0, 3)}</dt><dd>KSh {(ytdCollected - ytdSpent).toLocaleString()}</dd></div>
      </dl>

      <div className="rgrid-2 mb-16">
        <section className="card" aria-labelledby="ex-add">
          <h3 className="h3 mb-12" id="ex-add">Add an expense</h3>
          <form className="stack gap-12" onSubmit={add}>
            <label className="field"><span>Category</span>
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).map((k) => <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>)}
              </select></label>
            <div className="row gap-8 wrap">
              <label className="field grow" style={{ minWidth: 120 }}><span>Amount (KSh)</span>
                <input className="input" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} /></label>
              <label className="field" style={{ width: 140 }}><span>Date</span>
                <input className="input" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            </div>
            <label className="field"><span>Note (optional)</span>
              <input className="input" value={note} maxLength={500} placeholder="e.g. Replaced gate hinge" onChange={(e) => setNote(e.target.value)} /></label>
            {err && <div className="banner banner-bad" role="alert" style={{ marginBottom: 0 }}><IconAlert /><span>{err}</span></div>}
            <button className="btn btn-primary" type="submit"><IconPlus /> Add expense</button>
          </form>
        </section>

        <section className="card" aria-labelledby="ex-cat">
          <h3 className="h3 mb-12" id="ex-cat">By category</h3>
          <ul className="ch-list">
            {(Object.keys(CATEGORY_LABEL) as ExpenseCategory[]).filter((k) => yearTot.byCategory[k] !== 0 || monthTot.byCategory[k] !== 0).map((k) => (
              <li key={k}><span>{CATEGORY_LABEL[k]}</span><b>{monthTot.byCategory[k].toLocaleString()} <span className="faint small">/ {yearTot.byCategory[k].toLocaleString()} this year</span></b></li>
            ))}
            {yearTot.total === 0 && <li className="faint">No expenses recorded this year.</li>}
          </ul>
        </section>
      </div>

      <section className="card" aria-labelledby="ex-list">
        <h3 className="h3 mb-8" id="ex-list">{MONTHS[month]} entries</h3>
        {list.length === 0 ? <p className="muted small">Nothing recorded for {MONTHS[month]}.</p> : (
          <ul className="recent-list">
            {list.map((x) => {
              const rev = reversed.has(x.id);
              return (
                <li key={x.id} className={`ex-row ${rev ? "is-reversed" : ""}`}>
                  <span className="recent-main">
                    <span className="strong">{CATEGORY_LABEL[x.category]}{x.synced === false && cloudConfigured() && <span className="pill pill-part" style={{ marginLeft: 8 }}>Not sent yet</span>}</span>
                    <span className="faint small">{x.date}{x.note ? ` · ${x.note}` : ""}{rev ? " · reversed" : ""}</span>
                  </span>
                  <span className={`recent-amt ${x.amount < 0 ? "ok" : ""}`}>{x.amount < 0 ? "−" : ""}{Math.abs(x.amount).toLocaleString()}</span>
                  {canReverseExpense(x, d.expenses) && <button className="btn btn-line btn-sm" onClick={() => reverse(x)}><IconUndo /> Reverse</button>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
