"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

const MapPicker = dynamic(() => import("./MapPicker"), { ssr: false });
const GaragePlacementMap = dynamic(() => import("./GaragePlacementMap"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GarageConfig {
  lengthMm: number;
  widthMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
  roofType?: "saltak" | "flattak";
}

const WALL_H = 3.0;
const ROOF_ANGLE = 22 * (Math.PI / 180);

function calcMonehoyde(widthMm: number, roofType?: string) {
  const widthM = widthMm / 1000;
  if (roofType === "flattak") return WALL_H;
  return WALL_H + (widthM / 2) * Math.tan(ROOF_ANGLE);
}

function autoFillDibk(g: GarageConfig): Partial<DibkAnswers> {
  const bya = (g.widthMm / 1000) * (g.lengthMm / 1000);
  const mone = calcMonehoyde(g.widthMm, g.roofType);
  return {
    bya50:     bya  <= 50 ? "Ja" : "Nei",
    enEtasje:  "Ja",
    monehoyde: mone <= 4  ? "Ja" : "Nei",
  };
}

type BuildingType =
  | "garasje"
  | "hagestue"
  | "verksted"
  | "pergola"
  | "hytte";

interface DibkAnswers {
  frittstående: string;
  bya50: string;
  enEtasje: string;
  monehoyde: string;
  nabogrense: string;
  avstandBygg: string;
  ikkeVernet: string;
  ikkeFlom: string;
  lnf: string;
  kjeller: string;
}

const defaultDibk: DibkAnswers = {
  frittstående: "",
  bya50: "",
  enEtasje: "",
  monehoyde: "",
  nabogrense: "",
  avstandBygg: "",
  ikkeVernet: "",
  ikkeFlom: "",
  lnf: "",
  kjeller: "",
};

// ── Permit logic ──────────────────────────────────────────────────────────────
type PermitResult = "søknadsfri" | "søknad" | "usikkert";

const SØKNAD_KEYS: (keyof DibkAnswers)[] = [
  "frittstående", "bya50", "enEtasje", "monehoyde",
  "nabogrense", "avstandBygg", "ikkeVernet", "ikkeFlom",
];

function countDisp(d: DibkAnswers): number {
  return (d.lnf === "Ja" ? 1 : 0) + SØKNAD_KEYS.filter((k) => d[k] === "Nei").length;
}

function permitResult(d: DibkAnswers): PermitResult {
  if (SØKNAD_KEYS.some((k) => d[k] === "Nei") || d.lnf === "Ja" || d.kjeller === "Ja") return "søknad";
  if (Object.values(d).some((v) => v === "" || v === "Vet ikke")) return "usikkert";
  return "søknadsfri";
}

// ── Pricing ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency", currency: "NOK",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function permitCost(d: DibkAnswers): number {
  const result = permitResult(d);
  if (result === "søknadsfri") return 0;
  const disp = countDisp(d);
  return disp > 0 ? 10_000 + Math.max(0, disp - 1) * 5_000 : 8_000;
}

function buildingCost(g: GarageConfig) {
  const sqm = (g.widthMm / 1000) * (g.lengthMm / 1000);
  const build = Math.round(sqm * 5500);
  const door = g.doorWidthMm >= 4000 ? 40_000 : 20_000;
  return { build, door, sqm };
}

// ── Building type data ────────────────────────────────────────────────────────
const BUILDING_TYPES: { id: BuildingType; label: string; sub: string; svg: React.ReactNode }[] = [
  {
    id: "garasje",
    label: "Garasje eller carport",
    sub: "For bil, MC eller båt",
    svg: (
      <svg viewBox="0 0 80 60" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4" y="28" width="72" height="28" rx="1" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1.5"/>
        <polygon points="4,28 40,6 76,28" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1.5"/>
        <rect x="14" y="34" width="52" height="22" rx="1" fill="#fff" stroke="#d1d5db" strokeWidth="1"/>
        <line x1="14" y1="39" x2="66" y2="39" stroke="#e5e7eb" strokeWidth="1"/>
        <line x1="14" y1="44" x2="66" y2="44" stroke="#e5e7eb" strokeWidth="1"/>
        <line x1="14" y1="49" x2="66" y2="49" stroke="#e5e7eb" strokeWidth="1"/>
        <line x1="40" y1="34" x2="40" y2="56" stroke="#e5e7eb" strokeWidth="1"/>
      </svg>
    ),
  },
  {
    id: "hagestue",
    label: "Hagestue, bod eller drivhus",
    sub: "Fritidsrom eller lagringsplass",
    svg: (
      <svg viewBox="0 0 80 60" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="28" width="64" height="28" rx="1" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1.5"/>
        <polygon points="8,28 40,6 72,28" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1.5"/>
        <rect x="28" y="38" width="24" height="18" rx="1" fill="#fff" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="14" y="34" width="14" height="12" rx="1" fill="#bae6fd" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="52" y="34" width="14" height="12" rx="1" fill="#bae6fd" stroke="#d1d5db" strokeWidth="1"/>
        <line x1="21" y1="34" x2="21" y2="46" stroke="#d1d5db" strokeWidth="0.8"/>
        <line x1="14" y1="40" x2="28" y2="40" stroke="#d1d5db" strokeWidth="0.8"/>
        <line x1="59" y1="34" x2="59" y2="46" stroke="#d1d5db" strokeWidth="0.8"/>
        <line x1="52" y1="40" x2="66" y2="40" stroke="#d1d5db" strokeWidth="0.8"/>
      </svg>
    ),
  },
  {
    id: "verksted",
    label: "Verksted, atelier eller kontor",
    sub: "Arbeidsrom utenfor hjemmet",
    svg: (
      <svg viewBox="0 0 80 60" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="20" width="68" height="36" rx="1" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1.5"/>
        <rect x="6" y="20" width="68" height="8" rx="1" fill="#d1d5db"/>
        <rect x="28" y="38" width="24" height="18" rx="1" fill="#fff" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="12" y="28" width="16" height="14" rx="1" fill="#bae6fd" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="52" y="28" width="16" height="14" rx="1" fill="#bae6fd" stroke="#d1d5db" strokeWidth="1"/>
        <line x1="20" y1="28" x2="20" y2="42" stroke="#d1d5db" strokeWidth="0.8"/>
        <line x1="12" y1="35" x2="28" y2="35" stroke="#d1d5db" strokeWidth="0.8"/>
        <line x1="60" y1="28" x2="60" y2="42" stroke="#d1d5db" strokeWidth="0.8"/>
        <line x1="52" y1="35" x2="68" y2="35" stroke="#d1d5db" strokeWidth="0.8"/>
      </svg>
    ),
  },
  {
    id: "pergola",
    label: "Frittliggende pergola",
    sub: "Åpen uteplass eller terrassetak",
    svg: (
      <svg viewBox="0 0 80 60" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="22" width="68" height="4" rx="1" fill="#d1d5db" stroke="#d1d5db" strokeWidth="1"/>
        {[12, 22, 32, 42, 52, 62].map((x, i) => (
          <rect key={i} x={x} y="22" width="4" height="4" fill="#9ca3af"/>
        ))}
        {[12, 22, 32, 42, 52, 62].map((x, i) => (
          <rect key={i} x={x + 1} y="26" width="2" height="30" fill="#d1d5db"/>
        ))}
        <rect x="10" y="22" width="4" height="34" rx="1" fill="#d1d5db"/>
        <rect x="66" y="22" width="4" height="34" rx="1" fill="#d1d5db"/>
        <rect x="10" y="52" width="60" height="3" rx="1" fill="#e5e7eb"/>
      </svg>
    ),
  },
  {
    id: "hytte",
    label: "Hytte, fritidsbolig eller anneks",
    sub: "Separat boenhet eller fritidshus",
    svg: (
      <svg viewBox="0 0 80 60" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="30" width="64" height="26" rx="1" fill="#e5e7eb" stroke="#d1d5db" strokeWidth="1.5"/>
        <polygon points="4,30 40,4 76,30" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1.5"/>
        <rect x="30" y="40" width="20" height="16" rx="1" fill="#fff" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="12" y="36" width="14" height="12" rx="1" fill="#bae6fd" stroke="#d1d5db" strokeWidth="1"/>
        <rect x="54" y="36" width="14" height="12" rx="1" fill="#bae6fd" stroke="#d1d5db" strokeWidth="1"/>
        <line x1="19" y1="36" x2="19" y2="48" stroke="#d1d5db" strokeWidth="0.8"/>
        <line x1="12" y1="42" x2="26" y2="42" stroke="#d1d5db" strokeWidth="0.8"/>
        <line x1="61" y1="36" x2="61" y2="48" stroke="#d1d5db" strokeWidth="0.8"/>
        <line x1="54" y1="42" x2="68" y2="42" stroke="#d1d5db" strokeWidth="0.8"/>
        <rect x="36" y="14" width="8" height="6" rx="1" fill="#bae6fd" stroke="#d1d5db" strokeWidth="0.8"/>
      </svg>
    ),
  },
];

// ── Shared UI ─────────────────────────────────────────────────────────────────
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm transition-all
        ${active ? "border-orange-500 bg-orange-50 font-medium text-orange-700" : "border-gray-200 text-gray-600 hover:border-orange-300"}`}>
      {label}
    </button>
  );
}

function PermitBanner({ result }: { result: PermitResult }) {
  if (result === "søknadsfri") return (
    <div className="rounded-xl bg-green-50 border border-green-200 p-4">
      <p className="font-semibold text-green-800">✓ Bygningen kan trolig bygges uten søknad</p>
      <p className="mt-1 text-xs text-green-700">
        Basert på svarene ser dette ut til å være søknadsfritt etter pbl. § 20-5.
        Vi anbefaler å bekrefte med kommunen.
      </p>
    </div>
  );
  if (result === "søknad") return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4">
      <p className="font-semibold text-red-800">⚠ Byggesøknad er trolig nødvendig</p>
      <p className="mt-1 text-xs text-red-700">
        Ett eller flere krav for søknadsfri bygning er ikke oppfylt. Vi hjelper deg gjerne.
      </p>
    </div>
  );
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
      <p className="font-semibold text-amber-800">? Vi anbefaler å avklare med kommunen</p>
      <p className="mt-1 text-xs text-amber-700">
        Du har svart «Vet ikke» på ett eller flere punkter. Ta kontakt med kommunen eller oss.
      </p>
    </div>
  );
}

// ── Step bar ──────────────────────────────────────────────────────────────────
const STEPS_FULL   = ["Velg type", "Finn tomt", "Søknadskrav", "Tegninger", "Prisestimat"];
const STEPS_SKIP   = ["Finn tomt", "Søknadskrav", "Tegninger", "Prisestimat"];

function StepBar({ step, skipType }: { step: number; skipType: boolean }) {
  const steps = skipType ? STEPS_SKIP : STEPS_FULL;
  const displayStep = skipType ? step - 1 : step;
  return (
    <div className="flex flex-wrap items-center gap-1 mb-8">
      {steps.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold
            ${i <= displayStep ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400"}`}>
            {i < displayStep ? "✓" : i + 1}
          </div>
          <span className={`text-xs sm:text-sm ${i === displayStep ? "font-medium text-gray-900" : "text-gray-400"}`}>
            {label}
          </span>
          {i < steps.length - 1 && <div className="mx-1 h-px w-4 bg-gray-200" />}
        </div>
      ))}
    </div>
  );
}

