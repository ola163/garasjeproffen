"use client";

import { useState, useEffect } from "react";
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

const BUILDING_TYPES = [
  { id: "garasje", label: "Garasje" },
  { id: "carport", label: "Carport" },
  { id: "uthus", label: "Uthus" },
  { id: "næringsbygg", label: "Næringsbygg" },
];

const CATEGORIES = [
  { id: "søknadshjelp", label: "Søknadshjelp" },
  { id: "materialpakke", label: "Materialpakke" },
  { id: "prefabelement", label: "Prefabelement" },
];

function defaultCategory(packageType: string) {
  if (packageType === "prefab") return "prefabelement";
  return "materialpakke";
}

export default function QuoteForm({ configuration, pricing, packageType, roofType, addedElements, open }: QuoteFormProps) {
  const [buildingType, setBuildingType] = useState("garasje");
  const [category, setCategory] = useState(() => defaultCategory(packageType));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuoteResponse | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setIsLoggedIn(d.isLoggedIn)).catch(() => {});
  }, []);

  const p = configuration.parameters;
  const soknadUrl = `/soknadshjelp?buildingType=${buildingType}&lengthMm=${p.length ?? 6000}&widthMm=${p.width ?? 8400}&doorWidthMm=${p.doorWidth ?? 2500}&doorHeightMm=${p.doorHeight ?? 2125}&roofType=${roofType}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("data", JSON.stringify({
        configuration, pricing, packageType, roofType, addedElements,
        category, buildingType,
        customer: { name, email, phone, message },
      }));
      files.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/quote", { method: "POST", body: formData });
      const data: QuoteResponse = await res.json();
      setResult(data);
      if (data.success) {
        setName(""); setEmail(""); setPhone(""); setMessage(""); setFiles([]);
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
    <div className="space-y-5">
      {/* Building type */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Type bygg</p>
        <div className="flex flex-wrap gap-2">
          {BUILDING_TYPES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setBuildingType(id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                buildingType === id
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-gray-200 text-gray-600 hover:border-orange-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Kategori</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                category === id
                  ? "border-orange-500 bg-orange-50 text-orange-700"
                  : "border-gray-200 text-gray-600 hover:border-orange-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {category === "søknadshjelp" && (
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
            Vil du bruke søknadshjelp-assistenten vår?{" "}
            <a href={soknadUrl} className="font-medium underline hover:text-blue-900">
              Åpne søknadshjelp →
            </a>
          </div>
        )}
      </div>

      {/* Customer info */}
      <div>
        <h3 className="text-base font-semibold text-gray-900">Kontaktinfo</h3>
        <p className="mt-0.5 text-sm text-gray-500">Fyll inn dine opplysninger, så tar vi kontakt med et endelig tilbud.</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="qf-name" className="block text-sm font-medium text-gray-700">Navn *</label>
            <input id="qf-name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          <div>
            <label htmlFor="qf-email" className="block text-sm font-medium text-gray-700">E-post *</label>
            <input id="qf-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          <div>
            <label htmlFor="qf-phone" className="block text-sm font-medium text-gray-700">Telefon</label>
            <input id="qf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          <div>
            <label htmlFor="qf-message" className="block text-sm font-medium text-gray-700">Eventuelle spesielle ønsker</label>
            <textarea id="qf-message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              placeholder="Skriv inn eventuelle spesielle ønsker eller kommentarer..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Vedlegg (valgfritt)</label>
            <p className="mt-0.5 text-xs text-gray-400">Tegninger, bilder, tomtekart o.l. Maks 10 MB per fil.</p>
            {!isLoggedIn ? (
              <a href="/min-side" className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Logg inn på Min side for å legge ved filer
              </a>
            ) : (
              <>
                <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  {files.length === 0 ? "Velg filer…" : `${files.length} fil${files.length !== 1 ? "er" : ""} valgt`}
                  <input type="file" multiple accept="image/*,.pdf,.dwg,.dxf" className="sr-only"
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
                </label>
                {files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
                        <span className="truncate">{f.name}</span>
                        <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="ml-2 shrink-0 text-gray-400 hover:text-red-500">✕</button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
          {result?.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{result.error}</div>
          )}
          <button type="submit" disabled={submitting}
            className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? (files.length > 0 ? "Laster opp vedlegg…" : "Sender...") : "Send tilbudsforespørsel"}
          </button>
        </form>
      </div>
    </div>
  );
}
