"use client";

import { useEffect, useMemo, useState } from "react";
import { FLOORS, MONTHS, fmt, unitsForFloor } from "@/lib/config";
import { RentMap, currentRents, rentKey, setRentsFrom, totalRent } from "@/lib/rents";
import { IconCheck, IconInfo } from "./Icons";
import Fold from "./Fold";

/** Edit every unit's rent, and choose the month the change starts from. */
export default function RentEditor({ year, onDone }: { year: number; onDone: (msg: string) => void }) {
  const now = new Date();
  const [from, setFrom] = useState(now.getFullYear() === year ? now.getMonth() : 0);
  const [rents, setRents] = useState<RentMap | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  // Start from the rents in force that month; switching month resets the boxes.
  const start = useMemo(() => (typeof window === "undefined" ? null : currentRents(year, from)), [year, from]);
  useEffect(() => {
    if (!start) return;
    setRents(start);
    setText(Object.fromEntries(Object.entries(start).map(([k, v]) => [k, String(v)])));
    setErr(null);
  }, [start]);

  if (!rents || !start) return null;

  const parsed: RentMap = {};
  let invalid = false;
  for (const k of Object.keys(start)) {
    const n = Number(text[k]);
    if (!Number.isInteger(n) || n < 1) invalid = true;
    parsed[k] = n;
  }
  const changedKeys = Object.keys(start).filter((k) => parsed[k] !== start[k]);

  function save() {
    if (invalid) return setErr("Every unit needs a rent of at least 1.");
    if (changedKeys.length === 0) return setErr("No rents have changed.");
    const ok = confirm(
      `Change the rent of ${changedKeys.length} unit${changedKeys.length === 1 ? "" : "s"} from ${MONTHS[from]} ${year} onward?\n\n` +
      `Months already saved from ${MONTHS[from]} on will use the new rent. Earlier months and payments already recorded are not changed.`
    );
    if (!ok) return;
    const res = setRentsFrom(year, from, parsed);
    setErr(null);
    onDone(
      `Rents updated from ${MONTHS[from]}: ${res.unitsChanged} unit${res.unitsChanged === 1 ? "" : "s"} across ${res.monthsUpdated} saved month${res.monthsUpdated === 1 ? "" : "s"}. ` +
      `Months you open later copy these rents automatically.`
    );
  }

  return (
    <Fold id="rents" title="Rents" hint="Set each unit's monthly rent">
      <p className="muted mb-16">
        Set the monthly rent for each unit. The change starts from the month you pick; earlier months keep the rent they had.
      </p>

      <label className="field mb-16" style={{ maxWidth: 260 }}>
        <span>Change applies from</span>
        <select className="select" value={from} onChange={(e) => setFrom(+e.target.value)}>
          {MONTHS.map((m, i) => <option key={m} value={i}>{m} {year}</option>)}
        </select>
      </label>

      {FLOORS.map((f) => (
        <div key={f} className="mb-16">
          <h3 className="h3 mb-8">Floor {f}{f === 0 && <span className="faint tiny"> · units 6 and 7 are one merged unit</span>}</h3>
          <div className="rentgrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(118px, 1fr))" }}>
            {unitsForFloor(f).map((u) => {
              const k = rentKey(f, u.label);
              const changed = parsed[k] !== start[k];
              return (
                <label key={k} className={`rentbox ${u.merged ? "merged" : ""}`} style={changed ? { borderColor: "var(--brand)" } : undefined}>
                  <span className="u" style={{ display: "block" }}>{u.label}</span>
                  <input className="input" style={{ minHeight: 40, marginTop: 4, fontWeight: 800 }} inputMode="numeric"
                    aria-label={`Floor ${f} ${u.label} monthly rent`}
                    value={text[k] ?? ""}
                    onChange={(e) => setText((t) => ({ ...t, [k]: e.target.value.replace(/\D/g, "") }))} />
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <p className="small muted mb-16">
        Building total <b className="ok">{invalid ? "—" : fmt(totalRent(parsed))}</b> a month
        {!invalid && totalRent(parsed) !== totalRent(start) && <> (was {fmt(totalRent(start))})</>}.
      </p>

      {err && <div className="banner banner-bad" role="alert"><IconInfo /><span>{err}</span></div>}
      <button className="btn btn-primary" onClick={save} disabled={changedKeys.length === 0 || invalid}>
        <IconCheck /> Save {changedKeys.length > 0 ? `${changedKeys.length} change${changedKeys.length === 1 ? "" : "s"}` : "rents"}
      </button>
    </Fold>
  );
}
