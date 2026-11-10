"use client";

import { FLOORS, MONTHS, unitsForFloor } from "./config";
import type { EffEntry } from "./store";
import type { MonthReview } from "./review";
import { unitState } from "./status";

const W = 1080, H = 1350;
const DISPLAY = '"Bricolage Grotesque Variable", "Segoe UI", sans-serif';
const BODY = '"Figtree Variable", "Segoe UI", sans-serif';
const COLORS = { paid: "#4cc79a", part: "#e9a62a", owe: "#f08585", vacant: "#6d6790", none: "#6d6790" };

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draw the month summary as a 1080x1350 picture (a good size for WhatsApp and status posts). */
export function drawReviewCard(
  canvas: HTMLCanvasElement,
  rows: EffEntry[],
  review: MonthReview,
  year: number,
  month: number
): void {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#5b3fa8");
  bg.addColorStop(0.55, "#2a2056");
  bg.addColorStop(1, "#14112a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `700 30px ${BODY}`;
  ctx.fillText("MENETEKEL APARTMENTS", 80, 110);
  ctx.fillStyle = "#fff";
  ctx.font = `700 64px ${DISPLAY}`;
  ctx.fillText(`${MONTHS[month]} ${year}`, 80, 190);

  ctx.font = `600 40px ${BODY}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText("KSh", 80, 330);
  ctx.fillStyle = "#fff";
  ctx.font = `700 150px ${DISPLAY}`;
  ctx.fillText(review.collected.toLocaleString(), 170, 345);
  ctx.font = `500 38px ${BODY}`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(`collected of KSh ${review.due.toLocaleString()} due  ·  ${review.rate}%`, 80, 410);

  // progress bar
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  round(ctx, 80, 440, W - 160, 16, 8); ctx.fill();
  ctx.fillStyle = "#fff";
  round(ctx, 80, 440, Math.max(16, ((W - 160) * Math.min(review.rate, 100)) / 100), 16, 8); ctx.fill();

  // the building
  const bx = 80, by = 490, bw = W - 160, rowH = 100, gap = 14, labelW = 70;
  ctx.fillStyle = "rgba(20,17,42,0.55)";
  round(ctx, bx, by, bw, rowH * 5 + 40, 28); ctx.fill();
  ctx.fillStyle = "#9b84e6";
  round(ctx, bx, by, bw, 14, 7); ctx.fill();
  const byKey = new Map(rows.map((e) => [`${e.floor}|${e.unit}`, e]));
  const cellW = (bw - labelW - 40 - gap * 6) / 7;
  [...FLOORS].reverse().forEach((f, ri) => {
    const y = by + 34 + ri * rowH;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `700 44px ${DISPLAY}`;
    ctx.fillText(String(f), bx + 26, y + 58);
    let col = 0;
    for (const u of unitsForFloor(f)) {
      const span = u.merged ? 2 : 1;
      const x = bx + labelW + 20 + col * (cellW + gap);
      const w = cellW * span + gap * (span - 1);
      const e = byKey.get(`${f}|${u.label}`);
      const s = e ? unitState(e, true) : null;
      const status = s?.status ?? "none";
      const h = rowH - 22;
      ctx.lineWidth = 4;
      ctx.strokeStyle = COLORS[status];
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      round(ctx, x, y, w, h, 14); ctx.fill();
      if (status === "paid" || status === "part") {
        const fh = (h * (s?.fill ?? 0)) / 100;
        ctx.save();
        round(ctx, x, y, w, h, 14); ctx.clip();
        ctx.fillStyle = COLORS[status];
        ctx.fillRect(x, y + h - fh, w, fh);
        ctx.restore();
      }
      if (status === "vacant") ctx.setLineDash([10, 8]);
      round(ctx, x, y, w, h, 14); ctx.stroke();
      ctx.setLineDash([]);
      col += span;
    }
  });

  // legend + facts
  let ly = by + rowH * 5 + 92;
  const legend: [string, string][] = [["Paid", COLORS.paid], ["Part-paid", COLORS.part], ["Owing", COLORS.owe], ["Vacant", COLORS.vacant]];
  let lx = 80;
  ctx.font = `500 30px ${BODY}`;
  for (const [label, color] of legend) {
    ctx.fillStyle = color;
    round(ctx, lx, ly - 24, 28, 28, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(label, lx + 40, ly);
    lx += 40 + ctx.measureText(label).width + 44;
  }
  ly += 72;
  ctx.fillStyle = "#fff";
  ctx.font = `700 40px ${DISPLAY}`;
  ctx.fillText(`${review.clear} of ${review.occupied} occupied units clear`, 80, ly);
  ly += 54;
  ctx.font = `500 34px ${BODY}`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillText(
    review.outstanding > 0 ? `KSh ${review.outstanding.toLocaleString()} still outstanding` : "Nothing outstanding this month",
    80, ly
  );
  if (review.bestFloor) {
    ly += 48;
    ctx.fillText(`Best floor: Floor ${review.bestFloor.floor} at ${review.bestFloor.rate}%`, 80, ly);
  }

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `500 26px ${BODY}`;
  ctx.fillText("Rent collected with RentTrack", 80, H - 50);
}

/** Share the picture if the phone can, otherwise download it. Returns what happened. */
export async function shareOrDownload(canvas: HTMLCanvasElement, filename: string, title: string): Promise<"shared" | "downloaded" | "failed"> {
  const blob: Blob | null = await new Promise((ok) => canvas.toBlob(ok, "image/png"));
  if (!blob) return "failed";
  const file = new File([blob], filename, { type: "image/png" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return "shared";
    }
  } catch (err) {
    // Closing the share sheet is not a failure; anything else falls back to a download.
    if (err instanceof DOMException && err.name === "AbortError") return "shared";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
