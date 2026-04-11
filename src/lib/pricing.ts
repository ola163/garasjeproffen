import type { GarageConfiguration, PricingResult } from "@/types/configurator";

// Base price per meter of garage length (configurable via env)
const PRICE_PER_METER = Number(process.env.NEXT_PUBLIC_PRICE_PER_METER) || 5000;
const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "NOK";

export function calculatePrice(config: GarageConfiguration): PricingResult {
  const lengthM = (config.parameters.length ?? 6000) / 1000;
  const widthM  = (config.parameters.width  ?? 8400) / 1000;

  const basePrice = Math.round(lengthM * widthM * PRICE_PER_METER);

  return {
    basePrice,
    adjustments: [],
    totalPrice: basePrice,
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
