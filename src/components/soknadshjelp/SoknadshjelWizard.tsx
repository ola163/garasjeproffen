"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const MapPicker = dynamic(() => import("./MapPicker"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GarageConfig {
  lengthMm: number;
  widthMm: number;
  doorWidthMm: number;
  doorHeightMm: number;
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
const STEPS_FULL   = ["Velg type", "Finn tomt", "Søknadskrav", "Prisestimat"];
const STEPS_SKIP   = ["Finn tomt", "Søknadskrav", "Prisestimat"];

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
function StepMap({ onNext, onBack }: {
  onNext: (lat: number, lng: number, address: string) => void;
  onBack: () => void;
}) {
  const [query, setQuery] = useState("");
  const [lat, setLat] = useState(58.7441);
  const [lng, setLng] = useState(5.5339);
  const [address, setAddress] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ", Norge")}&format=json&limit=1`,
        { headers: { "Accept-Language": "nb" } }
      );
      const data = await res.json();
      if (!data.length) { setError("Fant ikke adressen. Prøv igjen."); return; }
      setLat(parseFloat(data[0].lat));
      setLng(parseFloat(data[0].lon));
      setAddress(data[0].display_name);
    } catch {
      setError("Nettverksfeil. Prøv igjen.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Finn din tomt</h2>
      <p className="mt-1 text-sm text-gray-500">Skriv inn adressen og bekreft plasseringen på kartet.</p>
      <div className="mt-4 flex gap-2">
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="F.eks. Tjødnavegen 8b, Bryne"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        <button onClick={search} disabled={searching}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
          {searching ? "Søker…" : "Søk"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {address && <p className="mt-1 text-xs text-gray-400 truncate">📍 {address}</p>}
      <div className="mt-4 h-72 w-full overflow-hidden rounded-xl border border-gray-200">
        <MapPicker lat={lat} lng={lng} onMove={(la, ln) => { setLat(la); setLng(ln); }} />
      </div>
      <p className="mt-1 text-xs text-gray-400">Dra markøren eller klikk i kartet for å justere.</p>
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

function StepDibk({ dibk, setDibk, onNext, onBack }: {
  dibk: DibkAnswers;
  setDibk: (d: DibkAnswers) => void;
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
            <p className="text-sm font-medium text-gray-800">{q}</p>
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
          Se prisestimat →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Estimate + contact ────────────────────────────────────────────────
function StepEstimate({ dibk, address, garageConfig, buildingType, onBack }: {
  dibk: DibkAnswers;
  address: string;
  garageConfig?: GarageConfig;
  buildingType: BuildingType | null;
  onBack: () => void;
}) {
  const result = permitResult(dibk);
  const permit = permitCost(dibk);
  const garage = garageConfig ? buildingCost(garageConfig) : null;
  const total = (garage ? garage.build + garage.door : 0) + permit;

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
        body: JSON.stringify({ name, email, phone, message, address, dibk, garageConfig, permitResult: result, permit, total, buildingType: buildingLabel }),
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
        <div className="border-t border-gray-200 pt-2 flex justify-between">
          <span className="font-semibold text-gray-900">
            {garage ? "Totalt estimat" : "Søknadshjelp"}
          </span>
          <span className="text-lg font-bold text-orange-500">{fmt(total || permit)}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">* Estimert pris. Endelig tilbud kan variere.</p>

      {sent ? (
        <div className="mt-6 rounded-xl bg-green-50 p-5 text-sm text-green-800">
          Takk! Vi tar kontakt med deg snart.
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

// ── Main wizard ───────────────────────────────────────────────────────────────
export default function SoknadshjelWizard({ garageConfig, initialBuildingType }: { garageConfig?: GarageConfig; initialBuildingType?: BuildingType }) {
  const skipType = !!initialBuildingType;
  const [step, setStep] = useState(skipType ? 1 : 0);
  const [buildingType, setBuildingType] = useState<BuildingType | null>(initialBuildingType ?? null);
  const [address, setAddress] = useState("");
  const [dibk, setDibk] = useState<DibkAnswers>(defaultDibk);

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
      <StepBar step={step} skipType={skipType} />
      {step === 0 && (
        <StepBuildingType selected={buildingType} onNext={(t) => { setBuildingType(t); setStep(1); }} />
      )}
      {step === 1 && (
        <StepMap onNext={(_, __, addr) => { setAddress(addr); setStep(2); }} onBack={() => setStep(skipType ? 1 : 0)} />
      )}
      {step === 2 && (
        <StepDibk dibk={dibk} setDibk={setDibk} onNext={() => setStep(3)} onBack={() => setStep(1)} />
      )}
      {step === 3 && (
        <StepEstimate dibk={dibk} address={address} garageConfig={garageConfig} buildingType={buildingType} onBack={() => setStep(2)} />
      )}
    </div>
  );
}
