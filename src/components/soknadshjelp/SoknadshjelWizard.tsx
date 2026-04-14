"use client";

import { useState, useRef } from "react";
import dynamic from "next/dynamic";

const MapPicker = dynamic(() => import("./MapPicker"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
interface Answers {
  usage: string;
  cars: string;
  widthM: number;
  lengthM: number;
  flatLot: string;
  needPermit: string;
}

const defaultAnswers: Answers = {
  usage: "",
  cars: "",
  widthM: 6,
  lengthM: 6,
  flatLot: "",
  needPermit: "",
};

// ── Price estimate ────────────────────────────────────────────────────────────
function estimatePrice(a: Answers) {
  const sqm = a.widthM * a.lengthM;
  const build = Math.round(sqm * 5500);
  const door = a.widthM >= 7 ? 40_000 : 20_000;
  const permit = a.needPermit === "Ja" ? 8_000 : 0;
  return { build, door, permit, total: build + door + permit };
}

function fmt(n: number) {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency", currency: "NOK",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

// ── Step indicators ───────────────────────────────────────────────────────────
const STEPS = ["Finn tomt", "Om prosjektet", "Prisestimat"];

function StepBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
            ${i < step ? "bg-orange-500 text-white" : i === step ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400"}`}>
            {i < step ? "✓" : i + 1}
          </div>
          <span className={`text-sm ${i === step ? "font-medium text-gray-900" : "text-gray-400"}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && <div className="mx-1 h-px w-6 bg-gray-200" />}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Map ───────────────────────────────────────────────────────────────
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
      if (data.length === 0) { setError("Fant ikke adressen. Prøv igjen."); return; }
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
        Skriv inn adressen din og bekreft plasseringen på kartet. Du kan også klikke direkte i kartet.
      </p>

      <div className="mt-4 flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="F.eks. Tjødnavegen 8b, Bryne"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          onClick={search}
          disabled={searching}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
        >
          {searching ? "Søker…" : "Søk"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {address && <p className="mt-1 text-xs text-gray-400 truncate">📍 {address}</p>}

      <div className="mt-4 h-72 w-full overflow-hidden rounded-xl border border-gray-200">
        <MapPicker lat={lat} lng={lng} onMove={(la, ln) => { setLat(la); setLng(ln); }} />
      </div>
      <p className="mt-1 text-xs text-gray-400">Dra i markøren eller klikk i kartet for å justere plasseringen.</p>

      <button
        onClick={() => onNext(lat, lng, address || query)}
        className="mt-6 w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
      >
        Bekreft plassering →
      </button>
    </div>
  );
}

// ── Step 2: Questions ─────────────────────────────────────────────────────────
function StepQuestions({ answers, setAnswers, onNext, onBack }: {
  answers: Answers;
  setAnswers: (a: Answers) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  function set(key: keyof Answers, value: string | number) {
    setAnswers({ ...answers, [key]: value });
  }

  const valid = answers.usage && answers.cars && answers.flatLot && answers.needPermit;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Om prosjektet</h2>
      <p className="mt-1 text-sm text-gray-500">Svar på noen spørsmål så vi kan gi deg et bedre estimat.</p>

      <div className="mt-6 space-y-5">
        {/* Usage */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Hva skal garasjen brukes til?</label>
          <div className="flex flex-wrap gap-2">
            {["Parkering", "Lagring", "Verksted", "Kombinert"].map((v) => (
              <button key={v} onClick={() => set("usage", v)}
                className={`rounded-lg border px-4 py-2 text-sm transition-all
                  ${answers.usage === v ? "border-orange-500 bg-orange-50 font-medium text-orange-700" : "border-gray-200 text-gray-600 hover:border-orange-300"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Cars */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Antall biler?</label>
          <div className="flex gap-2">
            {["1", "2", "3+"].map((v) => (
              <button key={v} onClick={() => set("cars", v)}
                className={`rounded-lg border px-5 py-2 text-sm transition-all
                  ${answers.cars === v ? "border-orange-500 bg-orange-50 font-medium text-orange-700" : "border-gray-200 text-gray-600 hover:border-orange-300"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bredde (m)</label>
            <select value={answers.widthM} onChange={(e) => set("widthM", Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              {[4, 5, 6, 7, 8, 9].map((v) => <option key={v} value={v}>{v} m</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lengde (m)</label>
            <select value={answers.lengthM} onChange={(e) => set("lengthM", Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              {[4, 5, 6, 7, 8, 9].map((v) => <option key={v} value={v}>{v} m</option>)}
            </select>
          </div>
        </div>

        {/* Flat lot */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Er tomten flat?</label>
          <div className="flex gap-2">
            {["Ja", "Nei", "Vet ikke"].map((v) => (
              <button key={v} onClick={() => set("flatLot", v)}
                className={`rounded-lg border px-4 py-2 text-sm transition-all
                  ${answers.flatLot === v ? "border-orange-500 bg-orange-50 font-medium text-orange-700" : "border-gray-200 text-gray-600 hover:border-orange-300"}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Permit */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Trenger du hjelp med byggesøknad?</label>
          <div className="flex gap-2">
            {["Ja", "Nei", "Vet ikke"].map((v) => (
              <button key={v} onClick={() => set("needPermit", v)}
                className={`rounded-lg border px-4 py-2 text-sm transition-all
                  ${answers.needPermit === v ? "border-orange-500 bg-orange-50 font-medium text-orange-700" : "border-gray-200 text-gray-600 hover:border-orange-300"}`}>
                {v}
              </button>
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
function StepEstimate({ answers, address, onBack }: {
  answers: Answers;
  address: string;
  onBack: () => void;
}) {
  const price = estimatePrice(answers);
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
        body: JSON.stringify({ name, email, phone, address, answers, price }),
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
        Basert på svarene dine – {answers.widthM} × {answers.lengthM} m, {answers.usage.toLowerCase()}.
      </p>

      {/* Price breakdown */}
      <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-5 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Bygg ({answers.widthM * answers.lengthM} m² × 5 500 kr)</span>
          <span>{fmt(price.build)}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Garasjeport</span>
          <span>{fmt(price.door)}</span>
        </div>
        {price.permit > 0 && (
          <div className="flex justify-between text-sm text-gray-600">
            <span>Søknadshjelp</span>
            <span>{fmt(price.permit)}</span>
          </div>
        )}
        <div className="border-t border-gray-200 pt-2 flex justify-between">
          <span className="font-semibold text-gray-900">Totalt estimat</span>
          <span className="text-lg font-bold text-orange-500">{fmt(price.total)}</span>
        </div>
      </div>
      <p className="mt-1 text-xs text-gray-400">* Estimert pris. Endelig tilbud kan variere.</p>

      {/* Contact form */}
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

      <button onClick={onBack}
        className="mt-4 text-sm text-gray-400 hover:text-gray-600">
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
  const [answers, setAnswers] = useState<Answers>(defaultAnswers);

  return (
    <div className="mx-auto max-w-xl px-6 py-12 sm:py-16">
      <StepBar step={step} />
      {step === 0 && (
        <StepMap onNext={(la, ln, addr) => { setLat(la); setLng(ln); setAddress(addr); setStep(1); }} />
      )}
      {step === 1 && (
        <StepQuestions answers={answers} setAnswers={setAnswers} onNext={() => setStep(2)} onBack={() => setStep(0)} />
      )}
      {step === 2 && (
        <StepEstimate answers={answers} address={address} onBack={() => setStep(1)} />
      )}
    </div>
  );
}
