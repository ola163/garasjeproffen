import type { GarageConfiguration, PricingResult } from "@/types/configurator";

export type PackageType = "materialpakke" | "prefab";
export type RoofType = "saltak" | "flattak";

const PRICE_PER_SQM: Record<RoofType, Record<PackageType, number>> = {
  saltak:  { materialpakke: 4125, prefab: 7700 },
  flattak: { materialpakke: 3850, prefab: 7150 },
};

const CARPORT_PRICE_PER_SQM: Record<PackageType, number> = {
  materialpakke: 3500,
  prefab: 6500,
};

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "NOK";


export function calculatePrice(config: GarageConfiguration, packageType: PackageType = "materialpakke", roofType: RoofType = "flattak", buildingType: string = "garasje"): PricingResult {
  const lengthMm    =  config.parameters.length    ?? 6000;
  const widthMm     =  config.parameters.width     ?? 8400;
  const doorWidthMm =  config.parameters.doorWidth ?? 2500;

  const isCarport   = buildingType === "carport";
  const pricePerSqm = isCarport ? CARPORT_PRICE_PER_SQM[packageType] : PRICE_PER_SQM[roofType][packageType];
  const basePrice   = Math.round((lengthMm / 1000) * (widthMm / 1000) * pricePerSqm);

  // Snap discount (garage only)
  const widthSnapped  = !isCarport && (widthMm - 200) % 600 === 0;
  const lengthSnapped = !isCarport && lengthMm % 600 === 0;
  const snappedCount  = (widthSnapped ? 1 : 0) + (lengthSnapped ? 1 : 0);
  const discountRate  = snappedCount === 2 ? 0.10 : snappedCount === 1 ? 0.05 : 0;
  const snapDiscount  = Math.round(basePrice * discountRate);

  // Area (only used for manual quote threshold)
  const sqm        = (lengthMm / 1000) * (widthMm / 1000);
  const areaManual = sqm > 70;

  // Width surcharge — lower threshold for flat roof (5.0 m) vs pitched roof (6.2 m)
  const widthM             = widthMm / 1000;
  const widthManual        = widthM > 8.0;
  const lowerThreshold     = roofType === "flattak" ? 5.0 : 6.2;
  const widthSurchargeRate = !widthManual && widthM > 7.2 ? 0.10 : !widthManual && widthM > lowerThreshold ? 0.05 : 0;

  const manualQuote = areaManual || widthManual;
  const widthAdj    = Math.round(basePrice * widthSurchargeRate);

  const lowerLabel = roofType === "flattak" ? "5,0" : "6,2";
  const adjustments = [
    ...(snapDiscount > 0       ? [{ label: `Standard mål (-${discountRate * 100}%)`, amount: -snapDiscount }] : []),
    ...(widthSurchargeRate > 0 ? [{ label: `Bredde over ${widthM > 7.2 ? "7,2" : lowerLabel} m`, amount: widthAdj }] : []),
  ];

  return {
    basePrice,
    adjustments,
    totalPrice: basePrice - snapDiscount + widthAdj,
    currency: CURRENCY,
    manualQuote,
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
