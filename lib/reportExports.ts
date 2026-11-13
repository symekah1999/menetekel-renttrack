"use client";

/**
 * The report documents: building statement, owner report, tenant statement,
 * year-end pack and CSV files. Loaded only when a download is requested.
 */
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { MONTHS, PROPERTY } from "./config";
import { header, footer, kpiBoxes, signatureBlock, tableTheme, NAVY, GREEN, RED, GREY, GOLD } from "./exportPdf";
import type { MonthFacts, PeriodFacts } from "./reportData";
import type { MriRow } from "./tax";
import { CATEGORY_LABEL, ExpenseCategory } from "./expenses";
import type { UnitStatus } from "./status";

type Doc = jsPDF & { lastAutoTable: { finalY: number } };
const R = (v: number | string) => ({ content: typeof v === "number" ? v.toLocaleString() : v, styles: { halign: "right" as const } });
const ksh = (n: number) => `KSh ${Math.round(n).toLocaleString()}`;
const STATUS: Record<UnitStatus, { label: string; color: [number, number, number] }> = {
  paid: { label: "PAID", color: GREEN }, part: { label: "PART-PAID", color: [168, 104, 10] },
  owe: { label: "OWING", color: RED }, vacant: { label: "VACANT", color: GREY }, none: { label: "NOT OPENED", color: GREY },
};

function save(doc: jsPDF, name: string) { doc.save(name); }

/* ---------- CSV ---------- */

/** One cell. Text that a spreadsheet would treat as a formula is defused with a leading apostrophe. */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- building statement ---------- */

/** Every unit in the building for one month: paid, part-paid, owing or vacant. */
export function downloadBuildingStatementPdf(year: number, f: MonthFacts) {
  const doc = new jsPDF({ orientation: "landscape" }) as Doc;
  header(doc, `${PROPERTY.name} — Building statement`, `${MONTHS[f.month]} ${year} · all ${f.units.length} units · rent due on the ${PROPERTY.dueDay}th`);
  let y = kpiBoxes(doc, 38, [
    { label: "Charged", value: ksh(f.charged) },
    { label: "Collected", value: ksh(f.collected), color: GREEN },
    { label: "Still owed", value: ksh(f.outstanding), color: f.outstanding > 0 ? RED : GREEN },
    { label: "Collection rate", value: `${f.rate}%` },
    { label: "Paid / part / owing", value: `${f.clear} / ${f.part} / ${f.owing}` },
    { label: "Vacant", value: `${f.vacant} units` },
  ]);
  autoTable(doc, {
    ...tableTheme, startY: y,
    head: [["Floor", "Unit", "Tenant", "Rent", "Water", "Due", "Paid", "Balance", "Status", "Last paid", "Receipts"]],
    body: f.units.map((u) => [
      String(u.floor), u.unit, u.tenant || (u.status === "vacant" ? "—" : "No name"),
      R(u.rent), R(u.water), R(u.due), R(u.paid),
      { content: u.status === "vacant" ? "—" : u.balance > 0 ? u.balance.toLocaleString() : u.balance < 0 ? `CR ${(-u.balance).toLocaleString()}` : "0", styles: { halign: "right" as const, fontStyle: "bold" as const, textColor: u.balance > 0 ? RED : GREEN } },
      { content: STATUS[u.status].label, styles: { fontStyle: "bold" as const, textColor: STATUS[u.status].color } },
      u.lastPaid || "—", u.receipts.join(" ").slice(0, 40) || "—",
    ]),
    foot: [[
      "", "", "Whole building", R(f.units.reduce((s, u) => s + (u.status === "vacant" ? 0 : u.rent), 0)), R(f.waterCharged),
      R(f.charged), R(f.collected), R(f.outstanding), `${f.rate}%`, "", "",
    ]],
    footStyles: { fillColor: [238, 233, 250], textColor: NAVY, fontStyle: "bold", fontSize: 8 },
    showFoot: "lastPage",
    columnStyles: { 2: { cellWidth: 42 }, 10: { cellWidth: 34, fontSize: 7 } },
  });
  y = doc.lastAutoTable.finalY + 6;
  doc.setFontSize(8); doc.setTextColor(...GREY);
  doc.text(`Vacant units would have brought in ${ksh(f.vacancyLoss)} this month. Each month stands on its own: balances from earlier months are on the Cumulative page.`, 12, y);
  signatureBlock(doc, y + 2);
  footer(doc);
  save(doc, `Menetekel_Building_Statement_${MONTHS[f.month]}_${year}.pdf`);
}

