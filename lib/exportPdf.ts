"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { MONTHS, PROPERTY, FLOORS, unitsForFloor, fmt } from "./config";
import {
  loadMonth, monthTotalsFull, floorTotalsFull, arrearsMapFor,
  monthDue, getActiveYear, Entry,
} from "./store";

const NAVY: [number, number, number] = [15, 44, 82];
const GOLD: [number, number, number] = [200, 169, 81];
const GREEN: [number, number, number] = [46, 125, 79];
const RED: [number, number, number] = [192, 57, 43];
const GREY: [number, number, number] = [110, 118, 130];

type Doc = jsPDF & { lastAutoTable: { finalY: number } };

function header(doc: jsPDF, title: string, subtitle: string) {
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

function kpiBoxes(
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

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(12, h - 14, w - 12, h - 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(`${PROPERTY.name} · ${PROPERTY.location} · Manager: ${PROPERTY.manager}`, 12, h - 9);
    doc.text(`Page ${p} of ${pages} · Generated ${new Date().toLocaleDateString("en-GB")}`, w - 12, h - 9, { align: "right" });
  }
}

function signatureBlock(doc: jsPDF, y: number) {
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

const tableTheme = {
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
  const arrMap = arrearsMapFor(mi, year);
  const gt = monthTotalsFull(mi, year);
  const doc = new jsPDF() as Doc;

  header(doc, `${PROPERTY.name} — Collection Report`,
    `${MONTHS[mi]} ${year} · 5 floors · 34 units · ${PROPERTY.paymentMode} · Due ${PROPERTY.dueDay}th`);

  const y = kpiBoxes(doc, 38, [
    { label: "Charges", value: fmt(gt.monthCharges) },
    { label: "Arrears b/f", value: fmt(gt.arrears), color: gt.arrears > 0 ? RED : GREEN },
    { label: "Total due", value: fmt(gt.totalDue) },
    { label: "Collected", value: fmt(gt.paid), color: GREEN },
    { label: "Rate", value: `${gt.rate}%`, color: gt.rate >= 80 ? GREEN : RED },
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Floor", "Occ.", "Charges", "Arrears", "Total due", "Collected", "Balance", "Rate"]],
    body: FLOORS.map((f) => {
      const t = floorTotalsFull(mi, f, year);
      return [
        `Floor ${f}${f === 0 ? " (6+7 merged)" : ""}`,
        { content: `${t.occupied}/${t.occupied + t.vacant}`, styles: { halign: "center" as const } },
        R(t.monthCharges), R(t.arrears), R(t.totalDue),
        { content: t.paid.toLocaleString(), styles: { halign: "right" as const, textColor: GREEN } },
        balCell(t.balance, t.paid),
        { content: `${t.rate}%`, styles: { halign: "center" as const, fontStyle: "bold" as const, textColor: t.rate >= 80 ? GREEN : RED } },
      ];
    }),
    foot: [["GRAND TOTAL", `${gt.occupied}/34`, R(gt.monthCharges), R(gt.arrears), R(gt.totalDue), R(gt.paid), R(gt.balance), `${gt.rate}%`]],
    footStyles: { fillColor: GOLD, textColor: [10, 15, 26], fontStyle: "bold", fontSize: 8 },
    ...tableTheme,
  });

  const defaulters = data.filter((r) => monthDue(r) + (arrMap[`${r.floor}|${r.unit}`] ?? 0) - r.paid > 0);
  if (defaulters.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...RED);
    doc.text(`Outstanding units (${defaulters.length})`, 12, doc.lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 13,
      head: [["Floor · Unit", "Tenant", "Phone", "Total due", "Paid", "Balance"]],
      body: defaulters.map((r) => {
        const due = monthDue(r) + (arrMap[`${r.floor}|${r.unit}`] ?? 0);
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
  footer(doc);
  doc.save(`Menetekel_Report_${MONTHS[mi]}_${year}.pdf`);
}

/* ---------------- floor report ---------------- */

export function downloadFloorPdf(mi: number, floor: number) {
  const year = getActiveYear();
  const data = loadMonth(mi, year).filter((r) => r.floor === floor);
  const arrMap = arrearsMapFor(mi, year);
  const t = floorTotalsFull(mi, floor, year);
  const doc = new jsPDF({ orientation: "landscape" }) as Doc;

  header(doc, `${PROPERTY.name} — Floor ${floor} Report`,
    `${MONTHS[mi]} ${year} · ${data.length} units${floor === 0 ? " · Unit 6+7 merged" : ""} · ${PROPERTY.paymentMode}`);

  const y = kpiBoxes(doc, 38, [
    { label: "Charges", value: fmt(t.monthCharges) },
    { label: "Arrears b/f", value: fmt(t.arrears), color: t.arrears > 0 ? RED : GREEN },
    { label: "Total due", value: fmt(t.totalDue) },
    { label: "Collected", value: fmt(t.paid), color: GREEN },
    { label: "Clear", value: `${t.fullyPaid}/${data.length}`, color: NAVY },
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Unit", "Tenant", "Phone", "Rent", "Water", "Arrears", "Total due", "Paid", "Balance", "Receipt no."]],
    body: data.map((r) => {
      const a = arrMap[`${r.floor}|${r.unit}`] ?? 0;
      const due = monthDue(r) + a;
      return [
        { content: r.unit + (r.merged ? " ★" : "") + (r.vacant ? " (vacant)" : ""), styles: r.merged ? { fontStyle: "bold" as const, textColor: [154, 120, 38] as [number, number, number] } : {} },
        r.tenant || "—", r.phone || "—",
        R(r.vacant ? 0 : r.rent), R(r.water), R(a), R(due), R(r.paid),
        balCell(due - r.paid, r.paid),
        r.receipt || "—",
      ];
    }),
    foot: [["TOTAL", "", "", R(t.monthCharges), "", R(t.arrears), R(t.totalDue), R(t.paid), R(t.balance), `${t.rate}%`]],
    footStyles: { fillColor: GOLD, textColor: [10, 15, 26], fontStyle: "bold", fontSize: 8 },
    ...tableTheme,
  });

  if (floor === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text("★ Unit 6+7 — merged unit (former Units 6 and 7 combined at KShs 7,500).", 12, doc.lastAutoTable.finalY + 7);
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

export function downloadReceiptPdf(mi: number, e: Entry, arrears: number) {
  const year = getActiveYear();
  const due = monthDue(e) + arrears;
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
    head: [["Description", "Amount (KShs)"]],
    body: [
      ["Monthly rent", R(e.vacant ? 0 : e.rent)],
      ["Water & other charges", R(e.water)],
      ["Balance brought forward", R(arrears)],
      [{ content: "Total due", styles: { fontStyle: "bold" as const } }, { ...R(due), styles: { fontStyle: "bold" as const, halign: "right" as const } }],
      [{ content: "Amount paid", styles: { fontStyle: "bold" as const, textColor: GREEN } }, { ...R(e.paid), styles: { fontStyle: "bold" as const, halign: "right" as const, textColor: GREEN } }],
    ],
    foot: [[
      bal > 0 ? "BALANCE REMAINING" : bal < 0 ? "CREDIT CARRIED FORWARD" : "FULLY SETTLED",
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
