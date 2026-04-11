export interface GarageParameter {
  id: string;
  label: string;
  unit: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue: number;
  type: "slider" | "select" | "number";
  group: string;
  options?: { label: string; value: number }[];
}

export interface GarageConfiguration {
  parameters: Record<string, number>;
  timestamp: number;
}

export interface PricingResult {
  basePrice: number;
  adjustments: { label: string; amount: number }[];
  totalPrice: number;
  currency: string;
}
