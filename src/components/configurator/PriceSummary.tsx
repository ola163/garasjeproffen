"use client";

import type { PricingResult } from "@/types/configurator";
import { formatPrice } from "@/lib/pricing";

interface PriceSummaryProps {
  pricing: PricingResult;
  message: string;
  onMessageChange: (v: string) => void;
  onQuoteOpen: () => void;
}

export default function PriceSummary({ pricing, message, onMessageChange, onQuoteOpen }: PriceSummaryProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <h3 className="text-sm font-semibold text-gray-900">Prisestimat</h3>

      <div className="mt-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Grunnpris</span>
          <span className="text-gray-900">{formatPrice(pricing.basePrice, pricing.currency)}</span>
        </div>

        {pricing.adjustments.map((adj) => (
          <div key={adj.label} className="flex justify-between text-sm">
            <span className="text-gray-600">{adj.label}</span>
            <span className="text-gray-900">{formatPrice(adj.amount, pricing.currency)}</span>
          </div>
        ))}

        <div className="border-t border-gray-200 pt-2">
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-gray-900">Totalt</span>
            <span className="text-lg font-bold text-orange-500">
              {formatPrice(pricing.totalPrice, pricing.currency)}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-400">* Estimert pris. Endelig tilbud kan variere.</p>

      <div className="mt-4">
        <label htmlFor="customer-message" className="block text-xs font-medium text-gray-600 mb-1">
          Eventuelle spesielle ønsker
        </label>
        <textarea
          id="customer-message"
          rows={3}
          value={message}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder="Skriv inn eventuelle spesielle ønsker eller kommentarer..."
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
      </div>

      <button
        onClick={onQuoteOpen}
        className="mt-4 block w-full rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-orange-600"
      >
        Be om tilbud
      </button>
    </div>
  );
}
