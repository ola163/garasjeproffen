"use client";

import { useState } from "react";

export interface GrunnarbeidData {
  // 1. Grunnarbeid
  utgraving: boolean;
  utgravingDybdeFra: string;
  utgravingDybdeTil: string;
  markisolering: boolean;
  markinsoleringstykkelse: string;
  // 2. Betongarbeid
  betongdekke: boolean;
  fallGulv: boolean;
  helikopterpuss: boolean;
  betongtype: "B30" | "B35" | "B35MF45" | "";
  ringmur: boolean;
  ringmurLengde: string;
  skillvegg: boolean;
  skillveggLengde: string;
  // 4. Utomhusarbeider
  fjernAsfalt: boolean;
  fjernAsfaltAreal: string;
  masseutskiftning: boolean;
  masseutskiftningAreal: string;
  reasfaltering: boolean;
  reasfalteringAreal: string;
  fyllingMur: boolean;
  fyllingMurAreal: string;
}

export function emptyGrunnarbeidData(sqm: number, perimeterM: number): GrunnarbeidData {
  return {
    utgraving: true, utgravingDybdeFra: "", utgravingDybdeTil: "",
    markisolering: false, markinsoleringstykkelse: "",
    betongdekke: true, fallGulv: false, helikopterpuss: false, betongtype: "B35",
    ringmur: true, ringmurLengde: String(Math.round(perimeterM)),
    skillvegg: false, skillveggLengde: "",
    fjernAsfalt: false, fjernAsfaltAreal: String(Math.round(sqm)),
    masseutskiftning: false, masseutskiftningAreal: String(Math.round(sqm)),
    reasfaltering: false, reasfalteringAreal: "",
    fyllingMur: false, fyllingMurAreal: "",
  };
}

interface Props {
  sqm: number;
  perimeterM: number;
  initialData?: GrunnarbeidData;
  onSave: (data: GrunnarbeidData) => void;
  onClose: () => void;
}

const STEPS = ["Grunnarbeid", "Betongarbeid", "Utomhusarbeider"];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? "bg-orange-500" : "bg-gray-200"}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function Field({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, unit, placeholder }: { value: string; onChange: (v: string) => void; unit?: string; placeholder?: string }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "0"}
        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-right focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
      />
      {unit && <span className="text-xs text-gray-500">{unit}</span>}
    </div>
  );
}

