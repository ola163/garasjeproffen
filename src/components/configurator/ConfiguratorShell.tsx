"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import LengthSlider from "./LengthSlider";
import PriceSummary from "./PriceSummary";
import QuoteForm from "../quote/QuoteForm";
import DoorWindowAdder, { type AddedElement, type WallSide } from "./DoorWindowAdder";
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

  const [quoteOpen, setQuoteOpen] = useState(false);
  const quoteRef = useRef<HTMLDivElement>(null);
  const [garageDoorOpen, setGarageDoorOpen] = useState(false);
  const [doorWindowOpen, setDoorWindowOpen] = useState(false);
  const [showDoorWindowAdder, setShowDoorWindowAdder] = useState(false);
  const [addedElements, setAddedElements] = useState<AddedElement[]>([]);

  const ELEMENT_PRICES: Partial<Record<string, number>> = { door: 5995, window1: 2995, window2: 3095, window3: 5895 };
  const ELEMENT_LABELS: Partial<Record<string, string>> = { door: "Dør 90×210", window1: "Vindu 100×50", window2: "Vindu 100×60", window3: "Vindu 100×100" };
  const pricing = useMemo(() => {
    const base = calculatePrice(configuration, packageType, roofType);
    const elementAdjustments = addedElements.flatMap((el) => {
      const unitPrice = ELEMENT_PRICES[el.category];
      if (!unitPrice) return [];
      const qty = el.placement === "both" ? 2 : 1;
      const label = ELEMENT_LABELS[el.category] ?? el.category;
      return [{ label: qty > 1 ? `${label} (×${qty})` : label, amount: unitPrice * qty }];
    });
    const elementTotal = elementAdjustments.reduce((s, a) => s + a.amount, 0);
    return { ...base, adjustments: [...base.adjustments, ...elementAdjustments], totalPrice: base.totalPrice + elementTotal };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configuration, packageType, roofType, addedElements]);

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

  // Shared map placement state — lifted so it persists across view mode switches
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapRotation, setMapRotation] = useState(0);
  // Whether to show the plot view instead of the 3D model in kunde/test mode
  const [showOnPlot, setShowOnPlot] = useState(false);

  // Tomteplassering sidebar state
  const [placementOpen, setPlacementOpen] = useState(false);
  const [kommuneQuery, setKommuneQuery] = useState("");
  const [kommuneSuggestions, setKommuneSuggestions] = useState<{ place_name: string; center: [number, number]; id: string }[]>([]);
  const [kommuneSearching, setKommuneSearching] = useState(false);
  const [selectedKommune, setSelectedKommune] = useState<{ name: string; center: [number, number] } | null>(null);
  const [detectingPos, setDetectingPos] = useState(false);

  // Auto-activate plot view when entering test mode with a plot already selected
  useEffect(() => {
    if (viewMode === "test" && mapCenter) setShowOnPlot(true);
  }, [viewMode, mapCenter]);

  // Auto-open placement section when switching to kart mode
  useEffect(() => {
    if (viewMode === "kart") setPlacementOpen(true);
  }, [viewMode]);

  async function detectPosition() {
    if (!navigator.geolocation) return;
    setDetectingPos(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place,district&language=no&country=no&access_token=${MAPBOX_TOKEN}`
          );
          const data = await res.json();
          const name = data.features?.[0]?.place_name?.split(",")?.[0] ?? "Min posisjon";
          setSelectedKommune({ name, center: [lng, lat] });
          setKommuneQuery(name);
        } catch {
          setSelectedKommune({ name: "Min posisjon", center: [lng, lat] });
        } finally {
          setDetectingPos(false);
          setViewMode("kart");
        }
      },
      () => setDetectingPos(false),
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  async function searchKommune(q: string) {
    if (!q.trim()) { setKommuneSuggestions([]); return; }
    setKommuneSearching(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&country=no&types=district,place&language=no&limit=6`;
      const res = await fetch(url);
      const data = await res.json();
      setKommuneSuggestions(data.features ?? []);
    } finally {
      setKommuneSearching(false);
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

  return (
    <div className="flex flex-col">
      {/* Beta banner */}
      <div className="flex items-start gap-4 bg-red-600 px-5 py-4 sm:px-8">
        <svg className="mt-0.5 h-6 w-6 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        <div>
          <p className="text-base font-bold text-white">Konfiguratoren er under utvikling</p>
          <p className="mt-0.5 text-sm text-red-100">
            Prisestimatet er veiledende og vil avvike fra endelig tilbud. Send en forespørsel så kontakter vi deg med et nøyaktig pristilbud.
          </p>
        </div>
      </div>
    <div className="flex flex-col sm:flex-row sm:h-[calc(100vh-11rem)]">
      {/* 3D Viewer */}
      <div className="relative h-[60vw] min-h-[240px] sm:h-auto sm:flex-1 bg-stone-100">

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
          {isAdmin && (
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
          <GarageMapbox
            lengthMm={lengthValue} widthMm={widthValue} roofType={roofType} buildingType={buildingType}
            externalCenter={mapCenter} externalRotation={mapRotation}
            onCenterChange={(c) => { setMapCenter(c); setShowOnPlot(false); }}
            onRotationChange={setMapRotation}
            defaultCenter={selectedKommune?.center}
            showNeighbors
          />
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
              onChange={setLengthValue}
            />
            <LengthSlider
              label={buildingType === "carport" ? "Endre bredde carport" : widthParam.label}
              value={widthValue}
              min={widthParam.min!}
              max={widthParam.max!}
              step={widthParam.step!}
              unit={widthParam.unit}
              onChange={setWidthValue}
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

          {/* Tomteplassering */}
          <div className="mt-6 border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={() => setPlacementOpen((o) => !o)}
              className="flex w-full items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              <span className="flex items-center gap-2">
                Tomteplassering
                {mapCenter && <span className="text-xs font-normal text-green-600">✓ Plassert</span>}
              </span>
              <svg className={`h-4 w-4 text-gray-400 transition-transform ${placementOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {placementOpen && (
              <div className="mt-4 space-y-3">
                {mapCenter ? (
                  <>
                    <p className="text-xs text-green-700 font-medium">Garasjen er plassert på kartet.</p>
                    {viewMode === "kart" ? (
                      <button
                        onClick={() => { setViewMode("test"); setShowOnPlot(true); }}
                        className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                      >
                        Bekreft plassering ✓
                      </button>
                    ) : (
                      <button
                        onClick={() => setViewMode("kart")}
                        className="w-full rounded-xl border border-gray-200 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        Endre plassering
                      </button>
                    )}
                    <button
                      onClick={() => { setMapCenter(null); setMapRotation(0); }}
                      className="w-full rounded-xl border border-gray-200 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Fjern plassering
                    </button>
                  </>
                ) : (
                  <>
                    {viewMode !== "kart" && (
                      <>
                        <p className="text-xs text-gray-500">
                          Søk etter din kommune, velg plassering i kartet og se garasjen i 3D på tomten.
                        </p>

                        {/* Auto-detect position */}
                        <button
                          type="button"
                          onClick={detectPosition}
                          disabled={detectingPos}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-400 py-2.5 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50 transition-colors"
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
                          <div className="flex-1 border-t border-gray-100" />
                          <span className="text-xs text-gray-400">eller søk</span>
                          <div className="flex-1 border-t border-gray-100" />
                        </div>

                        {/* Kommune search */}
                        <div className="relative">
                          <input
                            type="text"
                            value={kommuneQuery}
                            onChange={(e) => { setKommuneQuery(e.target.value); searchKommune(e.target.value); }}
                            placeholder="Søk etter din kommune…"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                          />
                          {kommuneSearching && (
                            <div className="absolute right-2 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                          )}
                          {kommuneSuggestions.length > 0 && (
                            <ul className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                              {kommuneSuggestions.map((s) => (
                                <li key={s.id}>
                                  <button
                                    onClick={() => {
                                      setKommuneQuery(s.place_name.split(",")[0]);
                                      setSelectedKommune({ name: s.place_name, center: s.center });
                                      setKommuneSuggestions([]);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                                  >
                                    {s.place_name}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {selectedKommune && (
                          <button
                            onClick={() => setViewMode("kart")}
                            className="w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
                          >
                            Velg plassering på kart →
                          </button>
                        )}

                        <button
                          onClick={() => setViewMode("kart")}
                          className="w-full rounded-xl border border-gray-200 py-2 text-sm text-gray-500 hover:bg-gray-50 transition-colors"
                        >
                          Åpne kart direkte
                        </button>
                      </>
                    )}

                    {viewMode === "kart" && (
                      <p className="text-xs text-gray-500 text-center">
                        Klikk i kartet for å plassere garasjen. Skru på 3D for å se nabobygg.
                      </p>
                    )}
                  </>
                )}
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
            <PriceSummary pricing={pricing} onQuoteOpen={() => setQuoteOpen(true)} />
          </div>

          <div className="mt-8" ref={quoteRef}>
            <QuoteForm configuration={configuration} pricing={pricing} packageType={packageType} roofType={roofType} addedElements={addedElements} open={quoteOpen} />
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
