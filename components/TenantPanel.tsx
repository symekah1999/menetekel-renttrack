"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MONTHS } from "@/lib/config";
import { loadCumulative, earlierBalance } from "@/lib/cumulative";
import {
  TenantDetails, cleanDetails, setTenantFrom, tenantHistory, validEmail, validPhone,
} from "@/lib/tenants";
import { IconAlert, IconCheck, IconX } from "./Icons";

/** Side panel to fill in or change a unit's tenant, effective from a chosen month. */
export default function TenantPanel({
  year, floor, unit, current, opened, defaultFrom, onClose, onSaved,
}: {
  year: number;
  floor: number;
  unit: string;
  current: TenantDetails; // as of the month being viewed
  opened: number[]; // opened months of the year
  defaultFrom: number;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [form, setForm] = useState<TenantDetails>(current);
  const [from, setFrom] = useState(defaultFrom);
  const [errs, setErrs] = useState<string[]>([]);
  const set = <K extends keyof TenantDetails>(k: K, v: TenantDetails[K]) => setForm((f) => ({ ...f, [k]: v }));

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

  const history = useMemo(() => tenantHistory(year, floor, unit), [year, floor, unit]);

  // A new person (or a move-out) leaves the unit's earlier balance behind: say so.
  const changingPerson =
    (form.vacant && !current.vacant) ||
    (!form.vacant && !!current.tenant && !!form.tenant.trim() && form.tenant.trim() !== current.tenant);
  const owed = useMemo(() => {
    if (!changingPerson || from <= 0) return 0;
    return Math.max(0, earlierBalance(loadCumulative(from - 1, year), floor, unit, from));
  }, [changingPerson, from, year, floor, unit]);

  // The old number would send M-Pesa prompts to the wrong person.
  const oldPhoneKept = changingPerson && !form.vacant && !!form.phone.trim() && form.phone.trim() === current.phone.trim();

  function save(e: React.FormEvent) {
    e.preventDefault();
    const d = cleanDetails(form);
    const problems: string[] = [];
    if (!d.vacant && !d.tenant) problems.push("Enter the tenant's name, or tick that the unit is vacant.");
    if (d.phone && !validPhone(d.phone)) problems.push("That phone number isn't a Kenyan mobile number (07XX XXX XXX or 01XX XXX XXX).");
    if (d.email && !validEmail(d.email)) problems.push("That email address doesn't look right.");
    setErrs(problems);
    if (problems.length) return;
    if (oldPhoneKept && !confirm(`The phone number (${d.phone}) is the same as the previous tenant's, so M-Pesa prompts and reminders would still go to them. Save anyway?`)) return;
    const months = setTenantFrom(year, from, floor, unit, d);
    const where = `Floor ${floor}, ${unit}`;
    onSaved(
      months === 0
        ? `Nothing changed for ${where}.`
        : (d.vacant ? `${where} is now recorded as vacant from ${MONTHS[from]}. ` : `Saved ${d.tenant} for ${where} from ${MONTHS[from]}. `) +
          `${months} saved month${months === 1 ? "" : "s"} updated; Collect rent, reports and reminders now use these details.`
    );
    onClose();
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside className="sheet" role="dialog" aria-modal="true" aria-labelledby="tp-title">
        <div className="sheet-head">
          <div>
            <h2 className="h2" id="tp-title">Floor {floor}, {unit}</h2>
            <p className="muted small">{current.vacant ? "Vacant" : current.tenant || "No tenant recorded yet"}</p>
          </div>
          <button ref={closeRef} className="btn btn-line btn-icon" onClick={onClose} aria-label="Close"><IconX /></button>
        </div>

        <form onSubmit={save} className="stack gap-16" noValidate>
          <section className="card card-flat stack gap-12">
            <label className="field">
              <span>These details apply from</span>
              <select className="select" value={from} onChange={(e) => setFrom(+e.target.value)}>
                {opened.map((m) => <option key={m} value={m}>{MONTHS[m]} {year}</option>)}
              </select>
            </label>
            <p className="faint tiny">
              Months from {MONTHS[from]} on show these details. Earlier months keep the tenant they had, so past receipts and reports still name the right person.
              Pick an earlier month to correct a mistake in earlier months too.
            </p>
          </section>

          <section className="card card-flat stack gap-12">
            <label className="row gap-8" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={form.vacant} style={{ width: 20, height: 20, accentColor: "var(--brand)" }}
                onChange={(e) => set("vacant", e.target.checked)} />
              <span>The unit is vacant (the tenant has moved out)</span>
            </label>

            <label className="field"><span>Full name</span>
              <input className="input" value={form.tenant} disabled={form.vacant} autoComplete="off"
                onChange={(e) => set("tenant", e.target.value)} /></label>
            <div className="row gap-8 wrap">
              <label className="field grow" style={{ minWidth: 150 }}><span>Phone (for M-Pesa prompts)</span>
                <input className="input" inputMode="tel" placeholder="07XX XXX XXX" value={form.phone} disabled={form.vacant}
                  onChange={(e) => set("phone", e.target.value)} /></label>
              <label className="field grow" style={{ minWidth: 150 }}><span>ID or passport number</span>
                <input className="input" value={form.idNo} disabled={form.vacant} autoComplete="off"
                  onChange={(e) => set("idNo", e.target.value)} /></label>
            </div>
            <label className="field"><span>Email (optional)</span>
              <input className="input" type="email" inputMode="email" value={form.email} disabled={form.vacant}
                onChange={(e) => set("email", e.target.value)} /></label>
            <div className="row gap-8 wrap">
              <label className="field grow" style={{ minWidth: 150 }}><span>Moved in on</span>
                <input className="input" type="date" value={form.moveIn} disabled={form.vacant}
                  onChange={(e) => set("moveIn", e.target.value)} /></label>
              <label className="field grow" style={{ minWidth: 150 }}><span>Deposit paid (KSh)</span>
                <input className="input" inputMode="numeric" value={form.deposit || ""} disabled={form.vacant}
                  onChange={(e) => set("deposit", Number(e.target.value.replace(/\D/g, "")) || 0)} /></label>
            </div>
            <label className="field"><span>Notes (optional)</span>
              <textarea className="input textarea" value={form.notes} disabled={form.vacant}
                onChange={(e) => set("notes", e.target.value)} /></label>
          </section>

          {oldPhoneKept && (
            <div className="banner banner-warn" role="note" style={{ marginBottom: 0 }}>
              <IconAlert />
              <span>The phone number is still the previous tenant&apos;s. Replace it with the new tenant&apos;s number so M-Pesa prompts and reminders reach the right person.</span>
            </div>
          )}

          {owed > 0 && (
            <div className="banner banner-warn" role="note" style={{ marginBottom: 0 }}>
              <IconAlert />
              <span>
                This unit still owes <b>KSh {owed.toLocaleString()}</b> from months before {MONTHS[from]}. That balance stays on the
                unit in Cumulative under the new details, so settle it with the previous tenant before they leave.
              </span>
            </div>
          )}

          {errs.length > 0 && (
            <div className="banner banner-bad" role="alert" style={{ marginBottom: 0 }}>
              <IconAlert /><span>{errs.map((m) => <span key={m} style={{ display: "block" }}>{m}</span>)}</span>
            </div>
          )}

          <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-line" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary"><IconCheck /> Save details</button>
          </div>
        </form>

        <section className="card card-flat mt-16" aria-labelledby="th">
          <h3 className="h3 mb-12" id="th">Who has lived here in {year}</h3>
          {history.length === 0 ? (
            <p className="muted small">No months opened yet.</p>
          ) : (
            <ul className="history">
              {history.map((r, i) => (
                <li key={i} className={i === history.length - 1 ? "now" : ""}>
                  <span>{r.vacant ? "Vacant" : r.tenant || "Nobody recorded"}</span>
                  <span className="muted">{r.fromMonth === r.toMonth ? MONTHS[r.fromMonth].slice(0, 3) : `${MONTHS[r.fromMonth].slice(0, 3)} to ${MONTHS[r.toMonth].slice(0, 3)}`}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="faint tiny mt-12">
            Payments stay with the unit. <Link href={`/collect?month=${from}&floor=${floor}&unit=${encodeURIComponent(unit)}`} style={{ textDecoration: "underline" }}>Open this unit in Collect rent</Link>
          </p>
        </section>
      </aside>
    </>
  );
}