export async function downloadBuildingStatementExcel(year: number, f: MonthFacts) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${MONTHS[f.month].slice(0, 3)} ${year}`);
  ws.addRow([`${PROPERTY.name} — Building statement, ${MONTHS[f.month]} ${year}`]).font = { bold: true, size: 14 };
  ws.addRow([`Charged ${f.charged}`, `Collected ${f.collected}`, `Owed ${f.outstanding}`, `Rate ${f.rate}%`, `Vacant ${f.vacant}`]);
  ws.addRow([]);
  const head = ws.addRow(["Floor", "Unit", "Tenant", "Rent", "Water", "Due", "Paid", "Balance", "Status", "Last paid", "Receipts"]);
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.eachCell((c) => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3E2A7E" } }; });
  for (const u of f.units) {
    const row = ws.addRow([u.floor, u.unit, u.tenant, u.rent, u.water, u.due, u.paid, u.status === "vacant" ? 0 : u.balance, STATUS[u.status].label, u.lastPaid, u.receipts.join(" ")]);
    row.getCell(9).font = { bold: true, color: { argb: u.status === "paid" ? "FF17805A" : u.status === "vacant" ? "FF6E7682" : "FFBF3B3B" } };
  }
  const tot = ws.addRow(["", "", "Whole building", null, f.waterCharged, f.charged, f.collected, f.outstanding, `${f.rate}%`]);
  tot.font = { bold: true };
  [4, 5, 6, 7, 8].forEach((c) => { ws.getColumn(c).numFmt = '#,##0'; ws.getColumn(c).width = 12; });
  ws.getColumn(3).width = 26; ws.getColumn(9).width = 12; ws.getColumn(10).width = 12; ws.getColumn(11).width = 30;
  ws.views = [{ state: "frozen", ySplit: 4 }];
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a"); a.href = url; a.download = `Menetekel_Building_Statement_${MONTHS[f.month]}_${year}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- owner report ---------- */

export interface OwnerReportInput {
  year: number;
  label: string; // "October 2026", "Q4 2026", "January to October 2026"
  now: PeriodFacts;
  before: PeriodFacts | null;
  ageing: [number, number, number, number];
  expenses: { total: number; byCategory: Record<ExpenseCategory, number> };
  topOwing: { floor: number; unit: string; tenant: string; balance: number }[];
  note?: string;
}

