"use client";

import ExcelJS from "exceljs";
import { MONTHS, PROPERTY, FLOORS, unitsForFloor } from "./config";
import { loadMonth, floorTotals, monthTotals, Entry } from "./store";

const NAVY = "FF0F2C52";
const NAVY_LIGHT = "FF1B3A66";
const GOLD = "FFC8A951";
const GOLD_LIGHT = "FFF5EAD0";
const GREEN = "FF2E7D4F";
const RED = "FFC0392B";
const WHITE = "FFFFFFFF";
const GREY_ROW = "FFF4F6FA";

const KSH = '"KShs" #,##0';

function thinBorder(): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFD8DEE9" } };
  return { top: s, left: s, bottom: s, right: s };
}

function fill(argb: string): ExcelJS.FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function titleBand(ws: ExcelJS.Worksheet, title: string, subtitle: string, span: number) {
  const last = String.fromCharCode(64 + span);
  ws.mergeCells(`A1:${last}1`);
  ws.mergeCells(`A2:${last}2`);
  const t = ws.getCell("A1");
  t.value = title;
  t.font = { name: "Calibri", size: 15, bold: true, color: { argb: WHITE } };
  t.fill = fill(NAVY);
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 28;
  const s = ws.getCell("A2");
  s.value = subtitle;
  s.font = { name: "Calibri", size: 10, italic: true, color: { argb: GOLD } };
  s.fill = fill(NAVY);
  s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 18;
  ws.addRow([]);
}

function headerRow(ws: ExcelJS.Worksheet, cells: string[]) {
  const row = ws.addRow(cells);
  row.eachCell((c) => {
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
    c.fill = fill(NAVY_LIGHT);
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    c.border = thinBorder();
  });
  row.height = 20;
  return row;
}

function styleDataRow(row: ExcelJS.Row, opts: { zebra?: boolean; merged?: boolean } = {}) {
  row.eachCell((c) => {
    c.font = { name: "Calibri", size: 10 };
    c.border = thinBorder();
    if (opts.merged) c.fill = fill(GOLD_LIGHT);
    else if (opts.zebra) c.fill = fill(GREY_ROW);
  });
}

function moneyCols(row: ExcelJS.Row, cols: number[]) {
  cols.forEach((i) => {
    const c = row.getCell(i);
    c.numFmt = KSH;
    c.alignment = { horizontal: "right" };
  });
}

function balanceColor(row: ExcelJS.Row, col: number, bal: number, paid: number) {
  const c = row.getCell(col);
  if (paid > 0 && bal <= 0) c.font = { name: "Calibri", size: 10, bold: true, color: { argb: GREEN } };
  else if (bal > 0) c.font = { name: "Calibri", size: 10, bold: true, color: { argb: RED } };
}

function totalRow(ws: ExcelJS.Worksheet, cells: (string | number)[], argb: string, fontColor = WHITE) {
  const row = ws.addRow(cells);
  row.eachCell((c) => {
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: fontColor } };
    c.fill = fill(argb);
    c.border = thinBorder();
  });
  return row;
}

async function saveWb(wb: ExcelJS.Workbook, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function newWb(): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = PROPERTY.manager;
  wb.created = new Date();
  return wb;
}

const MONTH_COLS = [
  { width: 11 }, { width: 12 }, { width: 24 }, { width: 13 },
  { width: 13 }, { width: 14 }, { width: 12 }, { width: 14 },
];

