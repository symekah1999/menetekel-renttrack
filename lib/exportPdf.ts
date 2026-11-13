"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { MONTHS, PROPERTY, FLOORS, unitsForFloor, fmt } from "./config";
import { unitState } from "./status";
import {
  loadMonthEffective as loadMonth, monthTotalsFull, floorTotalsFull,
  monthDue, getActiveYear, Entry,
} from "./store";

export const NAVY: [number, number, number] = [62, 42, 126];
export const GOLD: [number, number, number] = [224, 165, 38];
export const GREEN: [number, number, number] = [23, 128, 90];
export const RED: [number, number, number] = [191, 59, 59];
export const GREY: [number, number, number] = [110, 118, 130];

type Doc = jsPDF & { lastAutoTable: { finalY: number } };

/** A designed first page: the month's collection, and the building as it stood. */
function drawCover(
  doc: jsPDF, mi: number, year: number, data: ReturnType<typeof loadMonth>,
  t: { paid: number; totalDue: number; rate: number; occupied: number }
) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const soft: [number, number, number] = [205, 196, 240];
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, h, "F");
  doc.setFillColor(155, 132, 230);
  doc.rect(0, 0, w, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...soft);
  doc.text("MENETEKEL APARTMENTS  ·  NAIROBI", 20, 30);
  doc.setFontSize(34);
  doc.setTextColor(255, 255, 255);
  doc.text(`${MONTHS[mi]} ${year}`, 20, 48);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...soft);
  doc.text("Collection report", 20, 57);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(54);
  doc.setTextColor(255, 255, 255);
  doc.text(t.paid.toLocaleString(), 20, 92);
  const numW = doc.getTextWidth(t.paid.toLocaleString());
  doc.setFontSize(14);
  doc.setTextColor(...soft);
  doc.text("KSh collected", 20 + numW + 4, 92);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`of KSh ${t.totalDue.toLocaleString()} due  ·  ${t.rate}% collected  ·  ${t.occupied} occupied units`, 20, 102);
  doc.setFillColor(90, 70, 150);
  doc.roundedRect(20, 108, w - 40, 3, 1.5, 1.5, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(20, 108, Math.max(3, ((w - 40) * Math.min(t.rate, 100)) / 100), 3, 1.5, 1.5, "F");

  // the building
  const px = 20, py = 124, pw = w - 40, rowH = 20, labelW = 12, gap = 2.4;
  doc.setFillColor(26, 20, 60);
  doc.roundedRect(px, py, pw, rowH * 5 + 16, 3, 3, "F");
  doc.setFillColor(155, 132, 230);
  doc.rect(px, py, pw, 2.2, "F");
  const cellW = (pw - labelW - 12 - gap * 6) / 7;
  const byKey = new Map(data.map((e) => [`${e.floor}|${e.unit}`, e]));
  const tone = { paid: [76, 199, 154], part: [233, 166, 42], owe: [240, 133, 133], vacant: [109, 103, 144], none: [109, 103, 144] } as const;
  [...FLOORS].reverse().forEach((f, ri) => {
    const y = py + 9 + ri * rowH;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(150, 140, 190);
    doc.text(String(f), px + 6, y + 10.5, { align: "center" });
    let col = 0;
    for (const u of unitsForFloor(f)) {
      const span = u.merged ? 2 : 1;
      const x = px + labelW + 6 + col * (cellW + gap);
      const cw = cellW * span + gap * (span - 1);
      const e = byKey.get(`${f}|${u.label}`);
      const st = e ? unitState(e, true) : null;
      const status = st?.status ?? "none";
      const [r, g, b] = tone[status];
      const ch = rowH - 4;
      if (status === "paid" || status === "part") {
        const fh = (ch * (st?.fill ?? 0)) / 100;
        doc.setFillColor(r, g, b);
        doc.roundedRect(x, y + ch - fh, cw, fh, 1.2, 1.2, "F");
      }
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.5);
      if (status === "vacant") doc.setLineDashPattern([1.2, 1], 0);
      doc.roundedRect(x, y, cw, ch, 1.6, 1.6, "S");
      doc.setLineDashPattern([], 0);
      col += span;
    }
  });

  // legend
  const legend: [string, readonly [number, number, number]][] = [["Paid", tone.paid], ["Part-paid", tone.part], ["Owing", tone.owe], ["Vacant", tone.vacant]];
  let lx = 20;
  const ly = py + rowH * 5 + 28;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const [label, [r, g, b]] of legend) {
    doc.setFillColor(r, g, b);
    doc.roundedRect(lx, ly - 3.2, 4, 4, 1, 1, "F");
    doc.setTextColor(...soft);
    doc.text(label, lx + 6, ly);
    lx += 6 + doc.getTextWidth(label) + 10;
  }
  doc.setFontSize(9);
  doc.setTextColor(150, 140, 190);
  doc.text("Floor 4 is at the top. Part-paid windows fill as rent arrives.", 20, h - 22);
  doc.text("Rent collected with RentTrack", 20, h - 16);
}