export default function GrunnarbeidWizard({ sqm, perimeterM, initialData, onSave, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [d, setD] = useState<GrunnarbeidData>(initialData ?? emptyGrunnarbeidData(sqm, perimeterM));

  function set<K extends keyof GrunnarbeidData>(key: K, val: GrunnarbeidData[K]) {
    setD(prev => ({ ...prev, [key]: val }));
  }

  function handleSave() {
    onSave(d);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "92vh" }}>

        {/* Header */}
        <div className="border-b px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Grunn- og betongarbeid</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {sqm.toFixed(1)} m² · omkrets {perimeterM.toFixed(1)} m · Steg {step + 1} av {STEPS.length}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          {/* Step dots */}
          <div className="mt-3 flex gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s}
                onClick={() => setStep(i)}
                className={`flex-1 rounded-full py-1.5 text-xs font-medium transition-all ${i === step ? "bg-orange-500 text-white" : i < step ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-400"}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {step === 0 && (
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">1. Grunnarbeid</p>
              <Field label="Utgraving / masseutskiftning av byggegrop" sub="Spesifiser dybde fra–til">
                <Toggle checked={d.utgraving} onChange={v => set("utgraving", v)} />
              </Field>
              {d.utgraving && (
                <div className="ml-4 mb-2 flex items-center gap-3 rounded-lg bg-orange-50 p-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">Fra</span>
                    <NumberInput value={d.utgravingDybdeFra} onChange={v => set("utgravingDybdeFra", v)} unit="cm" placeholder="0" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-600">Til</span>
                    <NumberInput value={d.utgravingDybdeTil} onChange={v => set("utgravingDybdeTil", v)} unit="cm" placeholder="0" />
                  </div>
                </div>
              )}
              <Field label="Markisolering inkludert" sub="Spesifiser tykkelse i cm">
                <Toggle checked={d.markisolering} onChange={v => set("markisolering", v)} />
              </Field>
              {d.markisolering && (
                <div className="ml-4 mb-2 rounded-lg bg-orange-50 p-3">
                  <NumberInput value={d.markinsoleringstykkelse} onChange={v => set("markinsoleringstykkelse", v)} unit="cm" placeholder="10" />
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">2. Betongarbeid</p>
              <Field label="Forskaling og støp av betongdekke" sub={`${sqm.toFixed(1)} m² (fra garasjen)`}>
                <Toggle checked={d.betongdekke} onChange={v => set("betongdekke", v)} />
              </Field>
              <Field label="Gulv støpes med fall 1:100" sub="Fronten er låst">
                <Toggle checked={d.fallGulv} onChange={v => set("fallGulv", v)} />
              </Field>
              <Field label='Stålglattet overflate "helikopterpuss"'>
                <Toggle checked={d.helikopterpuss} onChange={v => set("helikopterpuss", v)} />
              </Field>
              <Field label="Betongtype">
                <select
                  value={d.betongtype}
                  onChange={e => set("betongtype", e.target.value as GrunnarbeidData["betongtype"])}
                  className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-orange-400 focus:outline-none"
                >
                  <option value="">Velg betong</option>
                  <option value="B30">B30</option>
                  <option value="B35">B35</option>
                  <option value="B35MF45">B35MF45</option>
                </select>
              </Field>
              <Field label="Støp av ringmur (yttervegg)" sub="H:25 cm · B:15 cm">
                <Toggle checked={d.ringmur} onChange={v => set("ringmur", v)} />
              </Field>
              {d.ringmur && (
                <div className="ml-4 mb-2 rounded-lg bg-orange-50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Lengde (omkrets {perimeterM.toFixed(1)} m)</span>
                    <NumberInput value={d.ringmurLengde} onChange={v => set("ringmurLengde", v)} unit="m" />
                  </div>
                </div>
              )}
              <Field label="Innvendige skilleveggsmurer" sub="H:25 cm · B:10 cm">
                <Toggle checked={d.skillvegg} onChange={v => set("skillvegg", v)} />
              </Field>
              {d.skillvegg && (
                <div className="ml-4 mb-2 rounded-lg bg-orange-50 p-3">
                  <NumberInput value={d.skillveggLengde} onChange={v => set("skillveggLengde", v)} unit="m" placeholder="0" />
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-400">4. Utomhusarbeider</p>
              <Field label="Fjerning av eksisterende asfalt">
                <Toggle checked={d.fjernAsfalt} onChange={v => set("fjernAsfalt", v)} />
              </Field>
              {d.fjernAsfalt && (
                <div className="ml-4 mb-2 rounded-lg bg-orange-50 p-3">
                  <NumberInput value={d.fjernAsfaltAreal} onChange={v => set("fjernAsfaltAreal", v)} unit="m²" />
                </div>
              )}
              <Field label="Masseutskiftning utenfor garasje">
                <Toggle checked={d.masseutskiftning} onChange={v => set("masseutskiftning", v)} />
              </Field>
              {d.masseutskiftning && (
                <div className="ml-4 mb-2 rounded-lg bg-orange-50 p-3">
                  <NumberInput value={d.masseutskiftningAreal} onChange={v => set("masseutskiftningAreal", v)} unit="m²" />
                </div>
              )}
              <Field label="Reasfaltering">
                <Toggle checked={d.reasfaltering} onChange={v => set("reasfaltering", v)} />
              </Field>
              {d.reasfaltering && (
                <div className="ml-4 mb-2 rounded-lg bg-orange-50 p-3">
                  <NumberInput value={d.reasfalteringAreal} onChange={v => set("reasfalteringAreal", v)} unit="m²" />
                </div>
              )}
              <Field label="Fylling inntil mur (ved støp av murer)">
                <Toggle checked={d.fyllingMur} onChange={v => set("fyllingMur", v)} />
              </Field>
              {d.fyllingMur && (
                <div className="ml-4 mb-2 rounded-lg bg-orange-50 p-3">
                  <NumberInput value={d.fyllingMurAreal} onChange={v => set("fyllingMurAreal", v)} unit="m²" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between gap-2">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            {step === 0 ? "Avbryt" : "← Tilbake"}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Neste →
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Lagre tillegg
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