function buildMonthSheet(wb: ExcelJS.Workbook, mi: number) {
  const data = loadMonth(mi);
  const ws = wb.addWorksheet(MONTHS[mi].slice(0, 3), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  ws.columns = MONTH_COLS;
  titleBand(
    ws,
    `${PROPERTY.name} — Rent Collection`,
    `${MONTHS[mi]} ${PROPERTY.year}  ·  ${PROPERTY.paymentMode}  ·  Due ${PROPERTY.dueDay}th  ·  Manager: ${PROPERTY.manager}`,
    8
  );
  headerRow(ws, ["Floor", "Unit", "Tenant name", "Rent", "Paid", "Balance", "Date", "Receipt no."]);

  for (const f of FLOORS) {
    const rowsF = data.filter((r) => r.floor === f);
    rowsF.forEach((r, i) => {
      const bal = r.rent - r.paid;
      const row = ws.addRow([
        `Floor ${f}`, r.unit, r.tenant, r.rent, r.paid, bal, r.date, r.receipt,
      ]);
      styleDataRow(row, { zebra: i % 2 === 1, merged: r.merged });
      moneyCols(row, [4, 5, 6]);
      balanceColor(row, 6, bal, r.paid);
    });
    const ft = floorTotals(data, f);
    const tr = totalRow(ws, [`Floor ${f} total`, "", "", ft.required, ft.paid, ft.balance, `${ft.rate}%`, ""], NAVY);
    moneyCols(tr, [4, 5, 6]);
  }

  const gt = monthTotals(data);
  ws.addRow([]);
  const gr = totalRow(ws, ["GRAND TOTAL", "", "", gt.required, gt.paid, gt.balance, `${gt.rate}%`, `${gt.fullyPaid}/34 paid`], GOLD, "FF0A0F1A");
  moneyCols(gr, [4, 5, 6]);
  gr.height = 22;
  ws.views = [{ state: "frozen", ySplit: 4 }];
}

export async function downloadYearExcel() {
  const wb = newWb();

  const sum = wb.addWorksheet("Summary");
  sum.columns = [
    { width: 14 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 10 }, { width: 12 },
  ];
  titleBand(sum, `${PROPERTY.name} — ${PROPERTY.year} Year Summary`, `${PROPERTY.location} · 5 floors · 34 units · Manager: ${PROPERTY.manager}`, 6);
  headerRow(sum, ["Month", "Required", "Collected", "Outstanding", "Rate", "Fully paid"]);
  let yReq = 0, yPaid = 0;
  MONTHS.forEach((m, mi) => {
    const t = monthTotals(loadMonth(mi));
    yReq += t.required; yPaid += t.paid;
    const row = sum.addRow([m, t.required, t.paid, t.balance, `${t.rate}%`, `${t.fullyPaid}/34`]);
    styleDataRow(row, { zebra: mi % 2 === 1 });
    moneyCols(row, [2, 3, 4]);
    balanceColor(row, 4, t.balance, t.paid);
  });
  const yr = totalRow(sum, ["YEAR TOTAL", yReq, yPaid, yReq - yPaid, yReq > 0 ? `${Math.round((yPaid / yReq) * 100)}%` : "0%", ""], GOLD, "FF0A0F1A");
  moneyCols(yr, [2, 3, 4]);

  MONTHS.forEach((_, mi) => buildMonthSheet(wb, mi));
  await saveWb(wb, `Menetekel_Rent_${PROPERTY.year}.xlsx`);
}

export async function downloadFloorExcel(mi: number, floor: number) {
  const wb = newWb();
  const data = loadMonth(mi).filter((r) => r.floor === floor);
  const ws = wb.addWorksheet(`Floor ${floor}`);
  ws.columns = [
    { width: 12 }, { width: 24 }, { width: 13 }, { width: 13 },
    { width: 14 }, { width: 12 }, { width: 14 },
  ];
  titleBand(
    ws,
    `${PROPERTY.name} — Floor ${floor} Report`,
    `${MONTHS[mi]} ${PROPERTY.year}  ·  ${data.length} units${floor === 0 ? "  ·  Unit 6+7 merged" : ""}  ·  ${PROPERTY.paymentMode}`,
    7
  );
  headerRow(ws, ["Unit", "Tenant name", "Rent", "Paid", "Balance", "Date", "Receipt no."]);
  data.forEach((r, i) => {
    const bal = r.rent - r.paid;
    const row = ws.addRow([r.unit, r.tenant, r.rent, r.paid, bal, r.date, r.receipt]);
    styleDataRow(row, { zebra: i % 2 === 1, merged: r.merged });
    moneyCols(row, [3, 4, 5]);
    balanceColor(row, 5, bal, r.paid);
  });
  const ft = floorTotals(loadMonth(mi), floor);
  const tr = totalRow(ws, [`Floor ${floor} total`, "", ft.required, ft.paid, ft.balance, `${ft.rate}%`, `${ft.fullyPaid}/${data.length} paid`], GOLD, "FF0A0F1A");
  moneyCols(tr, [3, 4, 5]);
  await saveWb(wb, `Menetekel_Floor${floor}_${MONTHS[mi]}_${PROPERTY.year}.xlsx`);
}

export async function downloadUnitExcel(floor: number, unitLabel: string) {
  const wb = newWb();
  const ws = wb.addWorksheet("Statement");
  ws.columns = [
    { width: 14 }, { width: 13 }, { width: 13 }, { width: 14 }, { width: 12 }, { width: 14 },
  ];
  const unitDef = unitsForFloor(floor).find((u) => u.label === unitLabel);
  let tenant = "";
  const entries: { month: string; e: Entry | undefined }[] = MONTHS.map((m, mi) => {
    const e = loadMonth(mi).find((r) => r.floor === floor && r.unit === unitLabel);
    if (e?.tenant) tenant = e.tenant;
    return { month: m, e };
  });
  titleBand(
    ws,
    `${PROPERTY.name} — Unit Statement`,
    `Floor ${floor} · ${unitLabel}${unitDef?.merged ? " (merged)" : ""} · Tenant: ${tenant || "—"} · Rent: KShs ${(unitDef?.rent ?? 0).toLocaleString()}/month · ${PROPERTY.year}`,
    6
  );
  headerRow(ws, ["Month", "Rent", "Paid", "Balance", "Date", "Receipt no."]);
  let tReq = 0, tPaid = 0;
  entries.forEach(({ month, e }, i) => {
    const rent = e?.rent ?? unitDef?.rent ?? 0;
    const paid = e?.paid ?? 0;
    const bal = rent - paid;
    tReq += rent; tPaid += paid;
    const row = ws.addRow([month, rent, paid, bal, e?.date ?? "", e?.receipt ?? ""]);
    styleDataRow(row, { zebra: i % 2 === 1 });
    moneyCols(row, [2, 3, 4]);
    balanceColor(row, 4, bal, paid);
  });
  const tr = totalRow(ws, ["YEAR TOTAL", tReq, tPaid, tReq - tPaid, "", ""], GOLD, "FF0A0F1A");
  moneyCols(tr, [2, 3, 4]);
  await saveWb(wb, `Menetekel_F${floor}_${unitLabel.replace(/\W+/g, "")}_${PROPERTY.year}.xlsx`);
}
