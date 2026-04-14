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
      <p className="font-semibold text-green-800">✓ Garasjen kan trolig bygges uten søknad</p>
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
        Ett eller flere krav for søknadsfri garasje er ikke oppfylt. Vi hjelper deg gjerne.
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
const STEPS = ["Finn tomt", "Søknadskrav", "Prisestimat"];

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold
            ${i <= step ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400"}`}>
            {i < step ? "✓" : i + 1}
          </div>
          <span className={`text-xs sm:text-sm ${i === step ? "font-medium text-gray-900" : "text-gray-400"}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && <div className="mx-1 h-px w-4 bg-gray-200" />}
        </div>
      ))}
    </div>
  );
}

// ── Step 0: Map ───────────────────────────────────────────────────────────────
function StepMap({ onNext }: { onNext: (lat: number, lng: number, address: string) => void }) {
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
      <button onClick={() => onNext(lat, lng, address || query)}
        className="mt-6 w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600">
        Bekreft plassering →
      </button>
    </div>
  );
}

// ── Step 1: DIBK questions ────────────────────────────────────────────────────
const DIBK_QUESTIONS: { key: keyof DibkAnswers; q: string; hint?: string; options?: string[] }[] = [
  {
    key: "frittstående",
    q: "Er garasjen frittstående (ikke sammenbygget med bolig eller annen bygning)?",
  },
  {
    key: "bya50",
    q: "Er bebygd areal (BYA) høyst 50 m²?",
    hint: "BYA er fotavtrykket av bygningen inkludert takutstikk over 0,5 m.",
  },
  {
    key: "enEtasje",
    q: "Er garasjen i én etasje?",
  },
  {
    key: "monehoyde",
    q: "Er mønehøyden høyst 4 meter?",
    hint: "Mønehøyde måles fra ferdig planert terreng til øverste punkt på taket.",
  },
  {
    key: "nabogrense",
    q: "Er garasjen plassert minst 1 meter fra nabogrensen?",
    hint: "Avstanden måles fra yttervegg (inkl. takutstikk > 0,5 m) til nabogrensen.",
  },
  {
    key: "avstandBygg",
    q: "Er garasjen plassert minst 1 meter fra annen bygning på eiendommen?",
  },
  {
    key: "ikkeVernet",
    q: "Er tomten utenfor vernede områder, kulturmiljø og reguleringsplaner som forbyr garasjen?",
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
        Basert på reglene for søknadsfri garasje (pbl. § 20-5). Svar så godt du kan.
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

// ── Step 2: Estimate + contact ────────────────────────────────────────────────
function StepEstimate({ dibk, address, garageConfig, onBack }: {
  dibk: DibkAnswers;
  address: string;
  garageConfig?: GarageConfig;
  onBack: () => void;
}) {
  const result = permitResult(dibk);
  const permit = permitCost(dibk);
  const garage = garageConfig ? buildingCost(garageConfig) : null;
  const total = (garage ? garage.build + garage.door : 0) + permit;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/soknadshjelp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, address, dibk, garageConfig, permitResult: result, permit, total }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Prisestimat</h2>
      <div className="mt-4"><PermitBanner result={result} /></div>

      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-5 space-y-2">
        {/* Building cost — only shown when coming from configurator */}
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

        {/* Søknadshjelp */}
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
export default function SoknadshjelWizard({ garageConfig }: { garageConfig?: GarageConfig }) {
  const [step, setStep] = useState(0);
  const [address, setAddress] = useState("");
  const [dibk, setDibk] = useState<DibkAnswers>(defaultDibk);

  return (
    <div className="mx-auto max-w-xl px-6 py-12 sm:py-16">
      {garageConfig && (
        <div className="mb-6 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          Garasjekonfigurasjon hentet: {garageConfig.widthMm / 1000} × {garageConfig.lengthMm / 1000} m
          – port {garageConfig.doorWidthMm} mm
        </div>
      )}
      <StepBar step={step} />
      {step === 0 && (
        <StepMap onNext={(_, __, addr) => { setAddress(addr); setStep(1); }} />
      )}
      {step === 1 && (
        <StepDibk dibk={dibk} setDibk={setDibk} onNext={() => setStep(2)} onBack={() => setStep(0)} />
      )}
      {step === 2 && (
        <StepEstimate dibk={dibk} address={address} garageConfig={garageConfig} onBack={() => setStep(1)} />
      )}
    </div>
  );
}
