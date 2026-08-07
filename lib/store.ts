"use client";

import { FLOORS, unitsForFloor, PROPERTY } from "./config";

export interface Entry {
  floor: number;
  unit: string;
  rent: number;
  merged: boolean;
  tenant: string;
  paid: number;
  date: string;
  receipt: string;
}

export type MonthData = Entry[];

const KEY_PREFIX = "menetekel";

export function defaultDate(monthIndex: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(PROPERTY.dueDay).padStart(2, "0");
  return `${dd}/${mm}/${PROPERTY.year}`;
}

export function blankMonth(monthIndex: number): MonthData {
  const rows: Entry[] = [];
  for (const f of FLOORS) {
    for (const u of unitsForFloor(f)) {
      rows.push({
        floor: f,
        unit: u.label,
        rent: u.rent,
        merged: !!u.merged,
        tenant: "",
        paid: 0,
        date: defaultDate(monthIndex),
        receipt: "",
      });
    }
  }
  return rows;
}

export function loadMonth(monthIndex: number): MonthData {
  if (typeof window === "undefined") return blankMonth(monthIndex);
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}:${PROPERTY.year}:${monthIndex}`);
    if (!raw) return blankMonth(monthIndex);
    const parsed = JSON.parse(raw) as MonthData;
    if (!Array.isArray(parsed) || parsed.length === 0) return blankMonth(monthIndex);
    return parsed;
  } catch {
    return blankMonth(monthIndex);
  }
}

export function saveMonth(monthIndex: number, data: MonthData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${KEY_PREFIX}:${PROPERTY.year}:${monthIndex}`,
      JSON.stringify(data)
    );
  } catch {
    /* storage full or blocked - ignore */
  }
}

export function monthTotals(data: MonthData) {
  const required = data.reduce((s, r) => s + r.rent, 0);
  const paid = data.reduce((s, r) => s + r.paid, 0);
  const balance = required - paid;
  const rate = required > 0 ? Math.round((paid / required) * 100) : 0;
  const fullyPaid = data.filter((r) => r.paid >= r.rent).length;
  const defaulters = data.filter((r) => r.paid < r.rent).length;
  return { required, paid, balance, rate, fullyPaid, defaulters };
}

export function floorTotals(data: MonthData, floor: number) {
  return monthTotals(data.filter((r) => r.floor === floor));
}