export function header(doc: jsPDF, title: string, subtitle: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 30, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 30, w, 1.6, "F");
  doc.roundedRect(12, 8, 14, 14, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("M", 19, 17.5, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(title, 31, 14.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GOLD);
  doc.text(subtitle, 31, 21.5);
}

export function kpiBoxes(
  doc: jsPDF, y: number,
  items: { label: string; value: string; color?: [number, number, number] }[]
) {
  const w = doc.internal.pageSize.getWidth();
  const gap = 5;
  const bw = (w - 24 - gap * (items.length - 1)) / items.length;
  items.forEach((it, i) => {
    const x = 12 + i * (bw + gap);
    doc.setFillColor(246, 248, 251);
    doc.setDrawColor(216, 222, 233);
    doc.roundedRect(x, y, bw, 18, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...(it.color ?? NAVY));
    doc.text(it.value, x + 4, y + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...GREY);
    doc.text(it.label.toUpperCase(), x + 4, y + 14.5);
  });
  return y + 24;
}

export function footer(doc: jsPDF, hasCover = false) {
  const pages = doc.getNumberOfPages();
  const first = hasCover ? 2 : 1; // a cover page carries no footer or number
  const total = hasCover ? pages - 1 : pages;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let p = first; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(12, h - 14, w - 12, h - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(`${PROPERTY.name} · ${PROPERTY.location} · Manager: ${PROPERTY.manager}`, 12, h - 9);
    doc.text(`Page ${p - first + 1} of ${total} · Generated ${new Date().toLocaleDateString("en-GB")}`, w - 12, h - 9, { align: "right" });
  }
}

export function signatureBlock(doc: jsPDF, y: number) {
  const h = doc.internal.pageSize.getHeight();
  if (y > h - 45) return;
  doc.setDrawColor(120, 128, 140);
  doc.setLineWidth(0.3);
  doc.line(12, y + 14, 80, y + 14);
  doc.line(115, y + 14, 183, y + 14);
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text(`Prepared by: ${PROPERTY.manager}`, 12, y + 19);
  doc.text("Received by / Tenant signature", 115, y + 19);
}

export const tableTheme = {
  headStyles: {
    fillColor: NAVY, textColor: [255, 255, 255] as [number, number, number],
    fontSize: 7.5, fontStyle: "bold" as const, halign: "center" as const,
  },
  bodyStyles: { fontSize: 8, textColor: [40, 45, 55] as [number, number, number] },
  alternateRowStyles: { fillColor: [246, 248, 251] as [number, number, number] },
  styles: { lineColor: [216, 222, 233] as [number, number, number], lineWidth: 0.2, cellPadding: 2 },
};

const R = (v: number | string) => ({ content: typeof v === "number" ? v.toLocaleString() : v, styles: { halign: "right" as const } });

function balCell(bal: number, paid: number) {
  return {
    content: paid > 0 && bal <= 0 ? (bal < 0 ? `CR ${(-bal).toLocaleString()}` : "PAID") : bal.toLocaleString(),
    styles: {
      fontStyle: "bold" as const,
      textColor: paid > 0 && bal <= 0 ? GREEN : bal > 0 ? RED : GREY,
      halign: "right" as const,
    },
  };
}

/* ---------------- month report ---------------- */

export function downloadMonthPdf(mi: number) {
  const year = getActiveYear();
  const data = loadMonth(mi, year);
  const gt = monthTotalsFull(mi, year);
  const doc = new jsPDF() as Doc;

  drawCover(doc, mi, year, data, gt);
  doc.addPage();

  header(doc, `${PROPERTY.name} — Collection Report`,
    `${MONTHS[mi]} ${year} · 5 floors · 34 units · ${PROPERTY.paymentMode} · Due ${PROPERTY.dueDay}th`);

  const y = kpiBoxes(doc, 38, [
    { label: "Due this month", value: fmt(gt.totalDue) },
    { label: "Collected", value: fmt(gt.paid), color: GREEN },
    { label: "Outstanding", value: fmt(Math.max(gt.balance, 0)), color: gt.balance > 0 ? RED : GREEN },
    { label: "Rate", value: `${gt.rate}%`, color: gt.rate >= 80 ? GREEN : RED },
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Floor", "Occ.", "Due", "Collected", "Balance", "Rate"]],
    body: FLOORS.map((f) => {
      const t = floorTotalsFull(mi, f, year);
      return [
        `Floor ${f}${f === 0 ? " (6+7 merged)" : ""}`,
        { content: `${t.occupied}/${t.occupied + t.vacant}`, styles: { halign: "center" as const } },
        R(t.totalDue),
        { content: t.paid.toLocaleString(), styles: { halign: "right" as const, textColor: GREEN } },
        balCell(t.balance, t.paid),
        { content: `${t.rate}%`, styles: { halign: "center" as const, fontStyle: "bold" as const, textColor: t.rate >= 80 ? GREEN : RED } },
      ];
    }),
    foot: [["GRAND TOTAL", `${gt.occupied}/34`, R(gt.totalDue), R(gt.paid), R(gt.balance), `${gt.rate}%`]],
    footStyles: { fillColor: GOLD, textColor: [10, 15, 26], fontStyle: "bold", fontSize: 8 },
    ...tableTheme,
  });

  const defaulters = data.filter((r) => monthDue(r) - r.paid > 0);
  if (defaulters.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...RED);
    doc.text(`Outstanding units (${defaulters.length})`, 12, doc.lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 13,
      head: [["Floor · Unit", "Tenant", "Phone", "Total due", "Paid", "Balance"]],
      body: defaulters.map((r) => {
        const due = monthDue(r);
        return [
          `Floor ${r.floor} · ${r.unit}`, r.tenant || "—", r.phone || "—",
          R(due), R(r.paid), balCell(due - r.paid, r.paid),
        ];
      }),
      ...tableTheme,
      headStyles: { ...tableTheme.headStyles, fillColor: RED },
    });
  }

  signatureBlock(doc, doc.lastAutoTable.finalY + 6);
  footer(doc, true);
  doc.save(`Menetekel_Report_${MONTHS[mi]}_${year}.pdf`);
}

