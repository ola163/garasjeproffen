"use client";

import type { PricingResult } from "@/types/configurator";
import { formatPrice } from "@/lib/pricing";

interface SoknadshjelpItem {
  key: string;
  label: string;
  price: number;
}

interface PriceSummaryProps {
  pricing: PricingResult;
  onQuoteOpen: () => void;
  adminContent?: React.ReactNode;
  soknadshjelp?: SoknadshjelpItem[];
}

export default function PriceSummary({ pricing, onQuoteOpen, adminContent, soknadshjelp }: PriceSummaryProps) {
  const mandatoryKeys = ["tegning", "nabovarsel"];
  const mandatory = soknadshjelp?.filter(p => mandatoryKeys.includes(p.key)) ?? [];
  const infoItems  = soknadshjelp?.filter(p => !mandatoryKeys.includes(p.key)) ?? [];
  const soknadsTotal = mandatory.reduce((s, p) => s + p.price, 0);
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
          <div key={adj.label}>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{adj.label}</span>
              <span className={`${adj.amount < 0 ? "text-green-600" : "text-gray-900"}`}>{formatPrice(adj.amount, pricing.currency)}</span>
            </div>
            {adj.label.startsWith("Bredde over") && (
              <p className="mt-0.5 text-xs text-gray-400 italic">Større spenn krever kraftigere bjelker og dimensjonering.</p>
            )}
          </div>
        ))}

        <div className="border-t border-gray-200 pt-2">
          <div className="flex justify-between">
            <span className="text-sm font-semibold text-gray-900">Totalt</span>
            <span className={`text-lg font-bold ${soknadshjelp ? "text-gray-700" : "text-orange-500"}`}>
              {formatPrice(pricing.totalPrice, pricing.currency)}
            </span>
          </div>
        </div>

        {soknadshjelp && mandatory.length > 0 && (
          <div className="border-t border-blue-100 bg-blue-50 -mx-4 px-4 pt-3 pb-2 mt-2 rounded-b-lg">
            <p className="text-xs font-semibold text-blue-700 mb-2">Søknadshjelp (krav over 50 m²)</p>
            {mandatory.map(p => (
              <div key={p.key} className="flex justify-between text-sm">
                <span className="text-gray-600">{p.label}</span>
                <span className="text-gray-800">{formatPrice(p.price, pricing.currency)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm font-semibold mt-1.5 pt-1.5 border-t border-blue-200">
              <span className="text-gray-700">Søknadshjelp totalt</span>
              <span className="text-gray-800">{formatPrice(soknadsTotal, pricing.currency)}</span>
            </div>
            {infoItems.length > 0 && (
              <p className="mt-2 text-xs text-gray-400 italic">
                {infoItems.map(p => p.label).join(" · ")} — pris avhenger av behov
              </p>
            )}
            <div className="flex justify-between text-sm font-bold mt-2 pt-2 border-t border-blue-200">
              <span className="text-gray-900">Estimert totalt</span>
              <span className="text-orange-500">{formatPrice(pricing.totalPrice + soknadsTotal, pricing.currency)}</span>
            </div>
          </div>
        )}
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
