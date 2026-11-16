import jsPDF from "jspdf";
import {
  ACCEPT_AFTER, AgreementFields, CLAUSES, INTRO_AFTER_ROOM, INTRO_BEFORE_ROOM, LETTERHEAD, REF_LINE, roman,
} from "./agreement";

const M = 20; // page margin, mm
const LH = 5.0; // line height, mm

/** A label, then the value written on a line. A blank value leaves the dotted line to fill by hand. */
function field(doc: jsPDF, label: string, value: string, y: number, w = 170) {
  doc.setFont("times", "bold");
  doc.text(label, M, y);
  const x = M + doc.getTextWidth(label) + 2;
  doc.setFont("times", "normal");
  if (value.trim()) {
    doc.text(value.trim(), x, y);
    doc.setDrawColor(120); doc.setLineWidth(0.15);
    doc.line(x, y + 1, M + w, y + 1);
  } else {
    doc.setDrawColor(120); doc.setLineDashPattern([0.4, 0.9], 0);
    doc.line(x, y, M + w, y);
    doc.setLineDashPattern([], 0);
  }
}

function dotted(doc: jsPDF, x: number, y: number, w: number) {
  doc.setDrawColor(120); doc.setLineWidth(0.15); doc.setLineDashPattern([0.4, 0.9], 0);
  doc.line(x, y, x + w, y);
  doc.setLineDashPattern([], 0);
}

export function buildTenancyAgreement(f: AgreementFields): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210 - 2 * M;
  doc.setTextColor(20);

  // letterhead
  doc.setFont("times", "bold"); doc.setFontSize(15);
  doc.text(LETTERHEAD[0], 105, 22, { align: "center" });
  doc.setFontSize(11);
  doc.text(LETTERHEAD[1], 105, 28, { align: "center" });
  doc.text(LETTERHEAD[2], 105, 33.5, { align: "center" });

  doc.setFontSize(11);
  let y = 46;
  field(doc, "NAME", f.name, y); y += 8;
  field(doc, "ID NO", f.idNo, y); y += 8;
  field(doc, "PLACE OF WORK", f.workplace, y); y += 8;
  field(doc, "TELEPHONE NUMBER", f.phone, y); y += 12;

  doc.setFont("times", "normal");
  doc.text("Dear Sir/Madam", M, y); y += 7;
  doc.setFont("times", "bold");
  doc.text(REF_LINE, M, y); y += 7;

  // intro with the room filled in
  doc.setFont("times", "normal"); doc.setFontSize(10.5);
  const room = f.room.trim();
  if (room) {
    const lines = doc.splitTextToSize(INTRO_BEFORE_ROOM + room + INTRO_AFTER_ROOM, W) as string[];
    doc.text(lines, M, y); y += lines.length * LH;
  } else {
    const lead = INTRO_BEFORE_ROOM;
    doc.text(lead, M, y);
    const x = M + doc.getTextWidth(lead);
    dotted(doc, x, y, 20);
    const rest = doc.splitTextToSize(INTRO_AFTER_ROOM.trim(), W - (x - M) - 22) as string[];
    doc.text(rest[0], x + 22, y);
    y += LH;
    const more = doc.splitTextToSize(rest.slice(1).join(" "), W) as string[];
    if (more.length && more[0]) { doc.text(more, M, y); y += more.length * LH; }
  }
  y += 2;

  const need = (h: number) => { if (y + h > 282) { doc.addPage(); y = 24; } };

  // clauses
  for (const c of CLAUSES) {
    const lines = doc.splitTextToSize(c.text, W - 9) as string[];
    need(lines.length * LH + 2);
    doc.text(`${c.n}.`, M, y, { baseline: "alphabetic" });
    doc.text(lines, M + 9, y);
    y += lines.length * LH + 1.2;
    for (let i = 0; i < (c.sub?.length ?? 0); i++) {
      const sl = doc.splitTextToSize(c.sub![i], W - 26) as string[];
      need(sl.length * LH + 1);
      doc.text(`(${roman(i)})`, M + 12, y);
      doc.text(sl, M + 22, y);
      y += sl.length * LH + 1;
    }
  }

  // acceptance
  need(70);
  y += 3;
  const name = f.name.trim();
  if (name) {
    const lines = doc.splitTextToSize(`I ${name}${ACCEPT_AFTER}`, W) as string[];
    doc.text(lines, M, y); y += lines.length * LH + 8;
  } else {
    doc.text("I", M, y);
    dotted(doc, M + 4, y, 70);
    const first = doc.splitTextToSize(ACCEPT_AFTER.trim(), W - 78) as string[];
    doc.text(first[0], M + 78, y);
    const rest = doc.splitTextToSize(ACCEPT_AFTER.trim().slice(first[0].length).trim(), W) as string[];
    y += LH;
    if (rest[0]) { doc.text(rest, M, y); y += LH * rest.length; }
    y += 8;
  }

  const sigLine = (label: string, note: string) => {
    doc.setFont("times", "bold"); doc.text(label, M, y);
    const x = M + doc.getTextWidth(label) + 2;
    dotted(doc, x, y, 62);
    doc.setFont("times", "normal"); doc.text(note, x + 64, y);
    y += 10;
  };
  sigLine("Signature", "(tenant)");
  sigLine("Date", "(signature)");
  y += 2;
  doc.setFont("times", "bold"); doc.text("APPROVED", M, y); y += 9;
  sigLine("Signature:", "(caretaker)");
  sigLine("Signature:", "(Management)");
  sigLine("Date", "");

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("times", "normal"); doc.setFontSize(8.5); doc.setTextColor(120);
    doc.text(`Menetekel Apartments tenancy agreement - page ${p} of ${pages}`, 105, 291, { align: "center" });
  }
  return doc;
}

const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");

export function downloadTenancyAgreementPdf(f: AgreementFields) {
  const doc = buildTenancyAgreement(f);
  doc.save(`Tenancy-agreement-${safe(f.room) || "unit"}${f.name ? "-" + safe(f.name) : ""}.pdf`);
}
