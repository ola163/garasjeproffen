import type { DoorColor } from "./parameters";

// Innkjøpspriser eks. moms og påslag
// Varenr: GP-P001 … GP-P005
export const DOOR_COST_PRICES: Record<number, Partial<Record<DoorColor, number>>> = {
  2500: { hvit: 15111.55, sort: 17267.95 },
  3000: { hvit: 17615.95 },          // sort ikke tilgjengelig for 3000
  5000: { hvit: 24038.90, sort: 28125.50 },
};

export const DEFAULT_DOOR_MARKUP = 0.30; // 30 % påslag

/** Returns the door sell price (innkjøpspris × (1 + markupFraction)), or null if not available. */
export function getDoorPrice(
  doorWidthMm: number,
  doorColor: DoorColor,
  markupFraction: number = DEFAULT_DOOR_MARKUP,
): number | null {
  const cost = DOOR_COST_PRICES[doorWidthMm]?.[doorColor];
  if (cost == null) return null;
  return Math.round(cost * (1 + markupFraction));
}

export function isDoorColorAvailable(doorWidthMm: number, doorColor: DoorColor): boolean {
  return DOOR_COST_PRICES[doorWidthMm]?.[doorColor] != null;
}

// GP varenummer scheme
export const DOOR_VARENR: Record<number, Partial<Record<DoorColor, string>>> = {
  2500: { hvit: "GP-P001", sort: "GP-P002" },
  3000: { hvit: "GP-P003" },
  5000: { hvit: "GP-P004", sort: "GP-P005" },
};
