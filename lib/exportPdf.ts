"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { MONTHS, PROPERTY, FLOORS, unitsForFloor, fmt } from "./config";
import { loadMonth, floorTotals, monthTotals, Entry } from "./store";

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
  doc.setFillColor(...GOLD);
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
  doc: jsPDF,
  y: number,
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
    doc.setFontSize(11);
    doc.setTextColor(...(it.color ?? NAVY));
    doc.text(it.value, x + 4, y + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
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
    fontSize: 8, fontStyle: "bold" as const, halign: "center" as const,
  },
  bodyStyles: { fontSize: 8.5, textColor: [40, 45, 55] as [number, number, number] },
  alternateRowStyles: { fillColor: [246, 248, 251] as [number, number, number] },
  styles: { lineColor: [216, 222, 233] as [number, number, number], lineWidth: 0.2, cellPadding: 2.2 },
};

function balCell(rent: number, paid: number) {
  const bal = rent - paid;
  return {
    content: paid > 0 && bal <= 0 ? "PAID" : bal.toLocaleString(),
    styles: {
      fontStyle: "bold" as const,
      textColor: paid > 0 && bal <= 0 ? GREEN : bal > 0 ? RED : GREY,
      halign: "right" as const,
    },
  };
}

export function downloadMonthPdf(mi: number) {
  const data = loadMonth(mi);
  const gt = monthTotals(data);
  const doc = new jsPDF() as Doc;

  header(doc, `${PROPERTY.name} — Collection Report`,
    `${MONTHS[mi]} ${PROPERTY.year} · 5 floors · 34 units · ${PROPERTY.paymentMode} · Due ${PROPERTY.dueDay}th`);

  let y = kpiBoxes(doc, 38, [
    { label: "Required", value: fmt(gt.required) },
    { label: "Collected", value: fmt(gt.paid), color: GREEN },
    { label: "Outstanding", value: fmt(gt.balance), color: gt.balance > 0 ? RED : GREEN },
    { label: "Rate", value: `${gt.rate}%`, color: gt.rate >= 80 ? GREEN : RED },
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Floor", "Units", "Required", "Collected", "Balance", "Rate", "Defaulters"]],
    body: FLOORS.map((f) => {
      const t = floorTotals(data, f);
      return [
        `Floor ${f}${f === 0 ? "  (Unit 6+7 merged)" : ""}`,
        { content: String(f === 0 ? 6 : 7), styles: { halign: "center" as const } },
        { content: t.required.toLocaleString(), styles: { halign: "right" as const } },
        { content: t.paid.toLocaleString(), styles: { halign: "right" as const, textColor: GREEN } },
        balCell(t.required, t.paid),
        { content: `${t.rate}%`, styles: { halign: "center" as const, fontStyle: "bold" as const, textColor: t.rate >= 80 ? GREEN : RED } },
        { content: t.defaulters ? String(t.defaulters) : "—", styles: { halign: "center" as const, textColor: t.defaulters ? RED : GREEN } },
      ];
    }),
    foot: [[
      "GRAND TOTAL", "34",
      { content: gt.required.toLocaleString(), styles: { halign: "right" as const } },
      { content: gt.paid.toLocaleString(), styles: { halign: "right" as const } },
      { content: gt.balance.toLocaleString(), styles: { halign: "right" as const } },
      { content: `${gt.rate}%`, styles: { halign: "center" as const } },
      { content: String(gt.defaulters || "—"), styles: { halign: "center" as const } },
    ]],
    footStyles: { fillColor: GOLD, textColor: [10, 15, 26], fontStyle: "bold", fontSize: 8.5 },
    ...tableTheme,
  });

  const defaulters = data.filter((r) => r.paid < r.rent);
  if (defaulters.length > 0 && defaulters.length < 34) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...RED);
    doc.text("Outstanding units", 12, doc.lastAutoTable.finalY + 10);
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 13,
      head: [["Floor · Unit", "Tenant", "Rent", "Paid", "Balance"]],
      body: defaulters.map((r) => [
        `Floor ${r.floor} · ${r.unit}`,
        r.tenant || "—",
        { content: r.rent.toLocaleString(), styles: { halign: "right" as const } },
        { content: r.paid.toLocaleString(), styles: { halign: "right" as const } },
        balCell(r.rent, r.paid),
      ]),
      ...tableTheme,
      headStyles: { ...tableTheme.headStyles, fillColor: RED },
    });
  }

  signatureBlock(doc, doc.lastAutoTable.finalY + 6);
  footer(doc);
  doc.save(`Menetekel_Report_${MONTHS[mi]}_${PROPERTY.year}.pdf`);
}

