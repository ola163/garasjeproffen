"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import LengthSlider from "./LengthSlider";
import PriceSummary from "./PriceSummary";
import QuoteForm from "../quote/QuoteForm";
import DoorWindowAdder, { type AddedElement, type WallSide } from "./DoorWindowAdder";
import GrunnarbeidWizard, { type GrunnarbeidData, emptyGrunnarbeidData } from "./GrunnarbeidWizard";
import AuthPanel from "../auth/AuthPanel";
import { calculatePrice, type PackageType } from "@/lib/pricing";
import { GARAGE_PARAMETERS } from "@/lib/parameters";

const GarageViewer      = dynamic(() => import("./GarageViewer"),      { ssr: false });
const LocalGarageViewer = dynamic(() => import("./LocalGarageViewer"), { ssr: false });
const GarageMapbox      = dynamic(() => import("./GarageMapbox"),      { ssr: false });

/** Minimum combined side clearance: widthMm >= doorWidthMm + MIN_CLEARANCE */
const MIN_CLEARANCE = 300;
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

const lengthParam     = GARAGE_PARAMETERS.find((p) => p.id === "length")!;
const widthParam      = GARAGE_PARAMETERS.find((p) => p.id === "width")!;
const doorWidthParam  = GARAGE_PARAMETERS.find((p) => p.id === "doorWidth")!;
const doorHeightParam = GARAGE_PARAMETERS.find((p) => p.id === "doorHeight")!;

