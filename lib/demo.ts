"use client";

import { FLOORS, unitsForFloor } from "./config";
import { blankMonth, Entry, savePayments } from "./store";
import type { Payment } from "./ledger";

/** Obviously fictional tenants, so sample data can never be mistaken for real people. */
const NAMES = [
  "Wanjiru Kamau", "Otieno Achieng", "Mutua Mwende", "Njeri Mwangi", "Kiplagat Cheruiyot",
  "Akinyi Odhiambo", "Karanja Njoroge", "Naliaka Wekesa", "Omondi Awino", "Chebet Rotich",
  "Muthoni Gathoni", "Kimani Waweru", "Atieno Ouma", "Kariuki Maina", "Wambui Ndungu",
  "Barasa Simiyu", "Nyambura Kuria", "Ochieng Onyango", "Jeruto Kosgei", "Mbugua Thuo",
];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Fill localStorage with ten realistic months so the app can be explored (and
 * screenshotted) without a database. Only ever called from local mode.
 */
export function loadDemoData(year: number, upToMonth: number): number {
  const rand = rng(2026);
  const payments: Payment[] = [];
  let n = 0;
  const tenantByKey = new Map<string, { tenant: string; phone: string; vacant: boolean }>();
  let nameIx = 0;
  for (const f of FLOORS) {
    for (const u of unitsForFloor(f)) {
      const vacant = (f === 1 && u.label === "Unit 5") || (f === 4 && u.label === "Unit 6");
      tenantByKey.set(`${f}|${u.label}`, {
        tenant: vacant ? "" : NAMES[nameIx++ % NAMES.length],
        phone: vacant ? "" : `0700 000 ${String(100 + nameIx).padStart(3, "0")}`,
        vacant,
      });
    }
  }

  for (let m = 0; m <= upToMonth; m++) {
    const rows: Entry[] = blankMonth(m, year).map((r) => {
      const t = tenantByKey.get(`${r.floor}|${r.unit}`)!;
      const water = t.vacant ? 0 : Math.round((200 + rand() * 500) / 50) * 50;
      return { ...r, tenant: t.tenant, phone: t.phone, vacant: t.vacant, water, ts: Date.now() };
    });
    localStorage.setItem(`menetekel:${year}:${m}`, JSON.stringify(rows));

    for (const r of rows) {
      if (r.vacant) continue;
      const due = r.rent + r.water;
      const isCurrent = m === upToMonth;
      const roll = rand();
      // Earlier months are mostly settled; the current month is mid-collection.
      const pPaid = isCurrent ? 0.62 : 0.985;
      const pPart = isCurrent ? 0.18 : 0.01;
      let amount = 0;
      if (roll < pPaid) amount = due;
      else if (roll < pPaid + pPart) amount = Math.round((due * (0.3 + rand() * 0.4)) / 100) * 100;
      if (amount <= 0) continue;
      const day = String(3 + Math.floor(rand() * 6)).padStart(2, "0");
      payments.push({
        id: crypto.randomUUID(),
        year, month: m, floor: r.floor, unit: r.unit, amount,
        receipt: `DEMO${m}${r.floor}${r.unit.replace(/\W/g, "")}`.toUpperCase(),
        source: rand() < 0.6 ? "stk" : "manual",
        paidOn: `${day}/${String(m + 1).padStart(2, "0")}/${year}`,
        createdAt: new Date(Date.UTC(year, m, +day, 7, 0, 0)).toISOString(),
        synced: true,
      });
      n++;
    }
  }
  savePayments(year, payments);
  return n;
}
