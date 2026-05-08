"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { GarageConfiguration, PricingResult } from "@/types/configurator";
import type { QuoteResponse } from "@/types/quote";
import type { AddedElement } from "@/components/configurator/DoorWindowAdder";
import type { GrunnarbeidData } from "@/components/configurator/GrunnarbeidWizard";
import GarageMapbox from "@/components/configurator/GarageMapbox";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

interface QuoteFormProps {
  configuration: GarageConfiguration;
  pricing: PricingResult;
  packageType: string;
  roofType: string;
  addedElements: AddedElement[];
  grunnarbeid?: GrunnarbeidData;
  open: boolean;
  address?: string;
  mapCenter?: [number, number] | null;
  mapRotation?: number;
}

const BUILDING_TYPES = [
  { id: "garasje", label: "Garasje" },
  { id: "carport", label: "Carport" },
  { id: "uthus", label: "Uthus" },
  { id: "næringsbygg", label: "Næringsbygg" },
];

const CATEGORIES = [
  { id: "materialpakke", label: "Materialpakke" },
  { id: "prefabelement", label: "Prefabelement" },
];

function defaultCategory(packageType: string) {
  if (packageType === "prefab") return "prefabelement";
  return "materialpakke";
}

export default function QuoteForm({ configuration, pricing, packageType, roofType, addedElements, grunnarbeid, open, address, mapCenter, mapRotation }: QuoteFormProps) {
  const [step, setStep] = useState<"soknad" | "address" | "kart" | "form">("soknad");

  // Address step state — pre-fill from map placement if available
  const [addressQuery, setAddressQuery] = useState(address ?? "");
  const [addressSuggestions, setAddressSuggestions] = useState<{ place_name: string; id: string }[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(address ?? null);
  const [detectingPos, setDetectingPos] = useState(false);
  const [addressSearching, setAddressSearching] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Local map placement (captured in the "kart" step, overrides prop)
  const [localMapCenter, setLocalMapCenter]   = useState<[number, number] | null>(null);
  const [localMapRotation, setLocalMapRotation] = useState(0);
  const [localMapAddress, setLocalMapAddress]   = useState<string | null>(null);

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setIsLoggedIn(d.isLoggedIn)).catch(() => {});
    setMounted(true);
  }, []);

  // Resolved coordinates: local placement (from kart step) takes priority over prop
  const resolvedCenter   = localMapCenter   ?? mapCenter   ?? null;
  const resolvedRotation = localMapRotation !== 0 ? localMapRotation : (mapRotation ?? 0);
  const hasPlacement     = resolvedCenter !== null;

  async function searchAddress(q: string) {
    if (!q.trim()) { setAddressSuggestions([]); return; }
    setAddressSearching(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=no&types=address,place&language=no&limit=6`;
      const res = await fetch(url);
      const data = await res.json();
      setAddressSuggestions(data.features ?? []);
    } catch { /* ignore */ } finally {
      setAddressSearching(false);
    }
  }

  function handleAddressInput(q: string) {
    setAddressQuery(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchAddress(q), 300);
  }

  function pickAddress(name: string) {
    setSelectedAddress(name);
    setAddressQuery(name);
    setAddressSuggestions([]);
    try { localStorage.setItem("gp-map-address", name); } catch { /* ignore */ }
  }

  async function detectPosition() {
    if (!navigator.geolocation) return;
    setDetectingPos(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address,place&language=no&country=no&access_token=${MAPBOX_TOKEN}`
          );
          const data = await res.json();
          pickAddress(data.features?.[0]?.place_name ?? "Min posisjon");
        } catch {
          pickAddress("Min posisjon");
        } finally {
          setDetectingPos(false);
        }
      },
      () => setDetectingPos(false),
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  const p = configuration.parameters;
  const soknadUrl = `/soknadshjelp?buildingType=${buildingType}&lengthMm=${p.length ?? 6000}&widthMm=${p.width ?? 8400}&doorWidthMm=${p.doorWidth ?? 2500}&doorHeightMm=${p.doorHeight ?? 2125}&roofType=${roofType}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const formData = new FormData();
      const resolvedAddress = selectedAddress ?? localMapAddress ?? address ?? null;
      formData.append("data", JSON.stringify({
        configuration, pricing, packageType, roofType, addedElements, grunnarbeid,
        category, buildingType,
        address: resolvedAddress,
        mapCenter: resolvedCenter,
        mapRotation: resolvedRotation,
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

  // ── "Kart"-step: full-screen portal map for garage placement ──
  if (step === "kart" && mounted) {
    const mapName = buildingType === "carport" ? "carporten" : buildingType === "uthus" ? "uthuset" : "garasjen";
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex flex-col bg-white">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shadow-sm shrink-0">
          <button
            type="button"
            onClick={() => setStep("soknad")}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Tilbake
          </button>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">Plasser {mapName} på tomten</p>
            <p className="text-xs text-gray-400">Klikk i kartet for å plassere, dra for å flytte</p>
          </div>
          <button
            type="button"
            onClick={() => setStep("form")}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Hopp over
          </button>
          <button
            type="button"
            onClick={() => setStep("form")}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              localMapCenter
                ? "bg-orange-500 text-white hover:bg-orange-600 shadow"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
            disabled={!localMapCenter}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {localMapCenter ? "Bekreft plassering" : "Plasser for å bekrefte"}
          </button>
        </div>

        {/* Map */}
        <div className="flex-1 overflow-hidden">
          <GarageMapbox
            widthMm={p.width ?? 5000}
            lengthMm={p.length ?? 6000}
            roofType={roofType as "saltak" | "flattak"}
            buildingType={buildingType as "garasje" | "carport"}
            externalCenter={localMapCenter}
            externalRotation={localMapRotation}
            onCenterChange={setLocalMapCenter}
            onRotationChange={setLocalMapRotation}
            onAddressSelect={(addr) => setLocalMapAddress(addr)}
            showNeighbors
            showCadastralToggle
            defaultShowCadastral
            defaultCenter={localMapCenter ?? mapCenter ?? undefined}
          />
        </div>

        {/* Bottom hint when placed */}
        {localMapCenter && (
          <div className="shrink-0 px-4 py-2.5 bg-green-50 border-t border-green-200 text-xs text-green-800 flex items-center gap-2">
            <svg className="h-4 w-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>
              {localMapAddress ? <strong>{localMapAddress}</strong> : `${localMapCenter[1].toFixed(5)}, ${localMapCenter[0].toFixed(5)}`}
              {" "}· Vinkel {localMapRotation}°
            </span>
          </div>
        )}
      </div>,
      document.body,
    );
  }

  if (step === "soknad") {
    return (
      <div className="space-y-4">
        {selectedAddress && (
          <div className="flex items-center gap-2.5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
            <svg className="h-4 w-4 shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{selectedAddress}</span>
          </div>
        )}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
          <p className="text-sm font-semibold text-gray-900">Trenger du hjelp med byggesøknaden?</p>
          <p className="mt-1 text-sm text-gray-500">
            Vi kan ta hele søknadsprosessen for deg — tegninger, nabovarsel og innlevering til kommunen.
          </p>
          <button
            type="button"
            onClick={() => {
              const knownAddress = localMapAddress ?? selectedAddress ?? address ?? null;
              if (knownAddress) {
                // Already have address from map placement or prop — go straight to søknadshjelp
                window.location.href = soknadUrl;
              } else {
                setStep("address");
              }
            }}
            className="mt-4 flex w-full items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors"
          >
            <span>Ja, jeg trenger søknadshjelp</span>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setStep(hasPlacement ? "form" : "kart")}
            className="mt-2 flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>Nei, bare be om tilbud</span>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (step === "address") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setStep("soknad")}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Tilbake
        </button>

        <div>
          <p className="text-sm font-semibold text-gray-900">Hva er adressen til tomten?</p>
          <p className="mt-1 text-sm text-gray-500">Vi bruker dette til å forberede søknaden.</p>
        </div>

        {/* Auto-detect */}
        <button
          type="button"
          onClick={detectPosition}
          disabled={detectingPos}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <svg className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {detectingPos ? "Finner posisjon…" : "Finn min posisjon automatisk"}
        </button>

        <div className="flex items-center gap-2">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400">eller skriv inn</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        {/* Address input */}
        {selectedAddress ? (
          <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
            <svg className="h-4 w-4 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="flex-1 text-sm text-gray-800 leading-snug">{selectedAddress}</span>
            <button
              type="button"
              onClick={() => { setSelectedAddress(null); setAddressQuery(""); }}
              className="shrink-0 text-sm font-medium text-orange-600 hover:underline"
            >
              Endre
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              type="text"
              value={addressQuery}
              onChange={(e) => handleAddressInput(e.target.value)}
              placeholder="F.eks. Storgata 1, Bryne"
              autoFocus
              className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
            {addressSearching && (
              <div className="absolute right-3 top-2.5">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
              </div>
            )}
            {addressSuggestions.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                {addressSuggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => pickAddress(s.place_name)}
                      className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 first:rounded-t-lg last:rounded-b-lg transition-colors"
                    >
                      {s.place_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={!selectedAddress}
          onClick={() => { window.location.href = soknadUrl; }}
          className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          Fortsett til søknadshjelp →
        </button>
      </div>
    );
  }

  if (result?.success) {
    return (
      <div className="rounded-xl border border-green-100 bg-green-50 p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500">
            <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-green-900">Forespørselen er sendt!</p>
            <p className="mt-1 text-sm text-green-800">Vi tar kontakt så snart som mulig.</p>
          </div>
        </div>
        <div className="mt-5 border-t border-green-100 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Hva skjer nå?</p>
          <ol className="mt-3 space-y-2">
            {[
              "Vi gjennomgår konfigurasjonen og prisestimatet ditt",
              "Christian eller Ola tar kontakt – som regel innen noen timer",
              "Vi sender et konkret tilbud tilpasset din tomt og dine ønsker",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-green-200 text-[10px] font-bold text-green-800">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-4 text-xs text-green-700">
          Haster det? Ring oss på{" "}
          <a href="tel:+4747617563" className="font-semibold underline">+47 476 17 563</a>.
        </p>
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
      </div>

      {/* Placement summary — show resolved placement + option to change */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Tomteplassering</p>
          <button
            type="button"
            onClick={() => { setLocalMapCenter(null); setLocalMapRotation(0); setStep("kart"); }}
            className="text-xs font-medium text-orange-600 hover:underline"
          >
            {hasPlacement ? "Endre" : "Plasser på kart"}
          </button>
        </div>
        {hasPlacement ? (
          <div className="space-y-1">
            {(localMapAddress ?? selectedAddress ?? address) && (
              <div className="flex items-start gap-2 text-sm text-gray-800">
                <svg className="h-4 w-4 shrink-0 mt-0.5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{localMapAddress ?? selectedAddress ?? address}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Koordinater: {resolvedCenter![1].toFixed(6)}, {resolvedCenter![0].toFixed(6)}</span>
              <span>· Vinkel: {resolvedRotation}°</span>
              <a
                href={`https://www.google.com/maps?q=${resolvedCenter![1]},${resolvedCenter![0]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-600 hover:underline"
              >
                Kart ↗
              </a>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setStep("kart")}
            className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Vis garasjen på tomten din
          </button>
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
