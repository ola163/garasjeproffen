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

  const isCarport   = buildingType === "carport";
  const pricePerSqm = isCarport ? CARPORT_PRICE_PER_SQM[packageType] : PRICE_PER_SQM[roofType][packageType];
  const basePrice   = Math.round((lengthMm / 1000) * (widthMm / 1000) * pricePerSqm);

  // Snap discount (garage only)
  const widthSnapped  = !isCarport && (widthMm - 200) % 600 === 0;
  const lengthSnapped = !isCarport && lengthMm % 600 === 0;
  const snappedCount  = (widthSnapped ? 1 : 0) + (lengthSnapped ? 1 : 0);
  const discountRate  = snappedCount === 2 ? 0.10 : snappedCount === 1 ? 0.05 : 0;
  const snapDiscount  = Math.round(basePrice * discountRate);

  // Area surcharge
  const sqm        = (lengthMm / 1000) * (widthMm / 1000);
  const areaManual = sqm > 70;
  const areaSurchargeRate = !areaManual && sqm > 55 ? 0.10 : !areaManual && sqm > 40 ? 0.05 : 0;

  // Width surcharge
  const widthM = widthMm / 1000;
  const widthManual = widthM > 8.0;
  const widthSurchargeRate = !widthManual && widthM > 7.2 ? 0.10 : !widthManual && widthM > 6.2 ? 0.05 : 0;

  const manualQuote = areaManual || widthManual;
  const areaAdj     = Math.round(basePrice * areaSurchargeRate);
  const widthAdj    = Math.round(basePrice * widthSurchargeRate);

  const adjustments = [
    ...(snapDiscount > 0       ? [{ label: `Standard mål (-${discountRate * 100}%)`, amount: -snapDiscount }] : []),
    ...(areaSurchargeRate > 0  ? [{ label: `Areal over ${sqm > 55 ? "55" : "40"} m² (+${areaSurchargeRate * 100}%)`, amount: areaAdj }] : []),
    ...(widthSurchargeRate > 0 ? [{ label: `Bredde over ${widthM > 7.2 ? "7,2" : "6,2"} m (+${widthSurchargeRate * 100}%)`, amount: widthAdj }] : []),
  ];

  return {
    basePrice,
    adjustments,
    totalPrice: basePrice - snapDiscount + areaAdj + widthAdj,
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
