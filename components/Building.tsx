"use client";

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
}: {
  rows: EffEntry[];
  billed: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
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
            {unitsForFloor(f).map((u) => {
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
                  className={`win ${u.merged ? "wide" : ""}`}
                  data-status={status}
                  style={{ ["--fill" as string]: `${st?.fill ?? 0}%` }}
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
      <div className="legend" aria-hidden>
        <span className="l-paid"><i />Paid</span>
        <span className="l-part"><i />Part-paid (fills as rent arrives)</span>
        <span className="l-owe"><i />Owing</span>
        <span className="l-vac"><i />Vacant</span>
      </div>
    </div>
  );
}
