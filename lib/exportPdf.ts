"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { MONTHS, PROPERTY, FLOORS, fmt } from "./config";
import { loadMonth, floorTotals, monthTotals } from "./store";

export function downloadPdf(monthIndex: number): void {
  const data = loadMonth(monthIndex);
  const gt = monthTotals(data);
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setTextColor(15, 44, 82);
  doc.text(`${PROPERTY.name} — Collection Report`, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `${MONTHS[monthIndex]} ${PROPERTY.year} · ${PROPERTY.location} · ${PROPERTY.paymentMode} · Manager: ${PROPERTY.manager}`,
    14, 25
  );

  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.text(`Required: ${fmt(gt.required)}`, 14, 36);
  doc.text(`Collected: ${fmt(gt.paid)}`, 74, 36);
  doc.text(`Outstanding: ${fmt(gt.balance)}`, 134, 36);
  doc.text(`Collection rate: ${gt.rate}%   Fully paid: ${gt.fullyPaid}/34   Defaulters: ${gt.defaulters}`, 14, 43);

  autoTable(doc, {
    startY: 50,
    head: [["Floor", "Units", "Required", "Collected", "Balance", "Rate"]],
    body: FLOORS.map((f) => {
      const ft = floorTotals(data, f);
      const count = data.filter((r) => r.floor === f).length;
      return [
        `Floor ${f}${f === 0 ? " (Unit 6+7 merged)" : ""}`,
        String(count),
        ft.required.toLocaleString(),
        ft.paid.toLocaleString(),
        ft.balance.toLocaleString(),
        `${ft.rate}%`,
      ];
    }),
    foot: [[
      "Grand total", "34",
      gt.required.toLocaleString(),
      gt.paid.toLocaleString(),
      gt.balance.toLocaleString(),
      `${gt.rate}%`,
    ]],
    headStyles: { fillColor: [15, 44, 82] },
    footStyles: { fillColor: [200, 169, 81], textColor: [10, 15, 26] },
    styles: { fontSize: 9 },
  });

  const defaulters = data.filter((r) => r.paid < r.rent);
  if (defaulters.length > 0 && defaulters.length < 34) {
    const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    autoTable(doc, {
      startY: lastY + 8,
      head: [["Outstanding units", "Tenant", "Rent", "Paid", "Balance"]],
      body: defaulters.map((r) => [
        `Floor ${r.floor} · ${r.unit}`,
        r.tenant || "—",
        r.rent.toLocaleString(),
        r.paid.toLocaleString(),
        (r.rent - r.paid).toLocaleString(),
      ]),
      headStyles: { fillColor: [153, 60, 29] },
      styles: { fontSize: 8 },
    });
  }

  doc.save(`Menetekel_Report_${MONTHS[monthIndex]}_${PROPERTY.year}.pdf`);
}
