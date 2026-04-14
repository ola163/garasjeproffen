"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GarageConfiguration, PricingResult } from "@/types/configurator";
import type { QuoteResponse } from "@/types/quote";

interface QuoteFormProps {
  configuration: GarageConfiguration;
  pricing: PricingResult;
  packageType: string;
  open: boolean;
}

export default function QuoteForm({ configuration, pricing, packageType, open }: QuoteFormProps) {
  const router = useRouter();
  const [needsPermit, setNeedsPermit] = useState<"ja" | "nei" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuoteResponse | null>(null);

  const p = configuration.parameters;
  const soknadUrl = `/soknadshjelp?lengthMm=${p.length ?? 6000}&widthMm=${p.width ?? 8400}&doorWidthMm=${p.doorWidth ?? 2500}&doorHeightMm=${p.doorHeight ?? 2125}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configuration,
          pricing,
          packageType,
          customer: { name, email, phone, message },
        }),
      });
      const data: QuoteResponse = await res.json();
      setResult(data);
      if (data.success) {
        setName(""); setEmail(""); setPhone(""); setMessage("");
      }
    } catch {
      setResult({ success: false, error: "Nettverksfeil. Vennligst prøv igjen." });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div id="quote">
      {result?.success ? (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
          Tilbudsforespørselen er sendt! Vi tar kontakt snart.
        </div>
      ) : (
        <>
          {/* Søknadshjelp question */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700">Trenger du hjelp med byggesøknad?</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setNeedsPermit("ja")}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                  needsPermit === "ja"
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 text-gray-600 hover:border-orange-300"
                }`}
              >
                Ja
              </button>
              <button
                type="button"
                onClick={() => setNeedsPermit("nei")}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
                  needsPermit === "nei"
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 text-gray-600 hover:border-orange-300"
                }`}
              >
                Nei
              </button>
            </div>

            {needsPermit === "ja" && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">
                  Vi tar deg videre til søknadshjelp med garasjekonfigurasjonen din.
                </p>
                <button
                  type="button"
                  onClick={() => router.push(soknadUrl)}
                  className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
                >
                  Gå til søknadshjelp →
                </button>
              </div>
            )}
          </div>

          {/* Show quote form only if no permit needed */}
          {needsPermit === "nei" && (
            <>
              <h3 className="mt-6 text-lg font-semibold text-gray-900">Be om tilbud</h3>
              <p className="mt-1 text-sm text-gray-500">
                Fyll inn dine opplysninger, så tar vi kontakt med et endelig tilbud.
              </p>
            </>
          )}
          {needsPermit === "nei" && (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Navn *</label>
                <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">E-post *</label>
                <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Telefon</label>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700">Melding</label>
                <textarea id="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  placeholder="Eventuelle spesielle ønsker..." />
              </div>
              {result?.error && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{result.error}</div>
              )}
              <button type="submit" disabled={submitting}
                className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
                {submitting ? "Sender..." : "Send tilbudsforespørsel"}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
