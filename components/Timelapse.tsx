"use client";

import { useEffect, useMemo, useState } from "react";
import { MONTHS } from "@/lib/config";
import { applyLedger, getActiveYear, hasMonthData, loadMonth, loadPayments } from "@/lib/store";
import { totalOf } from "@/lib/timelapse";
import Building from "./Building";
import { IconPause, IconPlay } from "./Icons";

/** Watch the building change month by month, from January to the month chosen above. */
export default function Timelapse({ through }: { through: number }) {
  const [year, setYear] = useState<number | null>(null);
  const [m, setM] = useState(through);
  const [playing, setPlaying] = useState(false);

  useEffect(() => { setYear(getActiveYear()); }, []);
  useEffect(() => { setM(through); setPlaying(false); }, [through]);

  const first = useMemo(() => {
    if (year === null) return 0;
    for (let k = 0; k <= through; k++) if (hasMonthData(k, year)) return k;
    return 0;
  }, [year, through]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setM((cur) => Math.min(cur + 1, through)), 1300);
    return () => clearInterval(t);
  }, [playing, through]);

  // Stop the moment the last month is reached.
  useEffect(() => {
    if (playing && m >= through) setPlaying(false);
  }, [playing, m, through]);

  const { rows, billed, collected, rate } = useMemo(() => {
    if (year === null) return { rows: [], billed: false, collected: 0, rate: 0 };
    const raw = loadMonth(m, year);
    const eff = applyLedger(raw, loadPayments(year), year, m);
    const t = totalOf(eff);
    return { rows: eff, billed: hasMonthData(m, year), collected: t.collected, rate: t.rate };
  }, [m, year]);

  if (year === null || !hasMonthData(first, year)) return null;

  function play() {
    if (playing) { setPlaying(false); return; }
    if (m >= through) setM(first);
    setPlaying(true);
  }

  return (
    <section className="card lapse mb-16" aria-labelledby="lapse-h">
      <h2 className="h2 mb-4" id="lapse-h">Watch the year</h2>
      <p className="muted small mb-16">Drag the slider, or press play, to see how each month filled up.</p>
      <div className="lapse-controls">
        <button className="btn btn-soft btn-icon" onClick={play} aria-label={playing ? "Pause the timelapse" : "Play the timelapse"}>
          {playing ? <IconPause /> : <IconPlay />}
        </button>
        <span className="lapse-month" aria-live="polite">{MONTHS[m]} {year}</span>
        <input type="range" min={first} max={through} value={Math.min(Math.max(m, first), through)} aria-label="Month"
          onChange={(e) => { setPlaying(false); setM(+e.target.value); }} />
      </div>
      <p className="small muted mb-12">
        {billed ? <>KSh <b>{collected.toLocaleString()}</b> collected, <b>{rate}%</b> of what was due.</> : "This month was not opened."}
      </p>
      <Building rows={rows} billed={billed} selected={null} onSelect={() => {}} animKey={`lapse-${m}`} showLegend={false} />
    </section>
  );
}
