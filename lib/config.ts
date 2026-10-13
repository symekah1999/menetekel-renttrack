export interface UnitDef {
  label: string;
  rent: number;
  merged?: boolean;
}

export const PROPERTY = {
  name: "Menetekel Apartments",
  location: "Nairobi, Kenya",
  manager: "Shadrack Symekah",
  paymentMode: "M-Pesa",
  dueDay: 5,
  year: 2026,
};

export const FLOOR0_UNITS: UnitDef[] = [
  { label: "Unit 1", rent: 6500 },
  { label: "Unit 2", rent: 4800 },
  { label: "Unit 3", rent: 4800 },
  { label: "Unit 4", rent: 4800 },
  { label: "Unit 5", rent: 7500 },
  { label: "Unit 6+7", rent: 7500, merged: true },
];

export const FLOOR14_UNITS: UnitDef[] = [
  { label: "Unit 1", rent: 6500 },
  { label: "Unit 2", rent: 4800 },
  { label: "Unit 3", rent: 4800 },
  { label: "Unit 4", rent: 4800 },
  { label: "Unit 5", rent: 7500 },
  { label: "Unit 6", rent: 4800 },
  { label: "Unit 7", rent: 6500 },
];

export const FLOORS = [0, 1, 2, 3, 4];

export function unitsForFloor(f: number): UnitDef[] {
  return f === 0 ? FLOOR0_UNITS : FLOOR14_UNITS;
}

export const FLOOR0_TOTAL = FLOOR0_UNITS.reduce((s, u) => s + u.rent, 0); // 35,900
export const FLOOR14_TOTAL = FLOOR14_UNITS.reduce((s, u) => s + u.rent, 0); // 39,700
export const GRAND_TOTAL = FLOOR0_TOTAL + FLOOR14_TOTAL * 4; // 194,700
export const TOTAL_UNITS =
  FLOOR0_UNITS.length + FLOOR14_UNITS.length * 4; // 34

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function fmt(n: number): string {
  return "KSh " + Math.round(n).toLocaleString();
}