// ── Step 0: Building type ─────────────────────────────────────────────────────
function StepBuildingType({ selected, onNext }: {
  selected: BuildingType | null;
  onNext: (type: BuildingType) => void;
}) {
  const [current, setCurrent] = useState<BuildingType | null>(selected);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Hva skal du bygge?</h2>
      <p className="mt-1 text-sm text-gray-500">Velg bygningstype for å få riktig søknadsveiledning.</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {BUILDING_TYPES.map((bt) => (
          <button
            key={bt.id}
            onClick={() => setCurrent(bt.id)}
            className={`flex flex-col items-center rounded-xl border p-4 text-center transition-all ${
              current === bt.id
                ? "border-orange-500 bg-orange-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-orange-300 hover:shadow-sm"
            }`}
          >
            <div className="h-16 w-full mb-3">{bt.svg}</div>
            <p className={`text-xs font-semibold leading-tight ${current === bt.id ? "text-orange-700" : "text-gray-800"}`}>
              {bt.label}
            </p>
            <p className="mt-0.5 text-xs text-gray-400 hidden sm:block">{bt.sub}</p>
          </button>
        ))}
      </div>
      <button
        onClick={() => current && onNext(current)}
        disabled={!current}
        className="mt-6 w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Gå videre →
      </button>
    </div>
  );
}

