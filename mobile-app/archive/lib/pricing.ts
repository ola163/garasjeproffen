export type PackageType = "materialpakke" | "prefab";
export type RoofType = "saltak" | "flattak";
export type BuildingType = "garasje" | "carport";

export interface PricingResult {
  basePrice: number;
  adjustments: { label: string; amount: number }[];
  totalPrice: number;
  currency: string;
  manualQuote?: boolean;
}

const PRICE_PER_SQM: Record<RoofType, Record<PackageType, number>> = {
  saltak:  { materialpakke: 4125, prefab: 7700 },
  flattak: { materialpakke: 3850, prefab: 7150 },
};

const CARPORT_PRICE_PER_SQM: Record<PackageType, number> = {
  materialpakke: 3500,
  prefab: 6500,
};

export function calculatePrice(
  lengthMm: number,
  widthMm: number,
  packageType: PackageType,
  roofType: RoofType,
  buildingType: BuildingType,
): PricingResult {
  const isCarport   = buildingType === "carport";
  const pricePerSqm = isCarport ? CARPORT_PRICE_PER_SQM[packageType] : PRICE_PER_SQM[roofType][packageType];
  const basePrice   = Math.round((lengthMm / 1000) * (widthMm / 1000) * pricePerSqm);

  const widthSnapped  = !isCarport && (widthMm - 200) % 600 === 0;
  const lengthSnapped = !isCarport && lengthMm % 600 === 0;
  const snappedCount  = (widthSnapped ? 1 : 0) + (lengthSnapped ? 1 : 0);
  const discountRate  = snappedCount === 2 ? 0.10 : snappedCount === 1 ? 0.05 : 0;
  const snapDiscount  = Math.round(basePrice * discountRate);

  const sqm         = (lengthMm / 1000) * (widthMm / 1000);
  const areaManual  = sqm > 70;
  const widthM      = widthMm / 1000;
  const widthManual = widthM > 8.0;

  const lowerThreshold     = roofType === "flattak" ? 5.0 : 6.2;
  const widthSurchargeRate = !widthManual && widthM > 7.2 ? 0.10 : !widthManual && widthM > lowerThreshold ? 0.05 : 0;
  const widthAdj           = Math.round(basePrice * widthSurchargeRate);
  const lowerLabel         = roofType === "flattak" ? "5,0" : "6,2";

  const adjustments = [
    ...(snapDiscount > 0       ? [{ label: `Standard mål (-${discountRate * 100}%)`, amount: -snapDiscount }] : []),
    ...(widthSurchargeRate > 0 ? [{ label: `Bredde over ${widthM > 7.2 ? "7,2" : lowerLabel} m`, amount: widthAdj }] : []),
  ];

  return {
    basePrice,
    adjustments,
    totalPrice: basePrice - snapDiscount + widthAdj,
    currency: "NOK",
    manualQuote: areaManual || widthManual,
  };
}

export function formatPrice(amount: number): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "NOK",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
