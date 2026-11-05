"use client";

import { useState } from "react";
import { compact } from "@/lib/status";

/**
 * A money figure. On wide screens it is always written in full; on phones it
 * shortens to "KSh 194.7k" and a tap shows the exact amount.
 */
export default function Amt({ n, className }: { n: number; className?: string }) {
  const [full, setFull] = useState(false);
  const neg = n < 0;
  const abs = Math.abs(n);
  return (
    <span
      className={`amt ${full ? "is-full" : ""} ${className ?? ""}`}
      role="button" tabIndex={0}
      aria-label={`KSh ${n.toLocaleString()}`}
      onClick={() => setFull((f) => !f)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFull((f) => !f); } }}
    >
      <span className="amt-f">{neg ? "−" : ""}KSh {abs.toLocaleString()}</span>
      <span className="amt-s" aria-hidden>{neg ? "−" : ""}KSh {compact(abs)}</span>
    </span>
  );
}
