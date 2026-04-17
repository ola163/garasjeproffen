"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GarageConfiguration, PricingResult } from "@/types/configurator";
import type { QuoteResponse } from "@/types/quote";
import type { AddedElement } from "@/components/configurator/DoorWindowAdder";

interface QuoteFormProps {
  configuration: GarageConfiguration;
  pricing: PricingResult;
  packageType: string;
  roofType: string;
  addedElements: AddedElement[];
  open: boolean;
}

export default function QuoteForm({ configuration, pricing, packageType, roofType, addedElements, open }: QuoteFormProps) {
  const router = useRouter();
  const [needsPermit, setNeedsPermit] = useState<"nei" | null>(null);
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
          roofType,
          addedElements,
          customer: { name, email, phone, message },
        }),
      });
      const data: QuoteResponse = await res.json();
      setResult(data);
      if (data.success) {
        setName(""); setEmail(""); setPhone("");
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
      {/* Søknadshjelp question */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-700">Trenger du hjelp med byggesøknad?</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => router.push(soknadUrl)}
            className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:border-orange-300 transition-all"
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
      </div>

      {/* Quote form — shown when no permit needed */}
      {needsPermit === "nei" && (
        <>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">Be om tilbud</h3>
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
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">Eventuelle spesielle ønsker</label>
              <textarea id="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="Skriv inn eventuelle spesielle ønsker eller kommentarer..." />
            </div>
            {result?.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{result.error}</div>
            )}
            <button type="submit" disabled={submitting}
              className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? "Sender..." : "Send tilbudsforespørsel"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
