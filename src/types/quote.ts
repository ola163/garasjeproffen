import type { GarageConfiguration, PricingResult } from "./configurator";

export interface QuoteRequest {
  configuration: GarageConfiguration;
  pricing: PricingResult;
  customer: {
    name: string;
    email: string;
    phone: string;
    message: string;
  };
}

export interface QuoteResponse {
  success: boolean;
  quoteId?: string;
  error?: string;
}