export default function ConfiguratorShell({ buildingType = "garasje" }: { buildingType?: "garasje" | "carport" }) {
  const searchParams = useSearchParams();
  const initialPackage = searchParams.get("package") === "prefab" ? "prefab" : "materialpakke";

  const urlWidth  = Number(searchParams.get("width"));
  const urlLength = Number(searchParams.get("length"));
  const urlRoof   = searchParams.get("roofType");

  const [packageType, setPackageType] = useState<PackageType>(initialPackage);
  const [roofType, setRoofType] = useState<"saltak" | "flattak">(
    urlRoof === "saltak" ? "saltak" : "flattak"
  );

  // Dimension state — kept in React state (not URL) to avoid router.replace re-mounts
  const [lengthValue, setLengthValue] = useState(
    urlLength >= lengthParam.min! && urlLength <= lengthParam.max! ? urlLength : lengthParam.defaultValue
  );
  const [widthValue, setWidthValue] = useState(
    urlWidth >= widthParam.min! && urlWidth <= widthParam.max! ? urlWidth : widthParam.defaultValue
  );
  const [doorWidthValue,  setDoorWidthValue]   = useState(doorWidthParam.defaultValue);
  const [doorHeightValue, setDoorHeightValue]  = useState(doorHeightParam.defaultValue);

  const configuration = useMemo(() => ({
    parameters: { length: lengthValue, width: widthValue, doorWidth: doorWidthValue, doorHeight: doorHeightValue },
    timestamp: Date.now(),
  }), [lengthValue, widthValue, doorWidthValue, doorHeightValue]);

  const validDoorWidthOptions = useMemo(
    () => (doorWidthParam.options ?? []).filter((o) => widthValue >= o.value + MIN_CLEARANCE),
    [widthValue]
  );

  useEffect(() => {
    if (validDoorWidthOptions.length === 0) return;
    if (!validDoorWidthOptions.find((o) => o.value === doorWidthValue)) {
      setDoorWidthValue(validDoorWidthOptions[validDoorWidthOptions.length - 1].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthValue]);

  const veggCmm = (widthValue - doorWidthValue) / 2;

  const [snapOnly, setSnapOnly] = useState(searchParams.get("snapOnly") === "1");

  // Søknadshjelp priser — fetched once, used when area > 50m²
  const [soknadshjelpPriser, setSoknadshjelpPriser] = useState<{ key: string; label: string; price: number }[]>([]);
  useEffect(() => {
    fetch("/api/admin/soknadshjelp-priser")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSoknadshjelpPriser(d); })
      .catch(() => {});
  }, []);

  function toggleSnapOnly() {
    if (!snapOnly) {
      const nearestLength = Math.max(lengthParam.min!, Math.min(lengthParam.max!, Math.round(lengthValue / 600) * 600));
      const nearestWidth  = Math.max(widthParam.min!,  Math.min(widthParam.max!,  Math.round((widthValue - 200) / 600) * 600 + 200));
      setLengthValue(nearestLength);
      setWidthValue(nearestWidth);
    }
    setSnapOnly((v) => !v);
  }

  const [quoteOpen, setQuoteOpen] = useState(false);
  const quoteRef = useRef<HTMLDivElement>(null);
  const [garageDoorOpen, setGarageDoorOpen] = useState(false);
  const [doorWindowOpen, setDoorWindowOpen] = useState(false);
  const [showDoorWindowAdder, setShowDoorWindowAdder] = useState(false);
  const [addedElements, setAddedElements] = useState<AddedElement[]>([]);
  const [grunnarbeid, setGrunnarbeid] = useState<GrunnarbeidData | null>(null);
  const [showGrunnarbeidWizard, setShowGrunnarbeidWizard] = useState(false);

  const ELEMENT_PRICES: Partial<Record<string, number>> = { door: 5995, window1: 2995, window2: 3095, window3: 5895 };
  const ELEMENT_LABELS: Partial<Record<string, string>> = { door: "Dør 90×210", window1: "Vindu 100×50", window2: "Vindu 100×60", window3: "Vindu 100×100" };
  const GRUNNARBEID_KR_PER_SQM = 2000;
  const pricing = useMemo(() => {
    const base = calculatePrice(configuration, packageType, roofType, buildingType);
    const elementAdjustments = addedElements.flatMap((el) => {
      const unitPrice = ELEMENT_PRICES[el.category];
      if (!unitPrice) return [];
      const qty = el.placement === "both" ? 2 : 1;
      const label = ELEMENT_LABELS[el.category] ?? el.category;
      return [{ label: qty > 1 ? `${label} (×${qty})` : label, amount: unitPrice * qty }];
    });
    const elementTotal = elementAdjustments.reduce((s, a) => s + a.amount, 0);
    return {
      ...base,
      adjustments: [...base.adjustments, ...elementAdjustments],
      totalPrice: base.totalPrice + elementTotal,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuration, packageType, roofType, addedElements, grunnarbeid]);

  const [focusSide, setFocusSide] = useState<WallSide | null>(null);
  const [editingElement, setEditingElement] = useState<AddedElement | null>(null);
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

  useEffect(() => {
    if (quoteOpen && quoteRef.current) {
      quoteRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [quoteOpen]);

  const [viewMode, setViewMode] = useState<"kunde" | "test" | "dev" | "kart">("test");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [previewAsUser, setPreviewAsUser] = useState(false);
  const effectiveAdmin = isAdmin && !previewAsUser;

  useEffect(() => {
    setPreviewAsUser(localStorage.getItem("gp-preview-user") === "1");
    function onPreview() { setPreviewAsUser(localStorage.getItem("gp-preview-user") === "1"); }
    window.addEventListener("gp-preview-user", onPreview);
    return () => window.removeEventListener("gp-preview-user", onPreview);
  }, []);

  // Shared map placement state — lifted so it persists across view mode switches
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapRotation, setMapRotation] = useState(0);
  // Whether to show the plot view instead of the 3D model in kunde/test mode
  const [showOnPlot, setShowOnPlot] = useState(false);

  // Tomteplassering sidebar state
  const [placementOpen, setPlacementOpen] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<{ place_name: string; center: [number, number]; id: string }[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [detectingPos, setDetectingPos] = useState(false);

  // Auto-activate plot view when entering test mode with a plot already selected
  useEffect(() => {
    if (viewMode === "test" && mapCenter) setShowOnPlot(true);
  }, [viewMode, mapCenter]);

  // Auto-open placement section and detect position when switching to kart mode
  useEffect(() => {
    if (viewMode === "kart") {
      setPlacementOpen(true);
      if (!mapCenter) detectPosition();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  function pickAddress(placeName: string, center: [number, number]) {
    setAddressQuery(placeName);
    setAddressSuggestions([]);
    setSelectedAddress(placeName);
    setMapCenter(center);
    try { localStorage.setItem("gp-map-address", placeName); } catch {}
    setViewMode("kart");
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
          const name = data.features?.[0]?.place_name ?? "Min posisjon";
          pickAddress(name, [lng, lat]);
        } catch {
          pickAddress("Min posisjon", [lng, lat]);
        } finally {
          setDetectingPos(false);
        }
      },
      () => setDetectingPos(false),
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  async function searchAddress(q: string) {
    if (!q.trim()) { setAddressSuggestions([]); return; }
    setAddressSearching(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=no&types=address,place&language=no&limit=6`;
      const res = await fetch(url);
      const data = await res.json();
      setAddressSuggestions(data.features ?? []);
    } finally {
      setAddressSearching(false);
    }
  }

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(({ isAdmin, isLoggedIn }) => {
      setIsAdmin(!!isAdmin);
      setIsLoggedIn(!!isLoggedIn);
    }).catch(() => {});
  }, []);

  const viewerProps = {
    lengthMm:      lengthValue,
    widthMm:       widthValue,
    doorWidthMm:   doorWidthValue,
    doorHeightMm:  doorHeightValue,
    roofType,
    focusSide,
    addedElements,
    buildingType,
  };

  const sqm = (lengthValue / 1000) * (widthValue / 1000);
  const perimeterM = 2 * ((lengthValue + widthValue) / 1000);

  return (
    <div className="flex flex-col">
    {showGrunnarbeidWizard && (
      <GrunnarbeidWizard
        sqm={sqm}
        perimeterM={perimeterM}
        lengthMm={lengthValue}
        widthMm={widthValue}
        mapCenter={mapCenter}
        mapRotation={mapRotation}
        initialData={grunnarbeid ?? emptyGrunnarbeidData(sqm, perimeterM)}
        onSave={(data) => setGrunnarbeid(data)}
        onClose={() => setShowGrunnarbeidWizard(false)}
      />
    )}
    <div className="flex flex-col sm:flex-row sm:h-[calc(100vh-11rem)]">
      {/* 3D Viewer */}
      <div className={`relative sm:h-auto sm:flex-1 bg-stone-100 ${viewMode === "kart" ? "h-[80vw] min-h-[320px]" : "h-[60vw] min-h-[240px]"}`}>

        {/* Toggle */}
        <div className="absolute top-2 left-2 z-10 flex rounded-md bg-black/20 p-0.5 backdrop-blur-sm">
          <button
            onClick={() => setViewMode("kunde")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === "kunde" ? "bg-white/90 text-gray-800 shadow-sm" : "text-white/80 hover:text-white"
            }`}
          >
            Kundevisning
          </button>
          <button
            onClick={() => setViewMode("test")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === "test" ? "bg-white/90 text-gray-800 shadow-sm" : "text-white/80 hover:text-white"
            }`}
          >
            Test visning
          </button>
          <button
            onClick={() => setViewMode("kart")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === "kart" ? "bg-white/90 text-gray-800 shadow-sm" : "text-white/80 hover:text-white"
            }`}
          >
            Tomteplassering
          </button>
          {effectiveAdmin && (
            <button
              onClick={() => setViewMode("dev")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === "dev" ? "bg-white/90 text-gray-800 shadow-sm" : "text-white/80 hover:text-white"
              }`}
            >
              Utvikler modus
            </button>
          )}
        </div>

        {/* Toggle button — switches between 3D model and plot view */}
        {(viewMode === "kunde" || viewMode === "test") && mapCenter && (
          <button
            onClick={() => setShowOnPlot((v) => !v)}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-1.5 text-xs font-semibold text-gray-700 shadow-md hover:bg-orange-50 hover:text-orange-600 transition-colors backdrop-blur-sm"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {showOnPlot
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                : <><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></>
              }
            </svg>
            {showOnPlot ? "Vis 3D-modell" : "Vis på tomt"}
          </button>
        )}

        {viewMode === "kunde" && !showOnPlot && <LocalGarageViewer {...viewerProps} />}
        {viewMode === "kunde" && showOnPlot && mapCenter && (
          <GarageMapbox
            lengthMm={lengthValue} widthMm={widthValue} roofType={roofType} buildingType={buildingType}
            externalCenter={mapCenter} externalRotation={mapRotation}
            readOnly forceIs3D
          />
        )}
        {viewMode === "test" && !showOnPlot && <GarageViewer {...viewerProps} rotationDeg={mapRotation} />}
        {viewMode === "test" && showOnPlot && mapCenter && (
          <GarageMapbox
            lengthMm={lengthValue} widthMm={widthValue} roofType={roofType} buildingType={buildingType}
            externalCenter={mapCenter} externalRotation={mapRotation}
            readOnly forceIs3D streetView
          />
        )}
        {viewMode === "dev" && <LocalGarageViewer {...viewerProps} />}
        {viewMode === "kart" && (
          isLoggedIn ? (
            <GarageMapbox
              lengthMm={lengthValue} widthMm={widthValue} roofType={roofType} buildingType={buildingType}
              externalCenter={mapCenter} externalRotation={mapRotation}
              onCenterChange={(c) => { setMapCenter(c); setShowOnPlot(false); }}
              onRotationChange={setMapRotation}
              defaultCenter={mapCenter ?? undefined}
              showNeighbors
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-stone-100 p-8 text-center">
              <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-gray-700">Logg inn for å bruke tomteplassering</p>
                <p className="mt-1 text-xs text-gray-400">Plasser {buildingType === "carport" ? "carporten" : "garasjen"} din på din tomt med satellittkart.</p>
              </div>
              <a href="/min-side" className="rounded-lg bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors">
                Logg inn / Registrer deg
              </a>
            </div>
          )
        )}
      </div>

      {/* 50 m² warning — mobile only, sits between viewer and sidebar */}
      {sqm > 50 && (
        <div className="sm:hidden flex items-center gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <svg className="h-3 w-3 shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>Over 50 m² krever <strong>ansvarlig søker</strong> — vi hjelper deg.</span>
        </div>
      )}

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
            {(() => {
              const sqm = (lengthValue / 1000) * (widthValue / 1000);
              const over50 = sqm > 50;
              return (
                <span className={`text-sm font-semibold ${over50 ? "text-red-600" : "text-gray-800"}`}>
                  {sqm.toFixed(1)} m²
                </span>
              );
            })()}
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

          {/* Snap-only toggle */}
          {buildingType !== "carport" && (
            <label className="mt-5 flex cursor-pointer items-center gap-2.5 select-none">
              <input
                type="checkbox"
                checked={snapOnly}
                onChange={toggleSnapOnly}
                className="h-4 w-4 accent-green-600 cursor-pointer"
              />
              <span className="text-sm text-gray-700">Lås til standard mål</span>
              <span className="text-xs font-medium text-green-600">— gir opptil 10% rabatt</span>
            </label>
          )}

          {/* Sliders */}
          <div className="mt-4 space-y-6">
            <LengthSlider
              label={buildingType === "carport" ? "Endre lengde carport" : lengthParam.label}
              value={lengthValue}
              min={snapOnly ? Math.ceil(lengthParam.min! / 600) * 600 : lengthParam.min!}
              max={snapOnly ? Math.floor(lengthParam.max! / 600) * 600 : lengthParam.max!}
              step={snapOnly ? 600 : lengthParam.step!}
              unit={lengthParam.unit}
              onChange={setLengthValue}
              disableSnap={buildingType === "carport"}
            />
            <LengthSlider
              label={buildingType === "carport" ? "Endre bredde carport" : widthParam.label}
              value={widthValue}
              min={snapOnly ? Math.ceil((widthParam.min! - 200) / 600) * 600 + 200 : widthParam.min!}
              max={snapOnly ? Math.floor((widthParam.max! - 200) / 600) * 600 + 200 : widthParam.max!}
              step={snapOnly ? 600 : widthParam.step!}
              unit={widthParam.unit}
              onChange={setWidthValue}
              snapOffset={200}
            />
          </div>

          {buildingType !== "carport" && !snapOnly && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              Grønt mål = standard 60 cm-intervall – ett grønt mål gir 5%, begge gir 10% rimeligere
            </p>
          )}

          {/* 50 m² warning — desktop only */}
          {sqm > 50 && (
            <div className="hidden sm:flex mt-3 items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
              <svg className="h-3 w-3 shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Over 50 m² krever <strong>ansvarlig søker</strong> — vi hjelper deg.</span>
            </div>
          )}

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
                    onChange={(e) => setDoorWidthValue(Number(e.target.value))}
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
                  onChange={(e) => setDoorHeightValue(Number(e.target.value))}
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
                {!showDoorWindowAdder ? (
                  <button
                    type="button"
                    onClick={() => { setEditingElement(null); setShowDoorWindowAdder(true); }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors"
                  >
                    <span>+</span>
                    <span>Legg til</span>
                  </button>
                ) : (
                  <DoorWindowAdder
                    existingElements={addedElements}
                    widthMm={widthValue}
                    doorWidthMm={doorWidthValue}
                    startWith={editingElement ? { side: editingElement.side, category: editingElement.category } : undefined}
                    onFocusSide={setFocusSide}
                    onAdd={(el) => setAddedElements((prev) => [...prev, el])}
                    onClose={() => { setShowDoorWindowAdder(false); setEditingElement(null); setFocusSide(null); }}
                  />
                )}
                {addedElements.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {addedElements.map((el, i) => (
                      <li key={i} className="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-700">
                        <span>
                          {el.category === "door" ? "Dør 90×210" : el.category === "window1" ? "Vindu 100×50" : el.category === "window2" ? "Vindu 100×60" : "Vindu 100×100"}
                          {" – "}
                          {el.side === "front" ? "Front" : el.side === "back" ? "Bak" : el.side === "left" ? "Venstre" : "Høyre"}
                          {" / "}
                          {el.placement === "left" ? "Venstre" : el.placement === "right" ? "Høyre" : "Begge"}
                        </span>
                        <div className="ml-2 flex items-center gap-2">
                          <button
                            onClick={() => {
                              setAddedElements((prev) => prev.filter((_, j) => j !== i));
                              setEditingElement(el);
                              setShowDoorWindowAdder(true);
                            }}
                            className="text-xs text-orange-500 hover:text-orange-700 font-medium"
                          >
                            Endre
                          </button>
                          <button
                            onClick={() => setAddedElements((prev) => prev.filter((_, j) => j !== i))}
                            className="text-gray-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>}

          {/* Grunn- og betongarbeid */}
          <div className="mt-6 border-t border-gray-100 pt-5">
            {grunnarbeid === null ? (
              <button
                type="button"
                onClick={() => setShowGrunnarbeidWizard(true)}
                className="flex w-full items-center gap-2 rounded-lg border-2 border-dashed border-orange-300 px-4 py-3 text-sm font-semibold text-orange-500 hover:border-orange-400 hover:bg-orange-50 transition-colors"
              >
                <span className="text-lg leading-none">+</span>
                <span>Legg til grunn- og betongarbeid</span>
                <span className="ml-auto text-xs font-normal text-gray-400">
                  ~{new Intl.NumberFormat("nb-NO").format(
                    Math.round(((lengthValue / 1000) * (widthValue / 1000)) * GRUNNARBEID_KR_PER_SQM / 500) * 500
                  )} kr
                </span>
              </button>
            ) : (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-green-800">Lagt til</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      {[
                        grunnarbeid.utgraving && "Utgraving",
                        grunnarbeid.betongdekke && "Betongdekke",
                        grunnarbeid.ringmur && "Ringmur",
                      ].filter(Boolean).join(" · ") || "Tilpasset valg"}
                      {grunnarbeid.betongtype ? ` · ${grunnarbeid.betongtype}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={() => setShowGrunnarbeidWizard(true)}
                      className="text-xs font-medium text-orange-600 hover:text-orange-700"
                    >
                      Rediger
                    </button>
                    <button
                      onClick={() => setGrunnarbeid(null)}
                      className="text-gray-400 hover:text-red-500 text-sm"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-gray-400">
              Estimat ~{GRUNNARBEID_KR_PER_SQM.toLocaleString("nb-NO")} kr/m² · Endelig pris etter befaring
            </p>
          </div>

          {/* Tomteplassering */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${mapCenter ? "bg-green-100" : "bg-white border border-gray-200"}`}>
                  <svg className={`h-4 w-4 ${mapCenter ? "text-green-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Tomteplassering</p>
                  <p className="text-xs text-gray-400">Se {buildingType === "carport" ? "carporten" : "garasjen"} på din tomt</p>
                </div>
              </div>
              {mapCenter && (
                <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  ✓ Plassert
                </span>
              )}
            </div>

            {/* Content */}
            {mapCenter ? (
              <div className="space-y-2 mt-3">
                {viewMode === "kart" ? (
                  <button
                    onClick={() => { setViewMode("test"); setShowOnPlot(true); }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Bekreft plassering
                  </button>
                ) : (
                  <button
                    onClick={() => setViewMode("kart")}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Endre plassering
                  </button>
                )}
                <button
                  onClick={() => { setMapCenter(null); setMapRotation(0); }}
                  className="w-full rounded-lg py-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  Fjern plassering
                </button>
              </div>
            ) : viewMode === "kart" ? (
              <p className="mt-1 text-xs text-gray-500 text-center leading-relaxed">
                Klikk i kartet for å plassere {buildingType === "carport" ? "carporten" : "garasjen"}.<br />
                Skru på 3D for å se nabobygg.
              </p>
            ) : (
              <div className="space-y-2.5 mt-1">
                {/* Auto-detect */}
                <button
                  type="button"
                  onClick={detectPosition}
                  disabled={detectingPos}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
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

                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-gray-200" />
                  <span className="text-xs text-gray-400">eller søk</span>
                  <div className="flex-1 border-t border-gray-200" />
                </div>

                {/* Address search */}
                <div className="relative">
                  <input
                    type="text"
                    value={addressQuery}
                    onChange={(e) => { setAddressQuery(e.target.value); searchAddress(e.target.value); }}
                    placeholder="Skriv inn din adresse…"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  {addressSearching && (
                    <div className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                  )}
                  {addressSuggestions.length > 0 && (
                    <ul className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                      {addressSuggestions.map((s) => (
                        <li key={s.id}>
                          <button
                            onClick={() => pickAddress(s.place_name, s.center)}
                            className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                          >
                            {s.place_name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {selectedAddress && (
                  <p className="text-xs font-medium text-green-700">✓ {selectedAddress}</p>
                )}

                <button
                  onClick={() => setViewMode("kart")}
                  className="w-full rounded-lg border border-gray-200 bg-white py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Åpne kart direkte
                </button>
              </div>
            )}
          </div>


          <div className="mt-6 rounded-lg bg-red-50 border border-red-200 p-3">
            <p className="text-xs text-red-600 leading-relaxed">
              <span className="font-semibold">Konfiguratoren er under utvikling.</span>{" "}
              Prisene kan avvike fra endelig tilbud. Ta kontakt for et manuelt pristilbud.
            </p>
          </div>

          <div className="mt-3">
            <PriceSummary
              pricing={pricing}
              onQuoteOpen={() => setQuoteOpen(true)}
              adminContent={effectiveAdmin ? (() => {
                const sqm    = (lengthValue / 1000) * (widthValue / 1000);
                const widthM = widthValue / 1000;
                const isCarportType = buildingType === "carport";
                const isFlat = roofType === "flattak" || isCarportType;
                const activeRow = isCarportType ? "carport" : roofType === "saltak" ? "saltak" : "flattak";
                const widthTier = widthM > 8.0 ? "manual" : widthM > 7.2 ? "high" : isFlat && widthM > 5.0 ? "low-flat" : !isFlat && widthM > 6.2 ? "low-saltak" : "none";
                const widthSnapped  = !isCarportType && (widthValue - 200) % 600 === 0;
                const lengthSnapped = !isCarportType && lengthValue % 600 === 0;
                const snappedCount  = (widthSnapped ? 1 : 0) + (lengthSnapped ? 1 : 0);
                const hi = "font-semibold text-green-700 bg-green-50 rounded px-1 -mx-1";
                const row = (key: string) => key === activeRow ? "text-green-700 font-semibold" : "";
                return (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                    <p className="font-semibold mb-2">Admin – prisstruktur</p>
                    <table className="w-full mb-2">
                      <thead>
                        <tr className="text-left text-blue-600">
                          <th className="pr-2 font-medium">Type</th>
                          <th className="pr-2 font-medium text-right">Materialpakke</th>
                          <th className="font-medium text-right">Prefab</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-100">
                        <tr className={row("saltak")}>
                          <td className="py-0.5 pr-2">Garasje saltak</td>
                          <td className={`text-right pr-2 ${activeRow === "saltak" && packageType === "materialpakke" ? "text-green-700 font-bold" : ""}`}>4 125 kr/m²</td>
                          <td className={`text-right ${activeRow === "saltak" && packageType === "prefab" ? "text-green-700 font-bold" : ""}`}>7 700 kr/m²</td>
                        </tr>
                        <tr className={row("flattak")}>
                          <td className="py-0.5 pr-2">Garasje flatt tak</td>
                          <td className={`text-right pr-2 ${activeRow === "flattak" && packageType === "materialpakke" ? "text-green-700 font-bold" : ""}`}>3 850 kr/m²</td>
                          <td className={`text-right ${activeRow === "flattak" && packageType === "prefab" ? "text-green-700 font-bold" : ""}`}>7 150 kr/m²</td>
                        </tr>
                        <tr className={row("carport")}>
                          <td className="py-0.5 pr-2">Carport</td>
                          <td className={`text-right pr-2 ${activeRow === "carport" && packageType === "materialpakke" ? "text-green-700 font-bold" : ""}`}>3 500 kr/m²</td>
                          <td className={`text-right ${activeRow === "carport" && packageType === "prefab" ? "text-green-700 font-bold" : ""}`}>6 500 kr/m²</td>
                        </tr>
                      </tbody>
                    </table>
                    <p className="font-medium mt-2 mb-1 text-blue-700">Arealtillegg</p>
                    <ul className="space-y-0.5">
                      <li className={sqm > 70 ? hi : ""}>Over 70 m²: Manuelt tilbud</li>
                    </ul>
                    <p className="font-medium mt-2 mb-1 text-blue-700">Breddetillegg</p>
                    <ul className="space-y-0.5">
                      <li className={widthTier === "low-flat" ? hi : ""}>Flatt tak / carport: over 5,0 m: +5 %</li>
                      <li className={widthTier === "low-saltak" ? hi : ""}>Saltak: over 6,2 m: +5 %</li>
                      <li className={widthTier === "high" ? hi : ""}>Over 7,2 m: +10 %</li>
                      <li className={widthTier === "manual" ? hi : ""}>Over 8,0 m: Manuelt tilbud</li>
                    </ul>
                    <p className="font-medium mt-2 mb-1 text-blue-700">Snap-rabatt (kun garasje)</p>
                    <ul className="space-y-0.5">
                      <li className={snappedCount === 1 ? hi : ""}>1 grønt mål: −5 %</li>
                      <li className={snappedCount === 2 ? hi : ""}>2 grønne mål: −10 %</li>
                    </ul>
                  </div>
                );
              })() : undefined}
              soknadshjelp={buildingType !== "carport" && (lengthValue / 1000) * (widthValue / 1000) > 50 && soknadshjelpPriser.length > 0 ? soknadshjelpPriser : undefined}
            />
          </div>

          <div className="mt-8" ref={quoteRef}>
            <QuoteForm configuration={configuration} pricing={pricing} packageType={packageType} roofType={roofType} addedElements={addedElements} grunnarbeid={grunnarbeid ?? undefined} open={quoteOpen} />
          </div>

          <AuthPanel
            currentConfig={{
              packageType,
              roofType,
              length: lengthValue,
              width: widthValue,
              doorWidth: doorWidthValue,
              doorHeight: doorHeightValue,
              addedElements,
            }}
            onLoadConfig={(cfg) => {
              setPackageType(cfg.packageType as PackageType);
              setRoofType(cfg.roofType as "saltak" | "flattak");
              setLengthValue(cfg.length);
              setWidthValue(cfg.width);
              setDoorWidthValue(cfg.doorWidth);
              setDoorHeightValue(cfg.doorHeight);
              setAddedElements(cfg.addedElements as AddedElement[]);
            }}
          />
        </div>
      </div>
    </div>
    </div>
  );
}