/* ---------------- floor report ---------------- */

export function downloadFloorPdf(mi: number, floor: number) {
  const year = getActiveYear();
  const data = loadMonth(mi, year).filter((r) => r.floor === floor);
  const t = floorTotalsFull(mi, floor, year);
  const doc = new jsPDF({ orientation: "landscape" }) as Doc;

  header(doc, `${PROPERTY.name} — Floor ${floor} Report`,
    `${MONTHS[mi]} ${year} · ${data.length} units${floor === 0 ? " · Unit 6+7 merged" : ""} · ${PROPERTY.paymentMode}`);

  const y = kpiBoxes(doc, 38, [
    { label: "Due this month", value: fmt(t.totalDue) },
    { label: "Collected", value: fmt(t.paid), color: GREEN },
    { label: "Outstanding", value: fmt(Math.max(t.balance, 0)), color: t.balance > 0 ? RED : GREEN },
    { label: "Clear", value: `${t.fullyPaid}/${t.occupied}`, color: NAVY },
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Unit", "Tenant", "Phone", "Rent", "Water", "Total due", "Paid", "Balance", "Receipt no."]],
    body: data.map((r) => {
      const due = monthDue(r);
      return [
        { content: r.unit + (r.merged ? " ★" : "") + (r.vacant ? " (vacant)" : ""), styles: r.merged ? { fontStyle: "bold" as const, textColor: [154, 120, 38] as [number, number, number] } : {} },
        r.tenant || "—", r.phone || "—",
        R(r.vacant ? 0 : r.rent), R(r.water), R(due), R(r.paid),
        balCell(due - r.paid, r.paid),
        r.receipt || "—",
      ];
    }),
    foot: [["TOTAL", "", "", "", "", R(t.totalDue), R(t.paid), R(t.balance), `${t.rate}%`]],
    footStyles: { fillColor: GOLD, textColor: [10, 15, 26], fontStyle: "bold", fontSize: 8 },
    ...tableTheme,
  });

  if (floor === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text("★ Unit 6+7 — merged unit (former Units 6 and 7 combined at KSh 7,500).", 12, doc.lastAutoTable.finalY + 7);
  }

  signatureBlock(doc, doc.lastAutoTable.finalY + 10);
  footer(doc);
  doc.save(`Menetekel_Floor${floor}_${MONTHS[mi]}_${year}.pdf`);
}

/* ---------------- unit statement ---------------- */

