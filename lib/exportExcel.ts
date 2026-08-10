"use client";

import ExcelJS from "exceljs";
import { MONTHS, PROPERTY, FLOORS, unitsForFloor } from "./config";
import {
  loadMonth, monthTotalsFull, floorTotalsFull, arrearsMapFor,
  monthDue, getActiveYear, Entry,
} from "./store";

const NAVY = "FF0F2C52";
const NAVY_LIGHT = "FF1B3A66";
const GOLD = "FFC8A951";
const GOLD_LIGHT = "FFF5EAD0";
const GREEN = "FF2E7D4F";
const RED = "FFC0392B";
const WHITE = "FFFFFFFF";
const GREY_ROW = "FFF4F6FA";
const VACANT_ROW = "FFE8EAEE";
const KSH = '"KShs" #,##0';

function thinBorder(): Partial<ExcelJS.Borders> {
  const s: Partial<ExcelJS.Border> = { style: "thin", color: { argb: "FFD8DEE9" } };
  return { top: s, left: s, bottom: s, right: s };
}
function fill(argb: string): ExcelJS.FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function titleBand(ws: ExcelJS.Worksheet, title: string, subtitle: string, span: number) {
  const last = ws.getColumn(span).letter;
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
  row.height = 22;
  return row;
}

function styleDataRow(row: ExcelJS.Row, opts: { zebra?: boolean; merged?: boolean; vacant?: boolean } = {}) {
  row.eachCell((c) => {
    c.font = { name: "Calibri", size: 10, color: opts.vacant ? { argb: "FF8A93A3" } : undefined };
    c.border = thinBorder();
    if (opts.vacant) c.fill = fill(VACANT_ROW);
    else if (opts.merged) c.fill = fill(GOLD_LIGHT);
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
  const base = { name: "Calibri", size: 10, bold: true };
  if (bal <= 0 && paid > 0) c.font = { ...base, color: { argb: GREEN } };
  else if (bal > 0) c.font = { ...base, color: { argb: RED } };
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

const UNIT_COLS = [
  { width: 10 }, { width: 11 }, { width: 20 }, { width: 13 }, { width: 11 },
  { width: 11 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 13 },
];
const UNIT_HEAD = ["Floor", "Unit", "Tenant", "Phone", "Rent", "Water", "Arrears", "Total due", "Paid", "Balance", "Receipt no."];

function unitRowCells(r: Entry, arrears: number): (string | number)[] {
  const due = monthDue(r) + arrears;
  return [
    `Floor ${r.floor}`,
    r.unit + (r.vacant ? " (vacant)" : ""),
    r.tenant, r.phone,
    r.vacant ? 0 : r.rent, r.water, arrears, due, r.paid, due - r.paid, r.receipt,
  ];
}

function buildMonthSheet(wb: ExcelJS.Workbook, mi: number, year: number) {
  const data = loadMonth(mi, year);
  const arrMap = arrearsMapFor(mi, year);
  const ws = wb.addWorksheet(MONTHS[mi].slice(0, 3), {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  ws.columns = UNIT_COLS;
  titleBand(
    ws,
    `${PROPERTY.name} — Rent Collection`,
    `${MONTHS[mi]} ${year} · ${PROPERTY.paymentMode} · Due ${PROPERTY.dueDay}th · Manager: ${PROPERTY.manager}`,
    UNIT_COLS.length
  );
  headerRow(ws, UNIT_HEAD);

  for (const f of FLOORS) {
    const rowsF = data.filter((r) => r.floor === f);
    rowsF.forEach((r, i) => {
      const a = arrMap[`${r.floor}|${r.unit}`] ?? 0;
      const row = ws.addRow(unitRowCells(r, a));
      styleDataRow(row, { zebra: i % 2 === 1, merged: r.merged, vacant: r.vacant });
      moneyCols(row, [5, 6, 7, 8, 9, 10]);
      balanceColor(row, 10, monthDue(r) + a - r.paid, r.paid);
    });
    const ft = floorTotalsFull(mi, f, year);
    const tr = totalRow(ws, [`Floor ${f} total`, "", "", "", "", ft.monthCharges, ft.arrears, ft.totalDue, ft.paid, ft.balance, `${ft.rate}%`], NAVY);
    moneyCols(tr, [6, 7, 8, 9, 10]);
  }

  const gt = monthTotalsFull(mi, year);
  ws.addRow([]);
  const gr = totalRow(
    ws,
    ["GRAND TOTAL", "", "", "", "", gt.monthCharges, gt.arrears, gt.totalDue, gt.paid, gt.balance, `${gt.fullyPaid}/34 clear`],
    GOLD, "FF0A0F1A"
  );
  moneyCols(gr, [6, 7, 8, 9, 10]);
  gr.height = 22;
  ws.views = [{ state: "frozen", ySplit: 4 }];
}

export async function downloadYearExcel() {
  const year = getActiveYear();
  const wb = newWb();

  const sum = wb.addWorksheet("Summary");
  sum.columns = [
    { width: 14 }, { width: 15 }, { width: 14 }, { width: 15 }, { width: 15 }, { width: 9 }, { width: 12 },
  ];
  titleBand(sum, `${PROPERTY.name} — ${year} Year Summary`, `${PROPERTY.location} · 5 floors · 34 units · Manager: ${PROPERTY.manager}`, 7);
  headerRow(sum, ["Month", "Charges (rent+water)", "Arrears b/f", "Total due", "Collected", "Rate", "Units clear"]);
  let yCharges = 0, yPaid = 0;
  MONTHS.forEach((m, mi) => {
    const t = monthTotalsFull(mi, year);
    yCharges += t.monthCharges; yPaid += t.paid;
    const row = sum.addRow([m, t.monthCharges, t.arrears, t.totalDue, t.paid, `${t.rate}%`, `${t.fullyPaid}/34`]);
    styleDataRow(row, { zebra: mi % 2 === 1 });
    moneyCols(row, [2, 3, 4, 5]);
    balanceColor(row, 5, t.totalDue - t.paid, t.paid);
  });
  const yr = totalRow(
    sum,
    ["YEAR TOTAL", yCharges, "", "", yPaid, yCharges > 0 ? `${Math.round((yPaid / yCharges) * 100)}%` : "—", ""],
    GOLD, "FF0A0F1A"
  );
  moneyCols(yr, [2, 5]);

  MONTHS.forEach((_, mi) => buildMonthSheet(wb, mi, year));
  await saveWb(wb, `Menetekel_Rent_${year}.xlsx`);
}

export async function downloadFloorExcel(mi: number, floor: number) {
  const year = getActiveYear();
  const wb = newWb();
  const data = loadMonth(mi, year).filter((r) => r.floor === floor);
  const arrMap = arrearsMapFor(mi, year);
  const ws = wb.addWorksheet(`Floor ${floor}`, {
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1 },
  });
  ws.columns = UNIT_COLS.slice(1);
  titleBand(
    ws,
    `${PROPERTY.name} — Floor ${floor} Report`,
    `${MONTHS[mi]} ${year} · ${data.length} units${floor === 0 ? " · Unit 6+7 merged" : ""} · ${PROPERTY.paymentMode}`,
    UNIT_COLS.length - 1
  );
  headerRow(ws, UNIT_HEAD.slice(1));
  data.forEach((r, i) => {
    const a = arrMap[`${r.floor}|${r.unit}`] ?? 0;
    const row = ws.addRow(unitRowCells(r, a).slice(1));
    styleDataRow(row, { zebra: i % 2 === 1, merged: r.merged, vacant: r.vacant });
    moneyCols(row, [4, 5, 6, 7, 8, 9]);
    balanceColor(row, 9, monthDue(r) + a - r.paid, r.paid);
  });
  const ft = floorTotalsFull(mi, floor, year);
  const tr = totalRow(ws, [`Floor ${floor} total`, "", "", "", ft.monthCharges, ft.arrears, ft.totalDue, ft.paid, ft.balance, `${ft.rate}%`], GOLD, "FF0A0F1A");
  moneyCols(tr, [5, 6, 7, 8, 9]);
  await saveWb(wb, `Menetekel_Floor${floor}_${MONTHS[mi]}_${year}.xlsx`);
}

export async function downloadUnitExcel(floor: number, unitLabel: string) {
  const year = getActiveYear();
  const wb = newWb();
  const ws = wb.addWorksheet("Statement");
  ws.columns = [
    { width: 13 }, { width: 11 }, { width: 11 }, { width: 12 }, { width: 12 },
    { width: 13 }, { width: 12 }, { width: 14 },
  ];
  const unitDef = unitsForFloor(floor).find((u) => u.label === unitLabel);
  let tenant = "";
  let cumulative = 0;
  const rows = MONTHS.map((m, mi) => {
    const e = loadMonth(mi, year).find((r) => r.floor === floor && r.unit === unitLabel);
    if (e?.tenant) tenant = e.tenant;
    return { m, e };
  });
  titleBand(
    ws,
    `${PROPERTY.name} — Unit Statement`,
    `Floor ${floor} · ${unitLabel}${unitDef?.merged ? " (merged)" : ""} · Tenant: ${tenant || "—"} · Base rent: KShs ${(unitDef?.rent ?? 0).toLocaleString()}/month · ${year}`,
    8
  );
  headerRow(ws, ["Month", "Rent", "Water", "Month due", "Paid", "Month balance", "Running balance", "Receipt no."]);
  let tDue = 0, tPaid = 0;
  rows.forEach(({ m, e }, i) => {
    const rent = e ? (e.vacant ? 0 : e.rent) : 0;
    const water = e?.water ?? 0;
    const due = rent + water;
    const paid = e?.paid ?? 0;
    cumulative += due - paid;
    tDue += due; tPaid += paid;
    const row = ws.addRow([
      m + (e?.vacant ? " (vacant)" : ""), rent, water, due, paid, due - paid, cumulative, e?.receipt ?? "",
    ]);
    styleDataRow(row, { zebra: i % 2 === 1, vacant: e?.vacant });
    moneyCols(row, [2, 3, 4, 5, 6, 7]);
    balanceColor(row, 7, cumulative, paid);
  });
  const tr = totalRow(ws, ["YEAR TOTAL", "", "", tDue, tPaid, tDue - tPaid, cumulative, ""], GOLD, "FF0A0F1A");
  moneyCols(tr, [4, 5, 6, 7]);
  await saveWb(wb, `Menetekel_F${floor}_${unitLabel.replace(/\W+/g, "")}_${year}.xlsx`);
}