// ── Step 1: Map ───────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

function StepMap({ onNext, onBack, garageConfig }: {
  onNext: (lat: number, lng: number, address: string) => void;
  onBack: () => void;
  garageConfig?: GarageConfig;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ place_name: string; center: [number, number] }[]>([]);
  const [searching, setSearching] = useState(false);
  const [lat, setLat] = useState(58.7441);
  const [lng, setLng] = useState(5.5339);
  const [address, setAddress] = useState("");
  const [boundary, setBoundary] = useState<[number, number][] | undefined>();
  const [detectingPos, setDetectingPos] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchSuggestions(q: string) {
    if (!q.trim()) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=no&types=address,place&language=no&limit=6`;
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.features ?? []);
    } finally {
      setSearching(false);
    }
  }

  function handleQueryChange(v: string) {
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 300);
  }

  async function pickAddress(placeName: string, center: [number, number]) {
    const [pLng, pLat] = center;
    setQuery(placeName);
    setAddress(placeName);
    setLat(pLat);
    setLng(pLng);
    setSuggestions([]);
    setBoundary(undefined);
    try {
      const res = await fetch(`/api/tomtegrenser?lat=${pLat}&lng=${pLng}`);
      if (!res.ok) return;
      const data = await res.json();
      const coords = data?.teiger?.[0]?.geometri?.coordinates?.[0] as [number, number][] | undefined;
      if (coords?.length) {
        // GeoJSON is [lng, lat] – Leaflet needs [lat, lng]
        setBoundary(coords.map(([cLng, cLat]) => [cLat, cLng]));
      }
    } catch { /* boundary optional */ }
  }

  async function detectPosition() {
    if (!navigator.geolocation) { setGeoError("Nettleseren støtter ikke posisjonstjenester."); return; }
    setDetectingPos(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        let name = "Min posisjon";
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(
            `https://ws.geonorge.no/adresser/v1/punktsok?lat=${lat}&lon=${lng}&radius=100&utkoordsys=4258&treffPerSide=1`,
            { signal: ctrl.signal },
          );
          clearTimeout(t);
          const data = await res.json();
          const a = data.adresser?.[0];
          if (a?.adressetekst) {
            const poststed = (a.poststed as string).charAt(0) + (a.poststed as string).slice(1).toLowerCase();
            name = `${a.adressetekst}, ${a.postnummer} ${poststed}`;
          }
        } catch { /* fall through */ }
        await pickAddress(name, [lng, lat]);
        setDetectingPos(false);
      },
      (err) => {
        setDetectingPos(false);
        setGeoError(err.code === 1
          ? "Posisjon ikke tillatt – skriv inn adressen din under."
          : "Kunne ikke hente posisjon. Prøv å skrive inn adressen.");
      },
      { timeout: 10000 },
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Finn din tomt</h2>
      <p className="mt-1 text-sm text-gray-500">Skriv inn adressen så finner vi tomten din automatisk.</p>

      <button
        type="button"
        onClick={detectPosition}
        disabled={detectingPos}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
      >
        {detectingPos ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
        )}
        {detectingPos ? "Henter posisjon…" : "Finn min posisjon"}
      </button>

      {geoError && <p className="mt-1.5 text-xs text-red-500">{geoError}</p>}

      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 border-t border-gray-200" />
        <span className="text-xs text-gray-400">eller søk</span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      <div className="relative mt-3">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="F.eks. Tjødnavegen 8b, Bryne"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        {searching && (
          <span className="absolute right-3 top-2.5 text-xs text-gray-400">Søker…</span>
        )}
        {suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg">
            {suggestions.map((s) => (
              <li key={s.place_name}>
                <button
                  type="button"
                  onClick={() => pickAddress(s.place_name, s.center)}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 first:rounded-t-xl last:rounded-b-xl"
                >
                  {s.place_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {address && (
        <p className="mt-1 text-xs text-gray-400 truncate">
          📍 {address}
          {boundary && <span className="ml-2 text-blue-500">· Tomt funnet</span>}
        </p>
      )}
      <div className="relative z-0 mt-4 overflow-hidden rounded-xl border border-gray-200">
        {garageConfig ? (
          <GaragePlacementMap
            lat={lat} lng={lng}
            widthMm={garageConfig.widthMm}
            lengthMm={garageConfig.lengthMm}
            onMove={(la, ln) => { setLat(la); setLng(ln); }}
            boundary={boundary}
          />
        ) : (
          <div className="h-72">
            <MapPicker lat={lat} lng={lng} onMove={(la, ln) => { setLat(la); setLng(ln); }} boundary={boundary} />
          </div>
        )}
      </div>
      {!garageConfig && <p className="mt-1 text-xs text-gray-400">Klikk i kartet for å justere plasseringen.</p>}
      <div className="mt-6 flex gap-3">
        <button onClick={onBack}
          className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
          ← Tilbake
        </button>
        <button onClick={() => onNext(lat, lng, address || query)}
          className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600">
          Bekreft plassering →
        </button>
      </div>
    </div>
  );
}

// ── Step 2: DIBK questions ────────────────────────────────────────────────────
const DIBK_QUESTIONS: { key: keyof DibkAnswers; q: string; hint?: string; options?: string[] }[] = [
  {
    key: "frittstående",
    q: "Er bygningen frittstående (ikke sammenbygget med bolig eller annen bygning)?",
  },
  {
    key: "bya50",
    q: "Er bebygd areal (BYA) høyst 50 m²?",
    hint: "BYA er fotavtrykket av bygningen inkludert takutstikk over 0,5 m.",
  },
  {
    key: "enEtasje",
    q: "Er bygningen i én etasje?",
  },
  {
    key: "monehoyde",
    q: "Er mønehøyden høyst 4 meter?",
    hint: "Mønehøyde måles fra ferdig planert terreng til øverste punkt på taket.",
  },
  {
    key: "nabogrense",
    q: "Er bygningen plassert minst 1 meter fra nabogrensen?",
    hint: "Avstanden måles fra yttervegg (inkl. takutstikk > 0,5 m) til nabogrensen.",
  },
  {
    key: "avstandBygg",
    q: "Er bygningen plassert minst 1 meter fra annen bygning på eiendommen?",
  },
  {
    key: "ikkeVernet",
    q: "Er tomten utenfor vernede områder, kulturmiljø og reguleringsplaner som forbyr bygningen?",
    hint: "Sjekk i kommunens kartløsning eller arealplan.",
  },
  {
    key: "ikkeFlom",
    q: "Er tomten utenfor fareområder for flom og skred?",
    hint: "Du kan sjekke på NVEs kartportal (nve.no).",
  },
  {
    key: "lnf",
    q: "Skal du bygge i et område regulert til landbruks-, natur- og friluftsformål eller reindrift? (LNF-område)",
    hint: "Bygging i LNF-område krever dispensasjon fra arealplanen. Vi hjelper deg gjerne med dette.",
  },
  {
    key: "kjeller",
    q: "Skal bygningen ha kjeller, loft eller takterrasse?",
    hint: "Kjeller, loft eller takterrasse gjør at bygningen krever byggesøknad, selv om den ellers ville vært søknadsfri.",
    options: ["Ja", "Nei"],
  },
];

function StepDibk({ dibk, setDibk, autoFilled, onNext, onBack }: {
  dibk: DibkAnswers;
  setDibk: (d: DibkAnswers) => void;
  autoFilled: Partial<DibkAnswers>;
  onNext: () => void;
  onBack: () => void;
}) {
  function set(key: keyof DibkAnswers, val: string) {
    setDibk({ ...dibk, [key]: val });
  }
  const allAnswered = Object.values(dibk).every((v) => v !== "");
  const result = permitResult(dibk);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Søknadskrav</h2>
      <p className="mt-1 text-sm text-gray-500">
        Basert på reglene for søknadsfri bygning (pbl. § 20-5). Svar så godt du kan.
      </p>
      <div className="mt-6 space-y-5">
        {DIBK_QUESTIONS.map(({ key, q, hint, options }) => (
          <div key={key}>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-800">{q}</p>
              {key in autoFilled && (
                <span className="shrink-0 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                  Beregnet fra konfigurasjon
                </span>
              )}
            </div>
            {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
            <div className="mt-2 flex gap-2">
              {(options ?? ["Ja", "Nei", "Vet ikke"]).map((v) => (
                <Pill key={v} label={v} active={dibk[key] === v} onClick={() => set(key, v)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {allAnswered && <div className="mt-6"><PermitBanner result={result} /></div>}
      <div className="mt-6 flex gap-3">
        <button onClick={onBack}
          className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
          ← Tilbake
        </button>
        <button onClick={onNext}
          className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600">
          Videre til tegninger →
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Estimate + contact ────────────────────────────────────────────────
function StepEstimate({ dibk, address, garageConfig, buildingType, drawingCost, onBack }: {
  dibk: DibkAnswers;
  address: string;
  garageConfig?: GarageConfig;
  buildingType: BuildingType | null;
  drawingCost: number;
  onBack: () => void;
}) {
  const result = permitResult(dibk);
  const permit = permitCost(dibk);
  const naboCost = countDisp(dibk) > 0 ? 3_000 : 0;
  const garage = garageConfig ? buildingCost(garageConfig) : null;
  const total = (garage ? garage.build + garage.door : 0) + permit + naboCost + drawingCost;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const buildingLabel = BUILDING_TYPES.find((b) => b.id === buildingType)?.label ?? "";

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/soknadshjelp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message, address, dibk, garageConfig, permitResult: result, permit, nabovarsel: naboCost, total, buildingType: buildingLabel }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Prisestimat</h2>
      {buildingLabel && (
        <p className="mt-1 text-sm text-gray-500">Bygningstype: <span className="font-medium text-gray-700">{buildingLabel}</span></p>
      )}
      <div className="mt-4"><PermitBanner result={result} /></div>

      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-5 space-y-2">
        {garage && (
          <>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Bygg ({garage.sqm.toFixed(1)} m² × 5 500 kr)</span>
              <span>{fmt(garage.build)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>Garasjeport</span>
              <span>{fmt(garage.door)}</span>
            </div>
          </>
        )}
        {permit > 0 ? (
          <div className="flex justify-between text-sm text-gray-600">
            <span>
              Søknadshjelp
              {countDisp(dibk) > 0 && ` (inkl. ${countDisp(dibk)} dispensasjon${countDisp(dibk) > 1 ? "er" : ""})`}
            </span>
            <span>{fmt(permit)}</span>
          </div>
        ) : (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Søknadshjelp</span>
            <span className="text-green-700 font-medium">Ikke nødvendig</span>
          </div>
        )}
        {naboCost > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Nabovarsel <span className="text-gray-400">(obligatorisk)</span></span>
            <span>{fmt(naboCost)}</span>
          </div>
        )}
        {drawingCost > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tegninger</span>
            <span>{fmt(drawingCost)}</span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-2 flex justify-between">
          <span className="font-semibold text-gray-900">
            {garage ? "Totalt estimat" : "Søknadshjelp"}
          </span>
          <span className="text-lg font-bold text-orange-500">{fmt(total || permit)}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">* Estimert pris. Endelig tilbud kan variere.</p>

      {sent ? (
        <div className="mt-6 rounded-xl border border-green-100 bg-green-50 p-6">
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
                "Vi gjennomgår søknadsgrunnlaget og tomteinformasjonen din",
                "Christian eller Ola tar kontakt – som regel innen noen timer",
                "Vi sender deg en plan for søknadsprosessen og et tilbud",
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
      ) : (
        <>
          <p className="mt-6 text-sm font-medium text-gray-700">
            Vil du ha et endelig tilbud? Fyll inn kontaktinfo så tar vi kontakt.
          </p>
          <form onSubmit={submit} className="mt-3 space-y-3">
            <input required type="text" placeholder="Navn *" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <input required type="email" placeholder="E-post *" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <input type="tel" placeholder="Telefon" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <textarea placeholder="Eventuelle spesielle ønsker..." rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <button type="submit" disabled={sending}
              className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
              {sending ? "Sender…" : "Send forespørsel"}
            </button>
          </form>
        </>
      )}
      <button onClick={onBack} className="mt-4 text-sm text-gray-400 hover:text-gray-600">← Tilbake</button>
    </div>
  );
}

// ── Step 3: Drawings ──────────────────────────────────────────────────────────
const DRAWING_TIPS = [
  { title: "Målestokk", body: "Alle tegninger må være i målestokk, typisk 1:100 eller 1:200. Angi tydelig hvilken målestokk som er brukt." },
  { title: "Situasjonsplan", body: "Viser tomtegrenser, eksisterende bebyggelse, veier, avstand til nabogrense og avstand til annen bebyggelse. Gjerne lastet ned fra kommunens kartportal og påtegnet med tiltakets plassering." },
  { title: "Eksisterende bebyggelse", body: "All eksisterende bebyggelse på tomten må tegnes inn – ikke bare det nye bygget. Kommunen trenger helhetsbildet for å vurdere bebygd areal (BYA)." },
  { title: "Fasadetegninger", body: "Alle fire fasader (nord, sør, øst, vest) skal tegnes. Vis mønehøyde, gesimshøyde og terreng rundt bygget." },
  { title: "Plantegning", body: "Tegning ovenfra som viser rommets innredning, dører og vinduers plassering med mål." },
  { title: "Snittegning", body: "Tverrsnitt gjennom bygget som viser etasjehøyder, etasjeskiller og takkonstruksjon." },
];

type GarasjeType = "kun-garasje" | "garasje-eksisterende" | null;

function SituasjonsplanCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${checked ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 accent-orange-500" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900">Situasjonsplan</span>
        <p className="text-xs text-gray-500 mt-0.5">Kart med tomtegrenser, naboavstand og plassering av nytt bygg</p>
      </div>
      <span className="shrink-0 text-sm font-semibold text-gray-700">1 500 kr</span>
    </label>
  );
}

function StepDrawings({ garageConfig, onBack, onNext }: {
  garageConfig?: GarageConfig;
  onBack: () => void;
  onNext: (drawingCost: number) => void;
}) {
  // ── From configurator: simplified flow ──────────────────────────────────────
  const [hasExistingDrawings, setHasExistingDrawings] = useState<boolean | null>(null);
  const [withSituasjonsplan, setWithSituasjonsplan] = useState(false);

  // ── Standalone flow ──────────────────────────────────────────────────────────
  const [choice, setChoice] = useState<"need-help" | "have-drawings" | null>(null);
  const [garasjeType, setGarasjeType] = useState<GarasjeType>(null);
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    if (!supabase) { setUser(null); return; }
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoginError("");
    setLoginLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
      if (error) throw error;
      if (data.session?.access_token) {
        await fetch("/api/auth/email-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken: data.session.access_token }),
        });
      }
      setUser(data.user);
    } catch {
      setLoginError("Feil e-post eller passord.");
    } finally {
      setLoginLoading(false);
    }
  }

  // ── Configurator flow ────────────────────────────────────────────────────────
  if (garageConfig) {
    const baseCost = hasExistingDrawings === null ? 0 : hasExistingDrawings ? 5_000 : 10_000;
    const totalCost = baseCost + (withSituasjonsplan ? 1_500 : 0);

    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Tegninger til søknaden</h2>
        <div className="mt-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          Garasjetegningene er klargjort fra konfiguratoren.
        </div>

        <p className="mt-5 text-sm font-semibold text-gray-800">
          Har du originale tegninger av eksisterende bebyggelse på tomten?
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={() => setHasExistingDrawings(true)}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-4 transition-colors ${hasExistingDrawings === true ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
          >
            <span className="text-lg">✓</span>
            <span className="text-sm font-semibold text-gray-900">Ja, jeg har</span>
            <span className="text-xs text-gray-500">5 000 kr</span>
          </button>
          <button
            onClick={() => setHasExistingDrawings(false)}
            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-4 transition-colors ${hasExistingDrawings === false ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white hover:border-gray-300"}`}
          >
            <span className="text-lg">✗</span>
            <span className="text-sm font-semibold text-gray-900">Nei, jeg har ikke</span>
            <span className="text-xs text-gray-500">10 000 kr</span>
          </button>
        </div>

        {hasExistingDrawings !== null && (
          <div className="mt-5 space-y-4">
            <SituasjonsplanCheckbox checked={withSituasjonsplan} onChange={setWithSituasjonsplan} />
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">Tegninger totalt</span>
              <span className="text-base font-bold text-orange-500">{fmt(totalCost)}</span>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">← Tilbake</button>
              <button
                onClick={() => onNext(totalCost)}
                className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Videre til prisestimat →
              </button>
            </div>
          </div>
        )}

        {hasExistingDrawings === null && (
          <button onClick={onBack} className="mt-5 text-sm text-gray-400 hover:text-gray-600">← Tilbake</button>
        )}
      </div>
    );
  }

  // ── Standalone flow ──────────────────────────────────────────────────────────
  const standaloneDrawingCost =
    (garasjeType === "kun-garasje" ? 5_000 : garasjeType === "garasje-eksisterende" ? 10_000 : 0) +
    (withSituasjonsplan ? 1_500 : 0);

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Tegninger til søknaden</h2>
      <p className="mt-2 text-sm text-gray-500">
        En komplett søknad krever tegninger av bygget og situasjonsplan. Trenger du hjelp med dette?
      </p>

      {!choice && (
        <div className="mt-6 grid gap-3">
          <button
            onClick={() => setChoice("need-help")}
            className="flex flex-col items-start gap-1 rounded-xl border-2 border-orange-200 bg-orange-50 px-5 py-4 text-left hover:border-orange-400 transition-colors"
          >
            <span className="font-semibold text-gray-900">Jeg trenger hjelp med tegninger</span>
            <span className="text-sm text-gray-500">Vi lager fagmessige tegninger som kommunen godkjenner</span>
          </button>
          <button
            onClick={() => setChoice("have-drawings")}
            className="flex flex-col items-start gap-1 rounded-xl border-2 border-gray-200 bg-white px-5 py-4 text-left hover:border-gray-400 transition-colors"
          >
            <span className="font-semibold text-gray-900">Jeg har tegninger fra før</span>
            <span className="text-sm text-gray-500">Se hva kommunen krever av tegningsunderlag</span>
          </button>
          <button onClick={onBack} className="mt-2 text-sm text-gray-400 hover:text-gray-600">← Tilbake</button>
        </div>
      )}

      {choice === "have-drawings" && (
        <div className="mt-5">
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 mb-4">
            Husk at ufullstendige tegninger er den vanligste årsaken til at søknader blir returnert.
          </div>
          <ul className="space-y-3">
            {DRAWING_TIPS.map((tip) => (
              <li key={tip.title} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">{tip.title}</p>
                <p className="mt-0.5 text-sm text-gray-600">{tip.body}</p>
              </li>
            ))}
          </ul>
          <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            Usikker på om tegningene dine holder?{" "}
            <button onClick={() => setChoice("need-help")} className="font-semibold underline hover:text-orange-700">
              Vi kan ta en titt
            </button>.
          </div>
          <div className="mt-5 border-t border-gray-100 pt-4 flex gap-3">
            <button onClick={() => setChoice(null)} className="text-sm text-gray-400 hover:text-gray-600">← Tilbake</button>
            <button onClick={() => onNext(0)} className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
              Videre til prisestimat →
            </button>
          </div>
        </div>
      )}

      {choice === "need-help" && (
        <div className="mt-5 space-y-5">
          <div>
            <p className="text-sm font-semibold text-gray-800 mb-2">Hva trenger du tegnet?</p>
            <div className="space-y-2">
              {([
                { value: "kun-garasje", label: "Kun garasjen", sub: "Fasade-, plan- og snittegning av ny garasje", price: "5 000 kr" },
                { value: "garasje-eksisterende", label: "Garasje + eksisterende bebyggelse", sub: "Inkluderer alle bygg på tomten", price: "10 000 kr" },
              ] as { value: GarasjeType; label: string; sub: string; price: string }[]).map((opt) => (
                <label key={opt.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${garasjeType === opt.value ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white hover:border-gray-300"}`}>
                  <input type="radio" name="garasjeType" value={opt.value ?? ""} checked={garasjeType === opt.value}
                    onChange={() => setGarasjeType(opt.value)} className="mt-0.5 accent-orange-500" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-900">{opt.label}</span>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.sub}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-gray-700">{opt.price}</span>
                </label>
              ))}
            </div>
          </div>

          <SituasjonsplanCheckbox checked={withSituasjonsplan} onChange={setWithSituasjonsplan} />

          {standaloneDrawingCost > 0 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-600">Tegninger totalt</span>
              <span className="text-base font-bold text-orange-500">{fmt(standaloneDrawingCost)}</span>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4">
            {user === undefined && <div className="py-2 text-center text-sm text-gray-400">Laster…</div>}
            {user && (
              <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3">
                <p className="text-sm font-semibold text-green-900">Du er logget inn</p>
                <p className="mt-1 text-sm text-green-700">
                  Bruk <span className="font-medium">«Tomteplassering»</span>-funksjonen i konfiguratoren for å koble tegningsoppdraget til riktig tomt.
                </p>
                <a href="/configurator" className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700">
                  Åpne konfiguratoren →
                </a>
              </div>
            )}
            {user === null && (
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  <span className="font-medium">Valgfritt:</span> Logg inn for å koble tegningsoppdraget til tomteplasseringen din.
                </p>
                <form onSubmit={handleLogin} className="space-y-2">
                  <input type="email" required placeholder="E-post" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  <input type="password" required placeholder="Passord" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  {loginError && <p className="text-sm text-red-600">{loginError}</p>}
                  <button type="submit" disabled={loginLoading}
                    className="w-full rounded-lg bg-gray-700 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
                    {loginLoading ? "Logger inn…" : "Logg inn"}
                  </button>
                </form>
                <p className="mt-2 text-center text-xs text-gray-400">
                  Har du ikke konto?{" "}
                  <a href="/configurator" className="text-orange-500 hover:underline">Registrer deg i konfiguratoren</a>
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setChoice(null)} className="text-sm text-gray-400 hover:text-gray-600">← Tilbake</button>
            <button
              onClick={() => onNext(standaloneDrawingCost)}
              disabled={garasjeType === null && !withSituasjonsplan}
              className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Videre til prisestimat →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export default function SoknadshjelWizard({ garageConfig, initialBuildingType }: { garageConfig?: GarageConfig; initialBuildingType?: BuildingType }) {
  const skipType = !!initialBuildingType;

  // Only auto-fill address if user came from the configurator (garageConfig present)
  // AND has already placed the garage in tomteplassering (saved in localStorage)
  const savedAddress =
    garageConfig && typeof window !== "undefined"
      ? (localStorage.getItem("gp-map-address") ?? "")
      : "";
  const hasPlacedOnMap = !!savedAddress;

  const [step, setStep] = useState(() => {
    if (skipType) return hasPlacedOnMap ? 2 : 1;
    return 0;
  });
  const [buildingType, setBuildingType] = useState<BuildingType | null>(initialBuildingType ?? null);
  const [address, setAddress] = useState(savedAddress);
  const autoFilled = garageConfig ? autoFillDibk(garageConfig) : {};
  const [dibk, setDibk] = useState<DibkAnswers>({ ...defaultDibk, ...autoFilled });
  const [drawingCost, setDrawingCost] = useState(0);

  return (
    <div className="mx-auto max-w-xl px-6 py-12 sm:py-16">
      {skipType && (
        <div className="mb-6 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          Bygningstype: <span className="font-medium">Garasje eller carport</span> – hentet fra konfiguratoren
        </div>
      )}
      {garageConfig && (
        <div className="mb-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          Garasjekonfigurasjon: {garageConfig.widthMm / 1000} × {garageConfig.lengthMm / 1000} m
          – port {garageConfig.doorWidthMm} mm
        </div>
      )}
      {hasPlacedOnMap && step >= 2 && (
        <div className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          📍 Adresse hentet fra tomteplassering: <span className="font-medium">{address}</span>
        </div>
      )}
      <StepBar step={step} skipType={skipType} />
      {step === 0 && (
        <StepBuildingType selected={buildingType} onNext={(t) => { setBuildingType(t); setStep(1); }} />
      )}
      {step === 1 && (
        <StepMap garageConfig={garageConfig} onNext={(_, __, addr) => { setAddress(addr); setStep(2); }} onBack={() => setStep(skipType ? 1 : 0)} />
      )}
      {step === 2 && (
        <StepDibk dibk={dibk} setDibk={setDibk} autoFilled={autoFilled} onNext={() => setStep(3)} onBack={() => setStep(hasPlacedOnMap ? 0 : 1)} />
      )}
      {step === 3 && (
        <StepDrawings garageConfig={garageConfig} onBack={() => setStep(2)} onNext={(cost) => { setDrawingCost(cost); setStep(4); }} />
      )}
      {step === 4 && (
        <StepEstimate dibk={dibk} address={address} garageConfig={garageConfig} buildingType={buildingType} drawingCost={drawingCost} onBack={() => setStep(3)} />
      )}
    </div>
  );
}