export function downloadUnitPdf(floor: number, unitLabel: string) {
  const year = getActiveYear();
  const unitDef = unitsForFloor(floor).find((u) => u.label === unitLabel);
  let tenant = "";
  const rows = MONTHS.map((m, mi) => {
    const e = loadMonth(mi, year).find((r) => r.floor === floor && r.unit === unitLabel);
    if (e?.tenant) tenant = e.tenant;
    return { m, e };
  });

  const doc = new jsPDF() as Doc;
  header(doc, `${PROPERTY.name} — Unit Statement`,
    `Floor ${floor} · ${unitLabel}${unitDef?.merged ? " (merged unit)" : ""} · ${year} · ${PROPERTY.paymentMode}`);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(`Tenant: ${tenant || "—"}`, 12, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(`Base rent: ${fmt(unitDef?.rent ?? 0)} / month · Due: ${PROPERTY.dueDay}th of every month`, 12, 46);

  let cumulative = 0, tDue = 0, tPaid = 0;
  autoTable(doc, {
    startY: 52,
    head: [["Month", "Rent", "Water", "Month due", "Paid", "Month balance", "Running balance", "Receipt"]],
    body: rows.map(({ m, e }) => {
      const rent = e ? (e.vacant ? 0 : e.rent) : 0;
      const water = e?.water ?? 0;
      const due = rent + water;
      const paid = e?.paid ?? 0;
      cumulative += due - paid;
      tDue += due; tPaid += paid;
      return [
        m + (e?.vacant ? " (vacant)" : ""),
        R(rent), R(water), R(due), R(paid),
        balCell(due - paid, paid),
        balCell(cumulative, paid),
        e?.receipt ?? "—",
      ];
    }),
    foot: [["YEAR TOTAL", "", "", R(tDue), R(tPaid), R(tDue - tPaid), R(cumulative), ""]],
    footStyles: { fillColor: GOLD, textColor: [10, 15, 26], fontStyle: "bold", fontSize: 8 },
    ...tableTheme,
  });

  signatureBlock(doc, doc.lastAutoTable.finalY + 8);
  footer(doc);
  doc.save(`Menetekel_F${floor}_${unitLabel.replace(/\W+/g, "")}_Statement_${year}.pdf`);
}

/* ---------------- A5 tenant receipt ---------------- */

export function downloadReceiptPdf(mi: number, e: Entry) {
  const year = getActiveYear();
  const due = monthDue(e);
  const bal = due - e.paid;
  const doc = new jsPDF({ format: "a5", orientation: "landscape" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 24, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 24, w, 1.4, "F");
  doc.roundedRect(10, 6, 12, 12, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("M", 16, 14.2, { align: "center" });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.text("RENT RECEIPT", 27, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GOLD);
  doc.text(`${PROPERTY.name} · ${PROPERTY.location}`, 27, 18);

  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(`Receipt no: ${e.receipt || "________"}`, w - 10, 10, { align: "right" });
  doc.text(`Date: ${e.date}`, w - 10, 16, { align: "right" });

  doc.setTextColor(30, 35, 45);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${MONTHS[mi]} ${year}  ·  Floor ${e.floor}, ${e.unit}${e.merged ? " (merged)" : ""}`, 10, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Tenant: ${e.tenant || "—"}${e.phone ? "   ·   " + e.phone : ""}`, 10, 41);
  doc.text(`Payment mode: ${PROPERTY.paymentMode}`, 10, 47);

  autoTable(doc, {
    startY: 53,
    margin: { left: 10, right: 10 },
    head: [["Description", "Amount (KSh)"]],
    body: [
      ["Monthly rent", R(e.vacant ? 0 : e.rent)],
      ["Water & other charges", R(e.water)],
      [{ content: "Total due", styles: { fontStyle: "bold" as const } }, { ...R(due), styles: { fontStyle: "bold" as const, halign: "right" as const } }],
      [{ content: "Amount paid", styles: { fontStyle: "bold" as const, textColor: GREEN } }, { ...R(e.paid), styles: { fontStyle: "bold" as const, halign: "right" as const, textColor: GREEN } }],
    ],
    foot: [[
      bal > 0 ? "BALANCE REMAINING" : bal < 0 ? "OVERPAID THIS MONTH" : "FULLY SETTLED",
      { content: Math.abs(bal).toLocaleString(), styles: { halign: "right" as const } },
    ]],
    footStyles: {
      fillColor: bal > 0 ? RED : GREEN,
      textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9,
    },
    headStyles: { ...tableTheme.headStyles, fontSize: 8 },
    bodyStyles: { fontSize: 9 },
    styles: tableTheme.styles,
  });

  const yEnd = (doc as Doc).lastAutoTable.finalY;
  doc.setDrawColor(120, 128, 140);
  doc.setLineWidth(0.3);
  doc.line(10, yEnd + 14, 75, yEnd + 14);
  doc.line(w - 75, yEnd + 14, w - 10, yEnd + 14);
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text(`Received by: ${PROPERTY.manager}`, 10, yEnd + 19);
  doc.text("Tenant signature", w - 75, yEnd + 19);

  doc.save(`Receipt_${MONTHS[mi]}_F${e.floor}_${e.unit.replace(/\W+/g, "")}.pdf`);
}
