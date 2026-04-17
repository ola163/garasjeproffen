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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuoteResponse | null>(null);

  const p = configuration.parameters;
  const soknadUrl = `/soknadshjelp?buildingType=garasje&lengthMm=${p.length ?? 6000}&widthMm=${p.width ?? 8400}&doorWidthMm=${p.doorWidth ?? 2500}&doorHeightMm=${p.doorHeight ?? 2125}`;

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

  if (result?.success) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
        <p className="font-semibold">Forespørselen er sendt!</p>
        <p className="mt-1">Vi tar kontakt med deg snart med et endelig tilbud.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900">Be om tilbud</h3>
      <p className="mt-1 text-sm text-gray-500">
        Fyll inn dine opplysninger, så tar vi kontakt med et endelig tilbud.
      </p>

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
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{result.error}</div>
        )}

        <button type="submit" disabled={submitting}
          className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
          {submitting ? "Sender..." : "Send tilbudsforespørsel"}
        </button>
      </form>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="text-xs text-gray-600">Trenger du hjelp med byggesøknad?{" "}
          <button type="button" onClick={() => router.push(soknadUrl)}
            className="font-medium text-orange-600 hover:text-orange-700 underline">
            Gå til søknadshjelp
          </button>
        </p>
      </div>
    </div>
  );
}
