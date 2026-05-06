"use client";

import type { PricingResult } from "@/types/configurator";
import { formatPrice } from "@/lib/pricing";

interface PriceSummaryProps {
  pricing: PricingResult;
  onQuoteOpen: () => void;
  adminContent?: React.ReactNode;
}

export default function PriceSummary({ pricing, onQuoteOpen, adminContent }: PriceSummaryProps) {
  if (pricing.manualQuote) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Prisestimat</h3>
        <p className="mt-3 text-sm text-gray-500">
          Dimensjonene du har valgt krever et <strong className="text-gray-800">manuelt tilbud</strong>. Send en forespørsel så kontakter vi deg.
        </p>
        {adminContent && <div className="mt-3">{adminContent}</div>}
        <button
          onClick={onQuoteOpen}
          className="mt-4 block w-full rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-orange-600"
        >
          Be om tilbud
        </button>
      </div>
    );
  }

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
            <span className={`${adj.amount < 0 ? "text-green-600" : "text-gray-900"}`}>{formatPrice(adj.amount, pricing.currency)}</span>
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

      {adminContent && <div className="mt-3">{adminContent}</div>}

      <button
        onClick={onQuoteOpen}
        className="mt-4 block w-full rounded-lg bg-orange-500 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-orange-600"
      >
        Be om tilbud
      </button>
    </div>
  );
}
