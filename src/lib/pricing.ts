import type { GarageConfiguration, PricingResult } from "@/types/configurator";

const PRICE_PER_SQM = 5500;
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "NOK";

// Door cost by width in mm
const DOOR_COST: Record<number, number> = {
  2500: 20_000,
  2600: 20_000,
  5000: 40_000,
};

export function calculatePrice(config: GarageConfiguration): PricingResult {
  const lengthM     = (config.parameters.length    ?? 6000) / 1000;
  const widthM      = (config.parameters.width     ?? 8400) / 1000;
  const doorWidthMm =  config.parameters.doorWidth ?? 2500;

  const basePrice = Math.round(lengthM * widthM * PRICE_PER_SQM);
  const doorCost  = DOOR_COST[doorWidthMm] ?? 20_000;

  return {
    basePrice,
    adjustments: [{ label: "Garasjeport", amount: doorCost }],
    totalPrice: basePrice + doorCost,
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
