"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const MapPicker = dynamic(() => import("./MapPicker"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
interface DibkAnswers {
  frittstående: string;
  bya50: string;
  enEtasje: string;
  monehoyde: string;
  nabogrense: string;
  avstandBygg: string;
  ikkeVernet: string;
  ikkeFlom: string;
}

interface ProjectAnswers {
  usage: string;
  cars: string;
  widthM: number;
  lengthM: number;
  flatLot: string;
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
};

const defaultProject: ProjectAnswers = {
  usage: "",
  cars: "",
  widthM: 6,
  lengthM: 6,
  flatLot: "",
};

// ── Permit result logic ───────────────────────────────────────────────────────
type PermitResult = "søknadsfri" | "søknad" | "usikkert";

function permitResult(d: DibkAnswers): PermitResult {
  const vals = Object.values(d);
  if (vals.some((v) => v === "Nei")) return "søknad";
  if (vals.some((v) => v === "" || v === "Vet ikke")) return "usikkert";
  return "søknadsfri";
}

// ── Price estimate ────────────────────────────────────────────────────────────
function estimatePrice(p: ProjectAnswers, d: DibkAnswers) {
  const sqm = p.widthM * p.lengthM;
  const build = Math.round(sqm * 5500);
  const door = p.widthM >= 7 ? 40_000 : 20_000;
  const permit = permitResult(d) !== "søknadsfri" ? 8_000 : 0;
  return { build, door, permit, total: build + door + permit };
}

function fmt(n: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency", currency: "NOK",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

// ── Step bar ──────────────────────────────────────────────────────────────────
const STEPS = ["Finn tomt", "Søknadskrav", "Om prosjektet", "Prisestimat"];

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

// ── Pill button helper ────────────────────────────────────────────────────────
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`rounded-lg border px-4 py-2 text-sm transition-all
        ${active ? "border-orange-500 bg-orange-50 font-medium text-orange-700" : "border-gray-200 text-gray-600 hover:border-orange-300"}`}>
      {label}
    </button>
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
      <p className="mt-1 text-sm text-gray-500">
        Skriv inn adressen og bekreft plasseringen på kartet.
      </p>
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
];

