"use client";

import { useEffect, useState } from "react";

export type Density = "comfortable" | "compact";
const KEY = "menetekel:density";

/** Remembers whether the manager prefers roomy or tight tables. */
export function useDensity(): [Density, (d: Density) => void] {
  const [d, setD] = useState<Density>("comfortable");
  useEffect(() => {
    try { if (localStorage.getItem(KEY) === "compact") setD("compact"); } catch { /* ignore */ }
  }, []);
  const set = (next: Density) => {
    setD(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  };
  return [d, set];
}

export default function DensityToggle({ value, onChange }: { value: Density; onChange: (d: Density) => void }) {
  return (
    <div className="seg density" role="group" aria-label="Row spacing">
      <button aria-pressed={value === "comfortable"} onClick={() => onChange("comfortable")}>Comfortable</button>
      <button aria-pressed={value === "compact"} onClick={() => onChange("compact")}>Compact</button>
    </div>
  );
}
