"use client";

import * as XLSX from "xlsx";
import { MONTHS, PROPERTY, FLOORS } from "./config";
import { loadMonth, floorTotals, monthTotals } from "./store";

export function downloadExcel(): void {
  const wb = XLSX.utils.book_new();

  MONTHS.forEach((monthName, mi) => {
    const data = loadMonth(mi);
    const rows: (string | number)[][] = [];

    rows.push([`${PROPERTY.name} — Rent Collection`, "", "", "", "", "", ""]);
    rows.push([`${monthName} ${PROPERTY.year} · Payment mode: ${PROPERTY.paymentMode} · Due: ${PROPERTY.dueDay}th`, "", "", "", "", "", ""]);
    rows.push([]);
    rows.push(["Floor", "Unit", "Tenant name", "Rent (KShs)", "Paid (KShs)", "Balance (KShs)", "Date", "Receipt no."]);

    for (const f of FLOORS) {
      const floorRows = data.filter((r) => r.floor === f);
      for (const r of floorRows) {
        rows.push([
          `Floor ${r.floor}`,
          r.unit + (r.merged ? " (merged)" : ""),
          r.tenant,
          r.rent,
          r.paid,
          r.rent - r.paid,
          r.date,
          r.receipt,
        ]);
      }
      const ft = floorTotals(data, f);
      rows.push([
        `Floor ${f} total`, "", "",
        ft.required, ft.paid, ft.balance, "", "",
      ]);
    }

    const gt = monthTotals(data);
    rows.push([]);
    rows.push(["GRAND TOTAL", "", "", gt.required, gt.paid, gt.balance, `${gt.rate}%`, ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 12 },
      { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, monthName.slice(0, 3));
  });

  XLSX.writeFile(wb, `Menetekel_Rent_${PROPERTY.year}.xlsx`);
}
