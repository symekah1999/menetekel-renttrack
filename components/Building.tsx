"use client";

import { useEffect, useState } from "react";
import { FLOORS, unitsForFloor } from "@/lib/config";
import { EffEntry } from "@/lib/store";
import { shortUnit, compact, unitState, UnitState, STATUS_LABEL } from "@/lib/status";

export interface UnitView {
  entry: EffEntry;
  state: UnitState;
}

export const unitId = (floor: number, unit: string) => `${floor}|${unit}`;

/**
 * The building as it stands: five floors, each unit a window that fills with
 * colour as its rent comes in. Floor 4 is at the top and the merged Unit 6+7
 * on the ground floor is physically two windows wide.
 */
export default function Building({
  rows,
  billed,
  selected,
  onSelect,
  animKey,
  hot,
  vtId,
  showLegend = true,
}: {
  rows: EffEntry[];
  billed: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  /** Changes when a different month is shown: the windows then refill from the ground floor up. */
  animKey?: string;
  /** Units whose payment has just arrived; their window glows for a moment. */
  hot?: Set<string>;
  /** The window about to grow into the unit panel (shared-element transition). */
  vtId?: string | null;
  showLegend?: boolean;
}) {
  // Start each month empty, then let the fills rise on the next frame.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
    let b = 0;
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setArmed(true)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [animKey]);

  const views = new Map<string, UnitView>();
  for (const e of rows) {
    views.set(unitId(e.floor, e.unit), { entry: e, state: unitState(e, billed) });
  }

  return (
    <div className="facade" role="group" aria-label="Building, floor 4 at the top">
      <div className="cornice" />
      {[...FLOORS].reverse().map((f) => (
        <div className="floor" key={f}>
          <div className="floor-no" aria-hidden>
            {f}
            <small>{f === 0 ? "ground" : ""}</small>
          </div>
          <div className="windows">
            {unitsForFloor(f).map((u, col) => {
              const v = views.get(unitId(f, u.label));
              const st = v?.state;
              const id = unitId(f, u.label);
              const status = st?.status ?? "none";
              const label =
                `Floor ${f}, ${u.label}${v?.entry.tenant ? `, ${v.entry.tenant}` : ""}: ${STATUS_LABEL[status]}` +
                (st && status !== "vacant" && status !== "none" && st.balance > 0 ? `, owes ${st.balance.toLocaleString()} shillings` : "");
              return (
                <button
                  key={id}
                  type="button"
                  className={`win ${u.merged ? "wide" : ""} ${hot?.has(id) ? "just-paid" : ""}`}
                  data-status={status}
                  style={{
                    ["--fill" as string]: `${armed ? st?.fill ?? 0 : 0}%`,
                    ["--i" as string]: f * 7 + col,
                    ...(vtId === id && selected !== id ? { viewTransitionName: "unit-focus" } : {}),
                  }}
                  aria-pressed={selected === id}
                  aria-label={label}
                  onClick={() => onSelect(id)}
                >
                  <span className="win-no">{shortUnit(u.label)}</span>
                  <span className="win-amt">
                    {status === "owe" ? compact(st!.balance)
                      : status === "part" ? compact(st!.paid)
                      : status === "paid" ? "✓"
                      : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="ground" />
      {showLegend && <div className="legend" aria-hidden>
        <span className="l-paid"><i />Paid</span>
        <span className="l-part"><i />Part-paid (fills as rent arrives)</span>
        <span className="l-owe"><i />Owing</span>
        <span className="l-vac"><i />Vacant</span>
      </div>}
    </div>
  );
}
