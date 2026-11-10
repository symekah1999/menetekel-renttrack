"use client";

import { useEffect, useState } from "react";
import { useCountUp } from "@/lib/motion";

/** The month's collection rate as a ring that fills when it appears. */
export default function RateRing({ value, calm, size = 132 }: { value: number; calm: boolean; size?: number }) {
  const r = 52, c = 2 * Math.PI * r;
  const [shown, setShown] = useState(calm ? value : 0);
  useEffect(() => {
    if (calm) { setShown(value); return; }
    const t = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(t);
  }, [value, calm]);
  const n = useCountUp(value, calm, 1000);
  const pct = Math.max(0, Math.min(100, shown));
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${value}% of this month's rent collected`}>
      <svg viewBox="0 0 120 120" aria-hidden>
        <circle cx="60" cy="60" r={r} className="ring-track" />
        <circle cx="60" cy="60" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} />
      </svg>
      <span className="ring-label" aria-hidden><b>{n}%</b><small>collected</small></span>
    </div>
  );
}