function PermitBanner({ result }: { result: PermitResult }) {
  if (result === "søknadsfri") return (
    <div className="rounded-xl bg-green-50 border border-green-200 p-4">
      <p className="font-semibold text-green-800">✓ Garasjen kan trolig bygges uten søknad</p>
      <p className="mt-1 text-xs text-green-700">
        Basert på svarene dine ser dette ut til å være søknadsfritt etter plan- og bygningsloven § 20-5.
        Vi anbefaler likevel å bekrefte med kommunen din.
      </p>
    </div>
  );
  if (result === "søknad") return (
    <div className="rounded-xl bg-red-50 border border-red-200 p-4">
      <p className="font-semibold text-red-800">⚠ Byggesøknad er trolig nødvendig</p>
      <p className="mt-1 text-xs text-red-700">
        Ett eller flere krav for søknadsfri garasje er ikke oppfylt. Vi hjelper deg gjerne med søknaden.
      </p>
    </div>
  );
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
      <p className="font-semibold text-amber-800">? Vi anbefaler å avklare med kommunen</p>
      <p className="mt-1 text-xs text-amber-700">
        Du har svart «Vet ikke» på ett eller flere spørsmål. Ta kontakt med kommunen eller oss for å avklare.
      </p>
    </div>
  );
}

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
        Basert på reglene for søknadsfri garasje (pbl. § 20-5). Svar så godt du kan – du kan svare «Vet ikke».
      </p>

      <div className="mt-6 space-y-5">
        {DIBK_QUESTIONS.map(({ key, q, hint, options }) => (
          <div key={key}>
            <p className="text-sm font-medium text-gray-800">{q}</p>
            {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
            <div className="mt-2 flex gap-2">
              {["Ja", "Nei", "Vet ikke"].map((v) => (
                <Pill key={v} label={v} active={dibk[key] === v} onClick={() => set(key, v)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {allAnswered && (
        <div className="mt-6">
          <PermitBanner result={result} />
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <button onClick={onBack}
          className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
          ← Tilbake
        </button>
        <button onClick={onNext}
          className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600">
          Gå videre →
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Project questions ─────────────────────────────────────────────────
function StepProject({ project, setProject, onNext, onBack }: {
  project: ProjectAnswers;
  setProject: (p: ProjectAnswers) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  function set(key: keyof ProjectAnswers, value: string | number) {
    setProject({ ...project, [key]: value });
  }

  const valid = project.usage && project.cars && project.flatLot;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Om prosjektet</h2>
      <p className="mt-1 text-sm text-gray-500">Fortell oss litt om garasjen du ønsker.</p>

      <div className="mt-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Hva skal garasjen brukes til?</label>
          <div className="flex flex-wrap gap-2">
            {["Parkering", "Lagring", "Verksted", "Kombinert"].map((v) => (
              <Pill key={v} label={v} active={project.usage === v} onClick={() => set("usage", v)} />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Antall biler?</label>
          <div className="flex gap-2">
            {["1", "2", "3+"].map((v) => (
              <Pill key={v} label={v} active={project.cars === v} onClick={() => set("cars", v)} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bredde (m)</label>
            <select value={project.widthM} onChange={(e) => set("widthM", Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              {[4, 5, 6, 7, 8, 9].map((v) => <option key={v} value={v}>{v} m</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lengde (m)</label>
            <select value={project.lengthM} onChange={(e) => set("lengthM", Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              {[4, 5, 6, 7, 8, 9].map((v) => <option key={v} value={v}>{v} m</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Er tomten flat?</label>
          <div className="flex gap-2">
            {["Ja", "Nei", "Vet ikke"].map((v) => (
              <Pill key={v} label={v} active={project.flatLot === v} onClick={() => set("flatLot", v)} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button onClick={onBack}
          className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
          ← Tilbake
        </button>
        <button onClick={onNext} disabled={!valid}
          className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">
          Se prisestimat →
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Estimate + contact ────────────────────────────────────────────────
function StepEstimate({ project, dibk, address, onBack }: {
  project: ProjectAnswers;
  dibk: DibkAnswers;
  address: string;
  onBack: () => void;
}) {
  const price = estimatePrice(project, dibk);
  const result = permitResult(dibk);
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
        body: JSON.stringify({ name, email, phone, address, dibk, project, price, permitResult: result }),
      });
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Ditt prisestimat</h2>
      <p className="mt-1 text-sm text-gray-500">
        {project.widthM} × {project.lengthM} m – {project.usage.toLowerCase()}
      </p>

      <div className="mt-4">
        <PermitBanner result={result} />
      </div>

      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-5 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Bygg ({project.widthM * project.lengthM} m² × 5 500 kr)</span>
          <span>{fmt(price.build)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Garasjeport</span>
          <span>{fmt(price.door)}</span>
        </div>
        {price.permit > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Søknadshjelp (estimat)</span>
            <span>{fmt(price.permit)}</span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-2 flex justify-between">
          <span className="font-semibold text-gray-900">Totalt estimat</span>
          <span className="text-lg font-bold text-orange-500">{fmt(price.total)}</span>
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

      <button onClick={onBack} className="mt-4 text-sm text-gray-400 hover:text-gray-600">
        ← Tilbake
      </button>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export default function SoknadshjelWizard() {
  const [step, setStep] = useState(0);
  const [lat, setLat] = useState(58.7441);
  const [lng, setLng] = useState(5.5339);
  const [address, setAddress] = useState("");
  const [dibk, setDibk] = useState<DibkAnswers>(defaultDibk);
  const [project, setProject] = useState<ProjectAnswers>(defaultProject);

  return (
    <div className="mx-auto max-w-xl px-6 py-12 sm:py-16">
      <StepBar step={step} />
      {step === 0 && (
        <StepMap onNext={(la, ln, addr) => { setLat(la); setLng(ln); setAddress(addr); setStep(1); }} />
      )}
      {step === 1 && (
        <StepDibk dibk={dibk} setDibk={setDibk} onNext={() => setStep(2)} onBack={() => setStep(0)} />
      )}
      {step === 2 && (
        <StepProject project={project} setProject={setProject} onNext={() => setStep(3)} onBack={() => setStep(1)} />
      )}
      {step === 3 && (
        <StepEstimate project={project} dibk={dibk} address={address} onBack={() => setStep(2)} />
      )}
    </div>
  );
}
