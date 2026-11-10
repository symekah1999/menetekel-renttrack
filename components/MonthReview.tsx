"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MONTHS } from "@/lib/config";
import type { EffEntry } from "@/lib/store";
import type { Payment } from "@/lib/ledger";
import { computeReview } from "@/lib/review";
import { useCalm, useCountUp } from "@/lib/motion";
import { drawReviewCard, shareOrDownload } from "@/lib/reviewImage";
import Building from "./Building";
import { IconPause, IconPlay, IconShare, IconX } from "./Icons";

const SLIDE_MS = 5500;

type Slide = "intro" | "total" | "floors" | "ontime" | "owing" | "close";

function Total({ value, rate, calm }: { value: number; rate: number; calm: boolean }) {
  const shown = useCountUp(value, calm, 1100);
  const [w, setW] = useState(calm ? rate : 0);
  useEffect(() => { const t = setTimeout(() => setW(rate), 60); return () => clearTimeout(t); }, [rate]);
  return (
    <>
      <div className="review-big" aria-label={`KSh ${value.toLocaleString()}`}><small>KSh</small>{shown.toLocaleString()}</div>
      <div className="review-meter" aria-hidden><i style={{ width: `${Math.min(w, 100)}%` }} /></div>
    </>
  );
}

/**
 * A full-screen recap of one month, a few slides long. It advances by itself
 * (tap the right side to skip, the left to go back, or press Pause) and ends
 * with a picture that can be sent on WhatsApp.
 */
