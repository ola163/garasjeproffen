"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import LengthSlider from "./LengthSlider";
import PriceSummary from "./PriceSummary";
import QuoteForm from "../quote/QuoteForm";
import { useConfigurator } from "@/hooks/useConfigurator";
import { calculatePrice, type PackageType } from "@/lib/pricing";
import { GARAGE_PARAMETERS } from "@/lib/parameters";

const GarageViewer      = dynamic(() => import("./GarageViewer"),      { ssr: false });
const LocalGarageViewer = dynamic(() => import("./LocalGarageViewer"), { ssr: false });

/** Minimum combined side clearance: widthMm >= doorWidthMm + MIN_CLEARANCE */
const MIN_CLEARANCE = 300;

export default function ConfiguratorShell({ buildingType = "garasje" }: { buildingType?: "garasje" | "carport" }) {
  const { configuration, setParameter } = useConfigurator();

  const searchParams = useSearchParams();
  const initialPackage = searchParams.get("package") === "prefab" ? "prefab" : "materialpakke";
  const [packageType, setPackageType] = useState<PackageType>(initialPackage);
  const [roofType, setRoofType] = useState<"saltak" | "flattak">("flattak");
  const pricing = useMemo(() => calculatePrice(configuration, packageType, roofType), [configuration, packageType, roofType]);

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

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [garageDoorOpen, setGarageDoorOpen] = useState(false);
  const [doorWindowOpen, setDoorWindowOpen] = useState(false);
  const [imageCollapsed, setImageCollapsed] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    function check() {
      const sidebarScroll = container?.scrollTop ?? 0;
      if (sidebarScroll > 20 || window.scrollY > 20) {
        setImageCollapsed(true);
      }
    }
    container?.addEventListener("scroll", check);
    window.addEventListener("scroll", check);
    return () => {
      container?.removeEventListener("scroll", check);
      window.removeEventListener("scroll", check);
    };
  }, []);

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
    roofType,
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
        <div ref={scrollContainerRef} className="flex-1 sm:overflow-y-auto p-4 sm:p-6">
          {/* Package illustration */}
          <div className={`overflow-hidden transition-all duration-300 sm:max-h-[500px] sm:opacity-100 sm:mb-3 ${imageCollapsed ? "max-h-0 opacity-0 mb-0" : "max-h-[500px] opacity-100 mb-3"}`}>
            {packageType === "prefab" ? (
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                <Image
                  src="/prefab.jpg"
                  alt="Prefabrikert løsning"
                  width={800}
                  height={500}
                  className="w-full h-auto"
                />
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-gray-200 bg-white">
                <Image
                  src="/material.jpg"
                  alt="Materialpakke"
                  width={800}
                  height={500}
                  className="w-full h-auto"
                />
              </div>
            )}
          </div>

          {/* Package selector */}
          <div className="mt-3 flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            <button
              onClick={() => { setPackageType("materialpakke"); setImageCollapsed(false); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                packageType === "materialpakke"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Materialpakke
            </button>
            <button
              onClick={() => { setPackageType("prefab"); setImageCollapsed(false); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                packageType === "prefab"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Prefabrikert løsning
            </button>
          </div>

          {/* Header with m² */}
          <div className="mt-4 flex items-baseline justify-between">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              {buildingType === "carport" ? "Carport" : "Garasje"}
            </h2>
            <span className="text-sm text-gray-500">
              <span className="font-semibold text-gray-800">
                {((lengthValue / 1000) * (widthValue / 1000)).toFixed(1)}
              </span>{" "}
              m²
            </span>
          </div>

          {/* Roof type selector — hidden for carport (always flattak) */}
          {buildingType !== "carport" && <div className="mt-4 flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            <button
              onClick={() => setRoofType("flattak")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                roofType === "flattak"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Flatt tak
            </button>
            <button
              onClick={() => setRoofType("saltak")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${
                roofType === "saltak"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Saltak
            </button>
          </div>}

          {/* Sliders */}
          <div className="mt-6 space-y-6">
            <LengthSlider
              label={buildingType === "carport" ? "Endre lengde carport" : lengthParam.label}
              value={lengthValue}
              min={lengthParam.min!}
              max={lengthParam.max!}
              step={lengthParam.step!}
              unit={lengthParam.unit}
              onChange={(value) => setParameter("length", value)}
            />
            <LengthSlider
              label={buildingType === "carport" ? "Endre bredde carport" : widthParam.label}
              value={widthValue}
              min={widthParam.min!}
              max={widthParam.max!}
              step={widthParam.step!}
              unit={widthParam.unit}
              onChange={(value) => setParameter("width", value)}
            />
          </div>

          {/* Garage door — hidden for carport */}
          {buildingType !== "carport" && <div className="mt-6 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={() => setGarageDoorOpen((o) => !o)}
              className="flex w-full items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              <span>Garasjeport</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-gray-400 transition-transform ${garageDoorOpen ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {garageDoorOpen && <div className="mt-4 space-y-4">
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
            </div>}
          </div>}

          {/* Dør og vindu — hidden for carport */}
          {buildingType !== "carport" && <div className="mt-6 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={() => setDoorWindowOpen((o) => !o)}
              className="flex w-full items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              <span>Dør og vindu</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-4 w-4 text-gray-400 transition-transform ${doorWindowOpen ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {doorWindowOpen && (
              <div className="mt-4">
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors"
                >
                  <span>+</span>
                  <span>Legg til</span>
                </button>
              </div>
            )}
          </div>}

          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-xs text-red-600 leading-relaxed">
              <span className="font-semibold">Konfiguratoren er under utvikling.</span>{" "}
              Prisene kan avvike fra endelig tilbud. Ta kontakt for et manuelt pristilbud.
            </p>
          </div>

          <div className="mt-3">
            <PriceSummary pricing={pricing} onQuoteOpen={() => setQuoteOpen(true)} />
          </div>

          <div className="mt-8" id="quote">
            <QuoteForm configuration={configuration} pricing={pricing} packageType={packageType} open={quoteOpen} />
          </div>
        </div>
      </div>
    </div>
  );
}
