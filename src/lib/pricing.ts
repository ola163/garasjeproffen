import type { GarageConfiguration, PricingResult } from "@/types/configurator";

export type PackageType = "materialpakke" | "prefab";
export type RoofType = "saltak" | "flattak";

const PRICE_PER_SQM: Record<RoofType, Record<PackageType, number>> = {
  saltak:  { materialpakke: 3750, prefab: 7000 },
  flattak: { materialpakke: 3500, prefab: 6500 },
};

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "NOK";

// Door cost by width in mm
const DOOR_COST: Record<number, number> = {
  2500: 20_000,
  2600: 20_000,
  5000: 40_000,
};

export function calculatePrice(config: GarageConfiguration, packageType: PackageType = "materialpakke", roofType: RoofType = "flattak", buildingType: string = "garasje"): PricingResult {
  const lengthMm    =  config.parameters.length    ?? 6000;
  const widthMm     =  config.parameters.width     ?? 8400;
  const doorWidthMm =  config.parameters.doorWidth ?? 2500;

  const pricePerSqm = PRICE_PER_SQM[roofType][packageType];
  const basePrice = Math.round((lengthMm / 1000) * (widthMm / 1000) * pricePerSqm);

  const isCarport     = buildingType === "carport";
  const widthSnapped  = !isCarport && (widthMm - 200) % 600 === 0;
  const lengthSnapped = !isCarport && lengthMm % 600 === 0;
  const snappedCount  = (widthSnapped ? 1 : 0) + (lengthSnapped ? 1 : 0);
  const discountRate  = snappedCount === 2 ? 0.10 : snappedCount === 1 ? 0.05 : 0;
  const snapDiscount  = Math.round(basePrice * discountRate);
  const discountLabel = `Standard mål (-${discountRate * 100}%)`;

  const adjustments = [
    ...(snapDiscount > 0 ? [{ label: discountLabel, amount: -snapDiscount }] : []),
  ];

  return {
    basePrice,
    adjustments,
    totalPrice: basePrice - snapDiscount,
    currency: CURRENCY,
  };
}

export function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