export function downloadFloorPdf(mi: number, floor: number) {
  const all = loadMonth(mi);
  const data = all.filter((r) => r.floor === floor);
  const t = floorTotals(all, floor);
  const doc = new jsPDF() as Doc;

  header(doc, `${PROPERTY.name} — Floor ${floor} Report`,
    `${MONTHS[mi]} ${PROPERTY.year} · ${data.length} units${floor === 0 ? " · Unit 6+7 merged" : ""} · ${PROPERTY.paymentMode}`);

  const y = kpiBoxes(doc, 38, [
    { label: "Required", value: fmt(t.required) },
    { label: "Collected", value: fmt(t.paid), color: GREEN },
    { label: "Balance", value: fmt(t.balance), color: t.balance > 0 ? RED : GREEN },
    { label: "Fully paid", value: `${t.fullyPaid}/${data.length}`, color: NAVY },
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Unit", "Tenant name", "Rent", "Paid", "Balance", "Date", "Receipt no."]],
    body: data.map((r) => [
      { content: r.unit + (r.merged ? " ★" : ""), styles: r.merged ? { fontStyle: "bold" as const, textColor: [154, 120, 38] as [number, number, number] } : {} },
      r.tenant || "—",
      { content: r.rent.toLocaleString(), styles: { halign: "right" as const } },
      { content: r.paid.toLocaleString(), styles: { halign: "right" as const } },
      balCell(r.rent, r.paid),
      r.date,
      r.receipt || "—",
    ]),
    foot: [[
      "TOTAL", "",
      { content: t.required.toLocaleString(), styles: { halign: "right" as const } },
      { content: t.paid.toLocaleString(), styles: { halign: "right" as const } },
      { content: t.balance.toLocaleString(), styles: { halign: "right" as const } },
      `${t.rate}%`, "",
    ]],
    footStyles: { fillColor: GOLD, textColor: [10, 15, 26], fontStyle: "bold", fontSize: 8.5 },
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
  doc.save(`Menetekel_Floor${floor}_${MONTHS[mi]}_${PROPERTY.year}.pdf`);
}

export function downloadUnitPdf(floor: number, unitLabel: string) {
  const unitDef = unitsForFloor(floor).find((u) => u.label === unitLabel);
  let tenant = "";
  const rows: { month: string; e: Entry | undefined }[] = MONTHS.map((m, mi) => {
    const e = loadMonth(mi).find((r) => r.floor === floor && r.unit === unitLabel);
    if (e?.tenant) tenant = e.tenant;
    return { month: m, e };
  });

  const doc = new jsPDF() as Doc;
  header(doc, `${PROPERTY.name} — Unit Statement`,
    `Floor ${floor} · ${unitLabel}${unitDef?.merged ? " (merged unit)" : ""} · ${PROPERTY.year} · ${PROPERTY.paymentMode}`);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(`Tenant: ${tenant || "—"}`, 12, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GREY);
  doc.text(`Monthly rent: ${fmt(unitDef?.rent ?? 0)}   ·   Due: ${PROPERTY.dueDay}th of every month`, 12, 46);

  let tReq = 0, tPaid = 0;
  autoTable(doc, {
    startY: 52,
    head: [["Month", "Rent", "Paid", "Balance", "Date", "Receipt no."]],
    body: rows.map(({ month, e }) => {
      const rent = e?.rent ?? unitDef?.rent ?? 0;
      const paid = e?.paid ?? 0;
      tReq += rent; tPaid += paid;
      return [
        month,
        { content: rent.toLocaleString(), styles: { halign: "right" as const } },
        { content: paid.toLocaleString(), styles: { halign: "right" as const } },
        balCell(rent, paid),
        e?.date ?? "—",
        e?.receipt ?? "—",
      ];
    }),
    foot: [[
      "YEAR TOTAL",
      { content: tReq.toLocaleString(), styles: { halign: "right" as const } },
      { content: tPaid.toLocaleString(), styles: { halign: "right" as const } },
      { content: (tReq - tPaid).toLocaleString(), styles: { halign: "right" as const } },
      "", "",
    ]],
    footStyles: { fillColor: GOLD, textColor: [10, 15, 26], fontStyle: "bold", fontSize: 8.5 },
    ...tableTheme,
  });

  signatureBlock(doc, doc.lastAutoTable.finalY + 8);
  footer(doc);
  doc.save(`Menetekel_F${floor}_${unitLabel.replace(/\W+/g, "")}_Statement_${PROPERTY.year}.pdf`);
}