export default function MonthReview({
  year, month, rows, payments, dueDay, previousRate, onClose,
}: {
  year: number;
  month: number;
  rows: EffEntry[];
  payments: Payment[];
  dueDay: number;
  previousRate: number | null;
  onClose: () => void;
}) {
  const calm = useCalm();
  const review = useMemo(() => computeReview(rows, payments, year, month, dueDay, previousRate), [rows, payments, year, month, dueDay, previousRate]);
  const slides: Slide[] = useMemo(() => {
    const s: Slide[] = ["intro", "total", "floors"];
    if (review.onTime) s.push("ontime");
    s.push("owing", "close");
    return s;
  }, [review.onTime]);

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const last = slides.length - 1;
  const auto = !calm && !paused && i < last;

  const go = useCallback((n: number) => setI((cur) => Math.max(0, Math.min(last, typeof n === "number" ? n : cur))), [last]);

  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setI((c) => Math.min(last, c + 1)), SLIDE_MS);
    return () => clearTimeout(t);
  }, [auto, i, last]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((c) => Math.min(last, c + 1));
      if (e.key === "ArrowLeft") setI((c) => Math.max(0, c - 1));
      if (e.key === " " && (e.target as HTMLElement).tagName !== "BUTTON") { e.preventDefault(); setPaused((p) => !p); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, [onClose, last]);

  async function share() {
    setNote("Preparing the picture…");
    try { await Promise.all([document.fonts.load('700 64px "Bricolage Grotesque Variable"'), document.fonts.load('500 30px "Figtree Variable"')]); } catch { /* use fallback fonts */ }
    const canvas = document.createElement("canvas");
    drawReviewCard(canvas, rows, review, year, month);
    const res = await shareOrDownload(canvas, `Menetekel-${MONTHS[month]}-${year}.png`, `Menetekel ${MONTHS[month]} ${year}`);
    setNote(res === "downloaded" ? "Saved the picture to your device." : res === "shared" ? "Shared." : "Could not prepare the picture.");
  }

  const slide = slides[i];
  const noop = () => {};
  // A month that is still under way should not be compared with a finished one.
  const nowD = new Date();
  const inProgress = year === nowD.getFullYear() && month === nowD.getMonth();
  const f = review.floors;

  return (
    <div className={`review ${paused ? "paused" : ""}`} data-slide={i} role="dialog" aria-modal="true" aria-label={`${MONTHS[month]} ${year} in review`}>
      <div className="review-bg" aria-hidden />
      <div className="review-top">
        <div className="review-bars" aria-hidden>
          {slides.map((_, k) => <i key={k} className={k < i ? "done" : k === i && auto ? "now" : k === i ? "done" : ""} style={{ ["--dur" as string]: `${SLIDE_MS}ms` }}><b /></i>)}
        </div>
        <div className="review-head">
          <span>{MONTHS[month]} {year} in review · {i + 1} of {slides.length}</span>
          <span className="row gap-8">
            {!calm && i < last && (
              <button className="btn btn-sm btn-icon" onClick={() => setPaused((p) => !p)} aria-label={paused ? "Resume" : "Pause"}>
                {paused ? <IconPlay width={16} height={16} /> : <IconPause width={16} height={16} />}
              </button>
            )}
            <button ref={closeRef} className="btn btn-sm btn-icon" onClick={onClose} aria-label="Close the review"><IconX width={16} height={16} /></button>
          </span>
        </div>
      </div>

      <button className="review-nav prev" aria-label="Previous slide" onClick={() => setI((c) => Math.max(0, c - 1))} tabIndex={-1} />
      <button className="review-nav next" aria-label="Next slide" onClick={() => setI((c) => Math.min(last, c + 1))} tabIndex={-1} />

      <div className="review-slide" key={slide} aria-live="polite">
        {slide === "intro" && (
          <>
            <div className="review-kicker">Menetekel Apartments</div>
            <div className="review-big" style={{ fontSize: "clamp(46px, 13vw, 92px)" }}>{MONTHS[month]}<br />{year}</div>
            <p className="review-line">Here is how the month went, floor by floor.</p>
            <div style={{ maxWidth: 520 }}><Building rows={rows} billed selected={null} onSelect={noop} animKey={`review-${month}`} showLegend={false} /></div>
          </>
        )}
        {slide === "total" && (
          <>
            <div className="review-kicker">{inProgress ? "Collected so far" : "Collected"}</div>
            <Total value={review.collected} rate={review.rate} calm={calm} />
            <p className="review-line">
              of KSh {review.due.toLocaleString()} due, <b>{review.rate}%</b>.
              {previousRate !== null && inProgress && <> Last month finished at {previousRate}%.</>}
              {previousRate !== null && !inProgress && review.rateChange !== null && review.rateChange !== 0 && (
                <> {review.rateChange > 0 ? "Up" : "Down"} {Math.abs(review.rateChange)} points on last month.</>
              )}
              {previousRate !== null && !inProgress && review.rateChange === 0 && <> The same as last month.</>}
            </p>
            <p className="review-line" style={{ opacity: 0.8, fontSize: 17 }}>{review.clear} of {review.occupied} occupied units are fully paid{review.vacant > 0 ? `, and ${review.vacant} vacant.` : "."}</p>
          </>
        )}
        {slide === "floors" && (
          <>
            <div className="review-kicker">Best floor</div>
            {review.bestFloor ? (
              <>
                <div className="review-big">Floor {review.bestFloor.floor}</div>
                <p className="review-line">Collected {review.bestFloor.rate}% of what it was due.</p>
                <div className="review-list">
                  {f.map((x) => <div key={x.floor}><span>Floor {x.floor}</span><b>{x.rate}%</b></div>)}
                </div>
              </>
            ) : <p className="review-line">No occupied floors to compare yet.</p>}
          </>
        )}
        {slide === "ontime" && review.onTime && (
          <>
            <div className="review-kicker">On time</div>
            <div className="review-big">{review.onTime.count}</div>
            <p className="review-line">{review.onTime.count === 1 ? "tenant paid" : "tenants paid"} in full by the {dueDay}th.</p>
            {review.onTime.names.length > 0 && (
              <div className="review-list">
                {review.onTime.names.slice(0, 4).map((n) => <div key={n}><span>{n}</span><b>✓</b></div>)}
                {review.onTime.names.length > 4 && <div><span>and {review.onTime.names.length - 4} more</span><b /></div>}
              </div>
            )}
          </>
        )}
        {slide === "owing" && (
          <>
            <div className="review-kicker">Still to collect</div>
            {review.outstanding > 0 ? (
              <>
                <div className="review-big"><small>KSh</small>{review.outstanding.toLocaleString()}</div>
                <div className="review-list">
                  {review.topOwing.map((u) => (
                    <div key={`${u.floor}${u.unit}`}><span>{u.tenant || `Floor ${u.floor}, ${u.unit}`}</span><b>{u.balance.toLocaleString()}</b></div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="review-big">All clear</div>
                <p className="review-line">Every occupied unit has paid for {MONTHS[month]}. Nothing to chase.</p>
              </>
            )}
          </>
        )}
        {slide === "close" && (
          <>
            <div className="review-kicker">That is {MONTHS[month]}</div>
            <div style={{ maxWidth: 520 }}><Building rows={rows} billed selected={null} onSelect={noop} animKey={`close-${month}`} showLegend={false} /></div>
            <p className="review-line">{note ?? "Send this picture to the owner, or keep it for your records."}</p>
          </>
        )}
      </div>

      <div className="review-foot">
        {slide === "close" ? (
          <>
            <button className="btn" onClick={share}><IconShare /> Share the picture</button>
            <button className="btn ghost" onClick={() => go(0)}>Watch again</button>
          </>
        ) : (
          <button className="btn ghost" onClick={() => setI((c) => Math.min(last, c + 1))}>Next</button>
        )}
      </div>
    </div>
  );
}
