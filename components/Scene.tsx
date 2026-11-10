"use client";

import { useEffect, useRef, useState } from "react";
import { Phase, PHASE_LABEL, jacarandaInBloom, phaseFor } from "@/lib/scene";
import { useCalm } from "@/lib/motion";

const STARS = [
  [6, 14], [13, 30], [21, 9], [29, 24], [37, 12], [46, 31], [55, 8], [63, 22],
  [71, 13], [79, 29], [87, 10], [94, 24], [17, 44], [50, 46], [83, 43],
];

function Tree({ x, scale, bloom }: { x: number; scale: number; bloom: boolean }) {
  return (
    <g transform={`translate(${x} 0) scale(${scale})`} className={bloom ? "tree bloom" : "tree"}>
      <rect x="-3" y="-34" width="6" height="34" rx="2" className="trunk" />
      <circle cx="-16" cy="-44" r="17" className="leaf" />
      <circle cx="15" cy="-46" r="19" className="leaf" />
      <circle cx="-1" cy="-62" r="21" className="leaf" />
      <circle cx="-22" cy="-58" r="12" className="leaf hi" />
      <circle cx="20" cy="-64" r="11" className="leaf hi" />
    </g>
  );
}

/**
 * The sky and street the building stands in. It follows Nairobi time: dawn,
 * day, dusk, and a night in which the windows of paid units glow. Purely
 * decorative, so it is hidden from screen readers and drawn flat in Calm mode.
 */
export default function Scene({ children, phase: forced }: { children: React.ReactNode; phase?: Phase }) {
  const calm = useCalm();
  const [phase, setPhase] = useState<Phase>(forced ?? "day");
  const [bloom, setBloom] = useState(false);
  const back = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const read = () => { setPhase(forced ?? phaseFor()); setBloom(jacarandaInBloom()); };
    read();
    const t = setInterval(read, 5 * 60_000);
    return () => clearInterval(t);
  }, [forced]);

  // A little depth: the skyline drifts more slowly than the page.
  useEffect(() => {
    if (calm) { if (back.current) back.current.style.transform = ""; return; }
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (back.current) back.current.style.transform = `translateY(${Math.min(window.scrollY * 0.12, 18)}px)`;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, [calm]);

  return (
    <div className="scene" data-phase={phase} title={PHASE_LABEL[phase]}>
      <div className="scene-sky" aria-hidden>
        <span className="orb" />
        {phase === "night" && (
          <svg className="stars" viewBox="0 0 100 50" preserveAspectRatio="none">
            {STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 0.42 : 0.28} style={{ animationDelay: `${(i % 5) * 0.7}s` }} />)}
          </svg>
        )}
        <div className="scene-back" ref={back}>
          <svg viewBox="0 0 1000 120" preserveAspectRatio="none" className="skyline">
            <path d="M0 120V82h40V60h34v22h28V44h22V30h10v14h20v38h36V56h44v26h30V70h26V40h18V22h8v18h20v42h40V64h30v18h46V48h30v34h24V58h40v24h36V36h14V24h10v12h18v46h44V62h34v20h30V50h26v32h40V68h30v14h36V46h22v36h44V72h28v48Z" />
          </svg>
        </div>
      </div>
      <div className="scene-stage">{children}</div>
      <svg className="scene-trees left" viewBox="-40 -90 80 92" aria-hidden><Tree x={0} scale={1} bloom={bloom} /></svg>
      <svg className="scene-trees right" viewBox="-40 -90 80 92" aria-hidden><Tree x={0} scale={0.86} bloom={bloom} /></svg>
    </div>
  );
}
