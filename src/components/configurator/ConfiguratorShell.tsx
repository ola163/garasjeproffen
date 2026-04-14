"use client";

import { useMemo, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import LengthSlider from "./LengthSlider";
import PriceSummary from "./PriceSummary";
import QuoteForm from "../quote/QuoteForm";
import { useConfigurator } from "@/hooks/useConfigurator";
import { calculatePrice } from "@/lib/pricing";
import { GARAGE_PARAMETERS } from "@/lib/parameters";

const GarageViewer      = dynamic(() => import("./GarageViewer"),      { ssr: false });
const LocalGarageViewer = dynamic(() => import("./LocalGarageViewer"), { ssr: false });

/** Minimum combined side clearance: widthMm >= doorWidthMm + MIN_CLEARANCE */
const MIN_CLEARANCE = 300;

export default function ConfiguratorShell() {
  const { configuration, setParameter } = useConfigurator();

  const pricing = useMemo(() => calculatePrice(configuration), [configuration]);

  const lengthParam     = GARAGE_PARAMETERS.find((p) => p.id === "length")!;
  const widthParam      = GARAGE_PARAMETERS.find((p) => p.id === "width")!;
  const doorWidthParam  = GARAGE_PARAMETERS.find((p) => p.id === "doorWidth")!;
  const doorHeightParam = GARAGE_PARAMETERS.find((p) => p.id === "doorHeight")!;

  const lengthValue     = configuration.parameters.length     ?? lengthParam.defaultValue;
  const widthValue      = configuration.parameters.width      ?? widthParam.defaultValue;
  const doorWidthValue  = configuration.parameters.doorWidth  ?? doorWidthParam.defaultValue;
  const doorHeightValue = configuration.parameters.doorHeight ?? doorHeightParam.defaultValue;

  const validDoorWidthOptions = useMemo(
    () => (doorWidthParam.options ?? []).filter((o) => widthValue >= o.value + MIN_CLEARANCE),
    [widthValue, doorWidthParam.options]
  );

  useEffect(() => {
    if (validDoorWidthOptions.length === 0) return;
    if (!validDoorWidthOptions.find((o) => o.value === doorWidthValue)) {
      setParameter("doorWidth", validDoorWidthOptions[validDoorWidthOptions.length - 1].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthValue]);

  const veggCmm = (widthValue - doorWidthValue) / 2;

  const [viewMode, setViewMode] = useState<"local" | "onshape">("local");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  function handleDevModeClick() {
    if (viewMode === "onshape") {
      setViewMode("local");
    } else {
      setShowPasswordPrompt(true);
      setPasswordInput("");
      setPasswordError(false);
    }
  }

  function submitPassword() {
    if (passwordInput === "123!") {
      setViewMode("onshape");
      setShowPasswordPrompt(false);
    } else {
      setPasswordError(true);
    }
  }

  const viewerProps = {
    lengthMm:     lengthValue,
    widthMm:      widthValue,
    doorWidthMm:  doorWidthValue,
    doorHeightMm: doorHeightValue,
  };

  return (
    <div className="flex flex-col sm:flex-row sm:h-[calc(100vh-11rem)]">
      {/* 3D Viewer */}
      <div className="relative h-[60vw] min-h-[240px] sm:h-auto sm:flex-1 bg-stone-100">

        {/* Toggle */}
        <div className="absolute top-2 left-2 z-10 flex rounded-md bg-black/20 p-0.5 backdrop-blur-sm">
          <button
            onClick={() => setViewMode("local")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === "local"
                ? "bg-white/90 text-gray-800 shadow-sm"
                : "text-white/80 hover:text-white"
            }`}
          >
            Kundevisning
          </button>
          <button
            onClick={handleDevModeClick}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === "onshape"
                ? "bg-white/90 text-gray-800 shadow-sm"
                : "text-white/80 hover:text-white"
            }`}
          >
            Utvikler modus
          </button>
        </div>

        {/* Password modal */}
        {showPasswordPrompt && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="rounded-xl bg-white p-6 shadow-xl w-72">
              <h3 className="text-sm font-semibold text-gray-800 mb-3">Utvikler modus</h3>
              <input
                autoFocus
                type="password"
                placeholder="Passord"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                onKeyDown={(e) => e.key === "Enter" && submitPassword()}
                className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e2520a] ${
                  passwordError ? "border-red-400 bg-red-50" : "border-gray-300"
                }`}
              />
              {passwordError && <p className="mt-1 text-xs text-red-500">Feil passord</p>}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setShowPasswordPrompt(false)}
                  className="flex-1 rounded-lg border border-gray-200 py-2 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Avbryt
                </button>
                <button
                  onClick={submitPassword}
                  className="flex-1 rounded-lg bg-[#e2520a] py-2 text-xs font-medium text-white hover:bg-orange-700"
                >
                  Logg inn
                </button>
              </div>
            </div>
          </div>
        )}

        {viewMode === "local" ? (
          <LocalGarageViewer {...viewerProps} />
        ) : (
          <GarageViewer {...viewerProps} />
        )}
      </div>

      {/* Sidebar */}
      <div className="flex w-full sm:w-[360px] shrink-0 flex-col border-t border-gray-200 sm:border-t-0 sm:border-l bg-white">
        <div className="flex-1 sm:overflow-y-auto p-4 sm:p-6">
          {/* Header with m² */}
          <div className="flex items-baseline justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Konfigurasjon</h2>
            <span className="text-sm text-gray-500">
              <span className="font-semibold text-gray-800">
                {((lengthValue / 1000) * (widthValue / 1000)).toFixed(1)}
              </span>{" "}
              m²
            </span>
          </div>

          {/* Sliders */}
          <div className="mt-4 space-y-6">
            <LengthSlider
              label={lengthParam.label}
              value={lengthValue}
              min={lengthParam.min!}
              max={lengthParam.max!}
              step={lengthParam.step!}
              unit={lengthParam.unit}
              onChange={(value) => setParameter("length", value)}
            />
            <LengthSlider
              label={widthParam.label}
              value={widthValue}
              min={widthParam.min!}
              max={widthParam.max!}
              step={widthParam.step!}
              unit={widthParam.unit}
              onChange={(value) => setParameter("width", value)}
            />
          </div>

          {/* Garage door */}
          <div className="mt-6 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Garasjeport</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bredde på garasjeport
                </label>
                {validDoorWidthOptions.length === 0 ? (
                  <p className="text-xs text-red-500">
                    Garasjebredden må være minst{" "}
                    {Math.min(...(doorWidthParam.options ?? []).map((o) => o.value)) + MIN_CLEARANCE} mm
                    for å velge en port.
                  </p>
                ) : (
                  <select
                    value={doorWidthValue}
                    onChange={(e) => setParameter("doorWidth", Number(e.target.value))}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e2520a]"
                  >
                    {validDoorWidthOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Høyde på garasjeport
                </label>
                <select
                  value={doorHeightValue}
                  onChange={(e) => setParameter("doorHeight", Number(e.target.value))}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e2520a]"
                >
                  {(doorHeightParam.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {validDoorWidthOptions.length > 0 && (
                <p className="text-xs text-gray-400">
                  Sidevegg (VeggC):{" "}
                  <span className="font-medium text-gray-500">
                    {(veggCmm / 1000).toFixed(3)} m
                  </span>{" "}
                  per side
                </p>
              )}
            </div>
          </div>

          <div className="mt-8">
            <PriceSummary pricing={pricing} />
          </div>

          {/* Søknadshjelp – carries current config into the wizard */}
          <div className="mt-4">
            <a
              href={`/soknadshjelp?lengthMm=${lengthValue}&widthMm=${widthValue}&doorWidthMm=${doorWidthValue}&doorHeightMm=${doorHeightValue}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-400 px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-50"
            >
              Trenger du søknadshjelp?
            </a>
          </div>

          <div className="mt-8" id="quote">
            <QuoteForm configuration={configuration} pricing={pricing} />
          </div>
        </div>
      </div>
    </div>
  );
}