/** A one-page summary for the owner. */
export function downloadOwnerReportPdf(x: OwnerReportInput) {
  const doc = new jsPDF() as Doc;
  const n = x.now, b = x.before;
  // The PDF's built-in fonts have no arrow symbols, so the change is written out.
  const arrow = (a: number, p?: number | null) => (p === null || p === undefined || a === p ? "" : `  (${a > p ? "+" : "-"}${Math.abs(a - p).toLocaleString()})`);
  header(doc, `${PROPERTY.name} — Owner report`, `${x.label} · prepared by ${PROPERTY.manager}`);
  let y = kpiBoxes(doc, 38, [
    { label: "Collected", value: ksh(n.collected) + arrow(n.collected, b?.collected), color: GREEN },
    { label: "Collection rate", value: `${n.rate}%` },
    { label: "Owed for this period", value: ksh(n.outstanding), color: n.outstanding > 0 ? RED : GREEN },
  ]);
  y = kpiBoxes(doc, y - 2, [
    { label: "Occupancy", value: `${n.occupancy}%` },
    { label: "Lost to vacancies", value: ksh(n.vacancyLoss), color: RED },
    { label: "Net after expenses", value: ksh(n.collected - x.expenses.total), color: NAVY },
  ]);

  autoTable(doc, {
    ...tableTheme, startY: y,
    head: [["Money", x.label, b ? "Previous period" : ""]],
    body: [
      ["Rent and water charged", R(n.charged), b ? R(b.charged) : ""],
      ["Collected", R(n.collected), b ? R(b.collected) : ""],
      ["  of which rent (estimate)", R(n.rentReceived), b ? R(b.rentReceived) : ""],
      ["Expenses", R(x.expenses.total), ""],
      [{ content: "Net after expenses", styles: { fontStyle: "bold" as const } }, { content: (n.collected - x.expenses.total).toLocaleString(), styles: { halign: "right" as const, fontStyle: "bold" as const } }, ""],
    ],
    columnStyles: { 0: { cellWidth: 80 } },
  });
  y = doc.lastAutoTable.finalY + 6;

  autoTable(doc, {
    ...tableTheme, startY: y,
    head: [["All unpaid balances to date, by age", "Up to 30 days", "31–60", "61–90", "Over 90"]],
    body: [["Amount", R(x.ageing[0]), R(x.ageing[1]), R(x.ageing[2]), R(x.ageing[3])]],
  });
  y = doc.lastAutoTable.finalY + 6;

  if (x.topOwing.length) {
    autoTable(doc, {
      ...tableTheme, startY: y,
      head: [["Largest balances to date", "Unit", "Owed"]],
      body: x.topOwing.slice(0, 5).map((u) => [u.tenant || "No name", `Floor ${u.floor}, ${u.unit}`, R(u.balance)]),
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  const spent = (Object.keys(x.expenses.byCategory) as ExpenseCategory[]).filter((k) => x.expenses.byCategory[k] !== 0);
  if (spent.length) {
    autoTable(doc, {
      ...tableTheme, startY: y,
      head: [["Expenses", "Amount"]],
      body: spent.map((k) => [CATEGORY_LABEL[k], R(x.expenses.byCategory[k])]),
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  doc.setFontSize(8.5); doc.setTextColor(...GREY);
  const ch = n.channels;
  doc.text(`Payments came in by M-Pesa prompt ${ksh(ch.stk)}, by hand ${ksh(ch.manual)}, statement import ${ksh(ch.csv)}${ch.earlier ? `, entered before the ledger ${ksh(ch.earlier)}` : ""}.`, 12, y);
  if (x.note) { y += 6; doc.setTextColor(40, 45, 55); doc.text(doc.splitTextToSize(`Notes: ${x.note}`, 186), 12, y); }
  footer(doc);
  save(doc, `Menetekel_Owner_Report_${x.label.replace(/[^A-Za-z0-9]+/g, "_")}.pdf`);
}

/* ---------- tenant statement ---------- */

export interface TenantStatementInput {
  year: number;
  tenant: string;
  floor: number;
  unit: string;
  phone: string;
  deposit: number;
  moveIn: string;
  lines: { month: number; rent: number; water: number; paid: number; receipts: string[] }[];
}

/** One tenant's stay: what was charged and paid each month, with a running balance. */
export function downloadTenantStatementPdf(x: TenantStatementInput) {
  const doc = new jsPDF() as Doc;
  const first = x.lines[0]?.month ?? 0, last = x.lines[x.lines.length - 1]?.month ?? 0;
  header(doc, `Tenant statement — ${x.tenant || `Floor ${x.floor}, ${x.unit}`}`, `Floor ${x.floor}, ${x.unit} · ${MONTHS[first]} to ${MONTHS[last]} ${x.year}`);
  let running = 0;
  const body = x.lines.map((l) => {
    const due = l.rent + l.water;
    running += due - l.paid;
    return [MONTHS[l.month], R(l.rent), R(l.water), R(due), R(l.paid), { content: running.toLocaleString(), styles: { halign: "right" as const, fontStyle: "bold" as const, textColor: running > 0 ? RED : GREEN } }, l.receipts.join(" ").slice(0, 32) || "—"];
  });
  const charged = x.lines.reduce((s, l) => s + l.rent + l.water, 0), paid = x.lines.reduce((s, l) => s + l.paid, 0);
  let y = kpiBoxes(doc, 38, [
    { label: "Charged", value: ksh(charged) },
    { label: "Paid", value: ksh(paid), color: GREEN },
    { label: running > 0 ? "Balance owed" : "Balance", value: ksh(Math.max(0, running)), color: running > 0 ? RED : GREEN },
    { label: "Deposit held", value: x.deposit ? ksh(x.deposit) : "Not recorded" },
  ]);
  doc.setFontSize(8.5); doc.setTextColor(...GREY);
  doc.text(`Phone: ${x.phone || "not recorded"}${x.moveIn ? ` · Moved in: ${x.moveIn}` : ""}`, 12, y - 2);
  autoTable(doc, { ...tableTheme, startY: y + 2, head: [["Month", "Rent", "Water", "Due", "Paid", "Running balance", "Receipts"]], body });
  y = doc.lastAutoTable.finalY + 6;
  if (running > 0 && x.deposit > 0) {
    doc.setFontSize(9); doc.setTextColor(40, 45, 55);
    doc.text(`If the deposit is used against the balance: ${running > x.deposit ? `KSh ${(running - x.deposit).toLocaleString()} still owed` : `KSh ${(x.deposit - running).toLocaleString()} to refund`}.`, 12, y);
    y += 4;
  }
  signatureBlock(doc, y);
  footer(doc);
  save(doc, `Menetekel_Tenant_Statement_${(x.tenant || `F${x.floor}_${x.unit}`).replace(/[^A-Za-z0-9]+/g, "_")}_${x.year}.pdf`);
}

/* ---------- year-end pack ---------- */

export interface YearEndInput {
  year: number;
  months: MonthFacts[];
  expensesByMonth: number[];
  rentChanges: { floor: number; unit: string; from: number; to: number; month: number }[];
  tax: { rows: MriRow[]; totalTax: number; ratePct: number };
}

export function downloadYearEndPdf(x: YearEndInput) {
  const doc = new jsPDF() as Doc;
  const opened = x.months.filter((m) => m.opened);
  const tot = (k: "charged" | "collected" | "outstanding" | "vacancyLoss") => opened.reduce((s, m) => s + m[k], 0);
  const spent = x.expensesByMonth.reduce((s, n) => s + n, 0);
  header(doc, `${PROPERTY.name} — Year-end summary ${x.year}`, `${opened.length} months recorded · prepared by ${PROPERTY.manager}`);
  let y = kpiBoxes(doc, 38, [
    { label: "Charged", value: ksh(tot("charged")) },
    { label: "Collected", value: ksh(tot("collected")), color: GREEN },
    { label: "Expenses", value: ksh(spent) },
    { label: "Net", value: ksh(tot("collected") - spent), color: NAVY },
  ]);
  const best = [...opened].sort((a, b) => b.rate - a.rate)[0], worst = [...opened].sort((a, b) => a.rate - b.rate)[0];
  doc.setFontSize(9); doc.setTextColor(40, 45, 55);
  if (best && worst) doc.text(`Best month: ${MONTHS[best.month]} (${best.rate}%). Weakest month: ${MONTHS[worst.month]} (${worst.rate}%). Rent lost to vacancies: ${ksh(tot("vacancyLoss"))}.`, 12, y - 1);
  autoTable(doc, {
    ...tableTheme, startY: y + 3,
    head: [["Month", "Charged", "Collected", "Owed", "Rate", "Occupied", "Vacancy loss", "Expenses", "MRI tax"]],
    body: x.months.map((m, i) => m.opened
      ? [MONTHS[m.month], R(m.charged), R(m.collected), R(m.outstanding), `${m.rate}%`, `${m.occupied}/${m.occupied + m.vacant}`, R(m.vacancyLoss), R(x.expensesByMonth[i] ?? 0), R(x.tax.rows[i]?.tax ?? 0)]
      : [MONTHS[m.month], { content: "Not opened", colSpan: 8, styles: { textColor: GREY } }]),
    showFoot: "lastPage",
    foot: [["Year", R(tot("charged")), R(tot("collected")), R(tot("outstanding")), "", "", R(tot("vacancyLoss")), R(spent), R(x.tax.totalTax)]],
    footStyles: { fillColor: [238, 233, 250], textColor: NAVY, fontStyle: "bold", fontSize: 8 },
  });
  y = doc.lastAutoTable.finalY + 6;
  if (x.rentChanges.length) {
    autoTable(doc, {
      ...tableTheme, startY: y,
      head: [["Rent changes this year", "From", "To", "Starting"]],
      body: x.rentChanges.map((c) => [`Floor ${c.floor}, ${c.unit}`, R(c.from), R(c.to), MONTHS[c.month]]),
    });
    y = doc.lastAutoTable.finalY + 6;
  }
  doc.setFontSize(7.5); doc.setTextColor(...GREY);
  doc.text(doc.splitTextToSize(`MRI tax column: ${x.tax.ratePct}% of the rent share received each month (rent taken as paid before water). Check your filing obligations on KRA's eRITS or iTax; this is a working aid, not tax advice.`, 186), 12, y);
  doc.setDrawColor(...GOLD);
  footer(doc);
  save(doc, `Menetekel_Year_End_${x.year}.pdf`);
}
