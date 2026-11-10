"use client";

import { useEffect, useRef, useState } from "react";

const KEY = "menetekel:calm";
const EVENT = "menetekel:calm";

/** Calm mode: the manager's own switch for turning the animation off. */
export function setCalm(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  if (on) document.documentElement.setAttribute("data-calm", "");
  else document.documentElement.removeAttribute("data-calm");
  window.dispatchEvent(new Event(EVENT));
}

export function calmStored(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

/** True when motion should be skipped: Calm mode is on, or the phone asks for reduced motion. */
export function useCalm(): boolean {
  const [calm, setCalmState] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setCalmState(calmStored() || mq.matches);
    read();
    window.addEventListener(EVENT, read);
    mq.addEventListener?.("change", read);
    return () => {
      window.removeEventListener(EVENT, read);
      mq.removeEventListener?.("change", read);
    };
  }, []);
  return calm;
}

/** Animate a number towards its new value. Jumps straight there in Calm mode. */
export function useCountUp(target: number, calm: boolean, ms = 900): number {
  const [shown, setShown] = useState(target);
  const from = useRef(0);
  const started = useRef(false);

  useEffect(() => {
    if (calm) { from.current = target; setShown(target); started.current = true; return; }
    const start = started.current ? from.current : 0;
    started.current = true;
    if (start === target) { setShown(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(start + (target - start) * eased);
      from.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, calm, ms]);

  return shown;
}

/**
 * Spot the moment money arrives. Given each unit's paid amount, returns the
 * ids whose amount has just gone up, for a couple of seconds. `scope` is the
 * month being shown: changing month is not a payment, so it resets quietly.
 */
export function usePaidPulse(paid: Record<string, number>, scope: string, calm: boolean): Set<string> {
  const prev = useRef<{ scope: string; paid: Record<string, number> } | null>(null);
  const [hot, setHot] = useState<Set<string>>(new Set());
  const signature = JSON.stringify(paid);

  useEffect(() => {
    const before = prev.current;
    prev.current = { scope, paid };
    if (!before || before.scope !== scope || Object.keys(before.paid).length === 0) return;
    const risen = Object.keys(paid).filter((k) => (paid[k] ?? 0) > (before.paid[k] ?? 0));
    if (risen.length === 0) return;
    if (!calm) {
      try { navigator.vibrate?.(35); } catch { /* not supported */ }
    }
    setHot(new Set(risen));
    const t = setTimeout(() => setHot(new Set()), 2600);
    return () => clearTimeout(t);
    // signature stands in for `paid`, which is a new object on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, scope, calm]);

  return hot;
}
