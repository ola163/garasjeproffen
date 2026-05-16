"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import LengthSlider from "./LengthSlider";
import PriceSummary from "./PriceSummary";
import QuoteForm from "../quote/QuoteForm";
import DoorWindowAdder, { filterValidElements, type AddedElement, type WallSide, type ElementCategory } from "./DoorWindowAdder";
import GrunnarbeidWizard, { type GrunnarbeidData, emptyGrunnarbeidData } from "./GrunnarbeidWizard";
import AuthPanel from "../auth/AuthPanel";
import { calculatePrice, type PackageType } from "@/lib/pricing";
import { GARAGE_PARAMETERS } from "@/lib/parameters";

const GarageViewer      = dynamic(() => import("./GarageViewer"),      { ssr: false });
const LocalGarageViewer = dynamic(() => import("./LocalGarageViewer"), { ssr: false });
const GarageMapbox      = dynamic(() => import("./GarageMapbox"),      { ssr: false });
const GarageMålAdmin    = dynamic(() => import("./GarageMålAdmin"),    { ssr: false });

/** Minimum combined side clearance: widthMm >= doorWidthMm + MIN_CLEARANCE */
const MIN_CLEARANCE = 300;

type DemoEl = { side: WallSide; category: ElementCategory; placement: "left" | "right" | "both" };
const DEMO_STEPS: Array<{
  width: number; length: number; roofType: "flattak" | "saltak";
  doorWidth: number; doorHeight: number;
  label: string; desc: string;
  elements: DemoEl[];
  q: string; a: string;
}> = [
  { width: 5000, length: 6000, roofType: "flattak", doorWidth: 2500, doorHeight: 2125,
    label: "Enkel garasje", desc: "5 × 6 m med flatt tak – plass til én bil og god lagringsplass",
    elements: [],
    q: "Hva koster en garasje fra GarasjeProffen?", a: "Materialpakke fra ca. 155 000 kr – prefab fra ca. 290 000 kr" },
  { width: 6200, length: 7800, roofType: "flattak", doorWidth: 2500, doorHeight: 2125,
    label: "Populær størrelse", desc: "6,2 × 7,8 m – en av våre mest bestilte garasjer",
    elements: [{ side: "back", category: "window2", placement: "both" }],
    q: "Hva er leveringstiden?", a: "Vanligvis 4–8 uker fra bestilling til montering" },
  { width: 7800, length: 9600, roofType: "flattak", doorWidth: 5000, doorHeight: 2250,
    label: "Dobbel garasje", desc: "7,8 × 9,6 m med dobbel port – plass til to biler",
    elements: [
      { side: "back", category: "window2", placement: "both" },
      { side: "right", category: "door", placement: "right" },
    ],
    q: "Kan jeg velge dobbel garasjeport?", a: "Ja! Opp til 5 meter bred port er inkludert i konfiguratoren" },
  { width: 5600, length: 6000, roofType: "saltak", doorWidth: 2500, doorHeight: 2125,
    label: "Saltak garasje", desc: "Tradisjonell stil som passer til de fleste hus på Jæren",
    elements: [{ side: "back", category: "window1", placement: "both" }],
    q: "Trenger jeg byggesøknad?", a: "Nei, ikke for garasjer under 50 m² – vi hjelper deg uansett" },
  { width: 7200, length: 8400, roofType: "saltak", doorWidth: 5000, doorHeight: 2250,
    label: "Stor saltak med dobbel port", desc: "7,2 × 8,4 m – romslig løsning med plass til alt",
    elements: [
      { side: "back", category: "window2", placement: "both" },
      { side: "left", category: "window1", placement: "left" },
    ],
    q: "Leverer dere i hele Rogaland?", a: "Ja! Vi leverer og monterer på Jæren og i hele Rogaland" },
];
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

  const isDemoRef = useRef(false);

  useEffect(() => {
    if (isDemoRef.current) return; // skip during demo animation
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
  // Elements removed because they didn't fit — restored when they fit again
  const sizeRemovedRef = useRef<AddedElement[]>([]);

  useEffect(() => {
    const hasPort = roofType === "flattak" && buildingType !== "carport";
    const filtered = filterValidElements(addedElements, widthValue / 1000, doorWidthValue / 1000, hasPort);

    // Save newly invalid elements into the ref
    const newlyRemoved = addedElements.filter(
      el => !filtered.some(f => f.side === el.side && f.category === el.category && f.placement === el.placement)
    );
    if (newlyRemoved.length > 0) {
      sizeRemovedRef.current = [
        ...sizeRemovedRef.current,
        ...newlyRemoved.filter(r => !sizeRemovedRef.current.some(
          s => s.side === r.side && s.category === r.category && s.placement === r.placement
        )),
      ];
    }

    // Re-add elements from the ref that now fit and aren't already present
    const toReAdd = sizeRemovedRef.current.filter(el => {
      const fits = filterValidElements([el], widthValue / 1000, doorWidthValue / 1000, hasPort).length > 0;
      const present = filtered.some(f => f.side === el.side && f.category === el.category && f.placement === el.placement);
      return fits && !present;
    });

    if (toReAdd.length > 0) {
      sizeRemovedRef.current = sizeRemovedRef.current.filter(
        el => !toReAdd.some(r => r.side === el.side && r.category === el.category && r.placement === el.placement)
      );
      setAddedElements([...filtered, ...toReAdd]);
    } else if (filtered.length < addedElements.length) {
      setAddedElements(filtered);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthValue, doorWidthValue, roofType, buildingType]);

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

  const [viewMode, setViewMode] = useState<"test" | "dev" | "kart" | "mål" | "demo">("test");
  const [demoStep, setDemoStep] = useState(0);
  const [demoDoorOpen, setDemoDoorOpen] = useState(false);
  const [captionVisible, setCaptionVisible] = useState(true);
  const [qaPhase, setQaPhase] = useState<"none" | "q" | "qa">("none");
  const [storskjerm, setStorskjerm] = useState(false);
  const [mobileLandscape, setMobileLandscape] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape) and (max-height: 500px)");
    const check = () => setMobileLandscape(mq.matches);
    check();
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, []);
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
  useEffect(() => {
    try {
      const lat = parseFloat(localStorage.getItem("gp-map-lat") ?? "");
      const lng = parseFloat(localStorage.getItem("gp-map-lng") ?? "");
      if (!isNaN(lat) && !isNaN(lng)) setMapCenter([lng, lat]);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [mapRotation, setMapRotation] = useState(0);
  // Whether to show the plot view instead of the 3D model in kunde/test mode

  // Restore saved address label for a pre-loaded map position
  useEffect(() => {
    if (!mapCenter) return;
    try {
      const addr = localStorage.getItem("gp-map-address");
      if (addr) { setAddressQuery(addr); setSelectedAddress(addr); }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tomteplassering sidebar state
  const [placementOpen, setPlacementOpen] = useState(false);
  const [addressQuery, setAddressQuery] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<{ place_name: string; center: [number, number]; id: string }[]>([]);
  const [addressSearching, setAddressSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [detectingPos, setDetectingPos] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Auto-open placement section when switching to kart mode
  useEffect(() => {
    if (viewMode === "kart") setPlacementOpen(true);
  }, [viewMode]);

  function pickAddress(placeName: string, center: [number, number], fromGeo = false) {
    setAddressQuery(placeName);
    setAddressSuggestions([]);
    setSelectedAddress(placeName);
    setMapCenter(center);
    try {
      localStorage.setItem("gp-map-address", placeName);
      localStorage.setItem("gp-map-lat", String(center[1]));
      localStorage.setItem("gp-map-lng", String(center[0]));
    } catch {}
    if (fromGeo) {
      fetch("/api/profile/location", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: center[1], lng: center[0], address: placeName }),
      }).catch(() => {});
    }
    setViewMode("kart");
  }

  async function detectPosition() {
    if (!navigator.geolocation) {
      setGeoError("Nettleseren støtter ikke posisjonstjenester.");
      return;
    }
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
        pickAddress(name, [lng, lat], true);
        setDetectingPos(false);
      },
      (err) => {
        setDetectingPos(false);
        if (err.code === 1) {
          setGeoError("Posisjon ikke tillatt – skriv inn adressen din under.");
        } else {
          setGeoError("Kunne ikke hente posisjon. Prøv å skrive inn adressen.");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
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

  // Demo: smooth animation between steps
  useEffect(() => {
    if (viewMode !== "demo") {
      isDemoRef.current = false;
      setDemoDoorOpen(false);
      return;
    }
    isDemoRef.current = true;

    let stepIndex = 0;
    let phase: "animating" | "holding" = "holding";
    let phaseStart = Date.now();
    let fromWidth = DEMO_STEPS[0].width;
    let fromLength = DEMO_STEPS[0].length;

    const applyHold = (idx: number) => {
      const step = DEMO_STEPS[idx];
      setDemoStep(idx);
      setAddedElements(step.elements);
      setDemoDoorOpen(true);
      setQaPhase("q");
      setTimeout(() => setQaPhase("qa"), 2000);
    };

    const first = DEMO_STEPS[0];
    setWidthValue(first.width);
    setLengthValue(first.length);
    setRoofType(first.roofType);
    setDoorWidthValue(first.doorWidth);
    setDoorHeightValue(first.doorHeight);
    setCaptionVisible(true);
    applyHold(0);

    const ANIMATE_MS = 3000;
    const HOLD_MS = 4000;

    const tick = setInterval(() => {
      const elapsed = Date.now() - phaseStart;
      if (phase === "holding") {
        if (elapsed >= HOLD_MS) {
          fromWidth = DEMO_STEPS[stepIndex].width;
          fromLength = DEMO_STEPS[stepIndex].length;
          stepIndex = (stepIndex + 1) % DEMO_STEPS.length;
          setDemoDoorOpen(false);
          setQaPhase("none");
          setAddedElements([]);
          setCaptionVisible(false);
          setTimeout(() => setCaptionVisible(true), 400);
          phase = "animating";
          phaseStart = Date.now();
        }
      } else {
        const t = Math.min(elapsed / ANIMATE_MS, 1);
        const e = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
        const target = DEMO_STEPS[stepIndex];
        setWidthValue(Math.round(fromWidth + (target.width - fromWidth) * e));
        setLengthValue(Math.round(fromLength + (target.length - fromLength) * e));
        if (t >= 1) {
          setRoofType(target.roofType);
          setDoorWidthValue(target.doorWidth);
          setDoorHeightValue(target.doorHeight);
          applyHold(stepIndex);
          phase = "holding";
          phaseStart = Date.now();
        }
      }
    }, 50);

    return () => { clearInterval(tick); isDemoRef.current = false; setDemoDoorOpen(false); setQaPhase("none"); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  // Demo: auto-start from ?demo=1 URL param
  useEffect(() => {
    if (searchParams.get("demo") === "1") { setDemoStep(0); setViewMode("demo"); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className={`flex flex-col ${mobileLandscape ? "" : "sm:flex-row sm:h-[calc(100vh-11rem)]"}`}>
      {/* 3D Viewer */}
      <div className={`relative bg-stone-100 ${
        mobileLandscape
          ? "h-dvh w-full"
          : viewMode === "kart"
            ? "h-[80vw] min-h-[320px] sm:h-auto sm:flex-1"
            : "h-[60vw] min-h-[240px] sm:h-auto sm:flex-1"
      }`}>

        {/* Toggle */}
        <div className="absolute top-2 left-2 z-20 flex rounded-md bg-black/20 p-0.5 backdrop-blur-sm">
          <button
            onClick={() => setViewMode("test")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === "test" ? "bg-white/90 text-gray-800 shadow-sm" : "text-white/80 hover:text-white"
            }`}
          >
            3D-visning
          </button>
          <button
            onClick={() => setViewMode("kart")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
              viewMode === "kart" ? "bg-white/90 text-gray-800 shadow-sm" : "text-white/80 hover:text-white"
            }`}
          >
            Vis på tomt
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
          {effectiveAdmin && (
            <button
              onClick={() => setViewMode("mål")}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === "mål" ? "bg-white/90 text-gray-800 shadow-sm" : "text-white/80 hover:text-white"
              }`}
            >
              Målsetting
            </button>
          )}
          {effectiveAdmin && (
            <button
              onClick={() => { setDemoStep(0); setViewMode("demo"); }}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
                viewMode === "demo" ? "bg-orange-500 text-white shadow-sm" : "text-white/80 hover:text-white"
              }`}
            >
              Demo
            </button>
          )}
        </div>

        {/* Demo overlay on viewer */}
        {viewMode === "demo" && (
          <div className="absolute inset-0 z-10 pointer-events-none flex flex-col">
            {/* Storskjerm button — top right */}
            <div className="flex justify-end p-2 pointer-events-auto">
              <button
                onClick={() => setStorskjerm(true)}
                className="flex items-center gap-1.5 rounded-lg bg-black/40 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white hover:bg-black/60 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
                </svg>
                Storskjerm
              </button>
            </div>
            <div className="flex-1" />
            <div className="flex flex-col items-center gap-2 pb-4 px-4">
              {/* Q&A bubbles */}
              {qaPhase !== "none" && (
                <div className={`w-full max-w-xs space-y-1.5 transition-opacity duration-300 ${captionVisible ? "opacity-100" : "opacity-0"}`}>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">Spørsmål</span>
                    <div className="rounded-xl rounded-tl-none bg-white/90 backdrop-blur-sm px-3 py-2 shadow text-xs text-gray-800 font-medium">
                      {DEMO_STEPS[demoStep].q}
                    </div>
                  </div>
                  {qaPhase === "qa" && (
                    <div className="flex items-start gap-2 justify-end">
                      <div className="rounded-xl rounded-tr-none bg-orange-500 px-3 py-2 shadow text-xs text-white font-medium">
                        {DEMO_STEPS[demoStep].a}
                      </div>
                      <span className="mt-0.5 shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-orange-600">GP</span>
                    </div>
                  )}
                </div>
              )}
              {/* Caption card */}
              <div className={`w-full max-w-xs rounded-xl bg-white/90 backdrop-blur-sm px-4 py-3 shadow-lg transition-opacity duration-400 ${captionVisible ? "opacity-100" : "opacity-0"}`}>
                <p className="text-sm font-bold text-gray-900">{DEMO_STEPS[demoStep].label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{DEMO_STEPS[demoStep].desc}</p>
              </div>
              {/* Progress dots */}
              <div className="flex gap-1.5">
                {DEMO_STEPS.map((_, i) => (
                  <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === demoStep ? "w-5 bg-orange-500" : "w-1 bg-white/60"}`} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Storskjerm fullscreen overlay */}
        {storskjerm && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col">
            <div className="relative flex-1">
              <GarageViewer {...viewerProps} demoDoorOpen={demoDoorOpen} autoRotate />
              {/* Close button */}
              <button
                onClick={() => setStorskjerm(false)}
                className="absolute top-4 right-4 flex items-center gap-1.5 rounded-lg bg-white/20 backdrop-blur-sm px-3 py-1.5 text-sm font-medium text-white hover:bg-white/30 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Lukk
              </button>
              {/* GarasjeProffen branding */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="text-lg font-bold text-white tracking-tight">GarasjeProffen</span>
              </div>
            </div>
            {/* Bottom bar with Q&A + caption */}
            <div className="flex items-end justify-between gap-4 px-6 pb-6 pt-3">
              <div className="flex-1 max-w-xl space-y-2">
                {qaPhase !== "none" && (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white">Spørsmål</span>
                      <div className="rounded-xl rounded-tl-none bg-white/15 backdrop-blur-sm px-4 py-2.5 text-sm text-white font-medium">
                        {DEMO_STEPS[demoStep].q}
                      </div>
                    </div>
                    {qaPhase === "qa" && (
                      <div className="flex items-start gap-2 justify-end">
                        <div className="rounded-xl rounded-tr-none bg-orange-500 px-4 py-2.5 text-sm text-white font-medium">
                          {DEMO_STEPS[demoStep].a}
                        </div>
                        <span className="mt-0.5 shrink-0 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold text-white">GP</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold text-white">{DEMO_STEPS[demoStep].label}</p>
                <p className="text-sm text-white/60 mt-0.5">{DEMO_STEPS[demoStep].desc}</p>
                <div className="flex justify-end gap-1.5 mt-2">
                  {DEMO_STEPS.map((_, i) => (
                    <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === demoStep ? "w-6 bg-orange-500" : "w-1.5 bg-white/30"}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Vis på tomt — navigates to the Tomteplassering tab */}
        {viewMode === "test" && mapCenter && (
          <button
            onClick={() => setViewMode("kart")}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-1.5 text-xs font-semibold text-gray-700 shadow-md hover:bg-orange-50 hover:text-orange-600 transition-colors backdrop-blur-sm"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Vis på tomt
          </button>
        )}

        {(viewMode === "test" || viewMode === "demo") && <GarageViewer {...viewerProps} demoDoorOpen={viewMode === "demo" ? demoDoorOpen : false} />}
        {viewMode === "dev" && <LocalGarageViewer {...viewerProps} />}
        {viewMode === "kart" && (
          <GarageMapbox
            lengthMm={lengthValue} widthMm={widthValue} roofType={roofType} buildingType={buildingType}
            externalCenter={mapCenter} externalRotation={mapRotation}
            onCenterChange={(c) => { setMapCenter(c); }}
            onRotationChange={setMapRotation}
            onAddressSelect={(addr, coords) => pickAddress(addr, coords, true)}
            defaultCenter={mapCenter ?? undefined}
            addedElements={addedElements} doorWidthMm={doorWidthValue} doorHeightMm={doorHeightValue}
            showNeighbors
          />
        )}
        {viewMode === "mål" && (
          <div className="absolute inset-0 overflow-y-auto bg-white z-[5]">
            <GarageMålAdmin
              widthMm={widthValue} lengthMm={lengthValue}
              doorWidthMm={doorWidthValue} doorHeightMm={doorHeightValue}
              roofType={roofType} buildingType={buildingType}
              addedElements={addedElements}
            />
          </div>
        )}
      </div>

      {/* 50 m² warning — mobile only, sits between viewer and sidebar */}
      {sqm > 50 && !mobileLandscape && (
        <div className="sm:hidden flex items-center gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <svg className="h-3 w-3 shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>Over 50 m² krever <strong>ansvarlig søker</strong> — vi hjelper deg.</span>
        </div>
      )}

      {/* Sidebar */}
      <div className={mobileLandscape ? "hidden" : "flex w-full sm:w-[360px] shrink-0 flex-col border-t border-gray-200 sm:border-t-0 sm:border-l bg-white"}>
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
              label={buildingType === "carport" ? "Endre bredde carport" : widthParam.label}
              value={widthValue}
              min={snapOnly ? Math.ceil((widthParam.min! - 200) / 600) * 600 + 200 : widthParam.min!}
              max={snapOnly ? Math.floor((widthParam.max! - 200) / 600) * 600 + 200 : widthParam.max!}
              step={snapOnly ? 600 : widthParam.step!}
              unit={widthParam.unit}
              onChange={setWidthValue}
              snapOffset={200}
            />
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
                    roofType={roofType}
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
                              sizeRemovedRef.current = sizeRemovedRef.current.filter(
                                r => !(r.side === el.side && r.category === el.category && r.placement === el.placement)
                              );
                              setAddedElements((prev) => prev.filter((_, j) => j !== i));
                              setEditingElement(el);
                              setShowDoorWindowAdder(true);
                            }}
                            className="text-xs text-orange-500 hover:text-orange-700 font-medium"
                          >
                            Endre
                          </button>
                          <button
                            onClick={() => {
                              sizeRemovedRef.current = sizeRemovedRef.current.filter(
                                r => !(r.side === el.side && r.category === el.category && r.placement === el.placement)
                              );
                              setAddedElements((prev) => prev.filter((_, j) => j !== i));
                            }}
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
              Endelig pris etter befaring
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
                    onClick={() => setViewMode("test")}
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
              <div className="mt-1 text-center space-y-2">
                {detectingPos ? (
                  <p className="text-xs text-orange-600 flex items-center justify-center gap-1.5">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-orange-500 border-t-transparent inline-block" />
                    Henter din posisjon…
                  </p>
                ) : geoError ? (
                  <p className="text-xs text-red-500 leading-snug">{geoError}</p>
                ) : null}
                <p className="text-xs text-gray-500 leading-relaxed">
                  Klikk i kartet for å plassere {buildingType === "carport" ? "carporten" : "garasjen"}.<br />
                  Skru på 3D for å se nabobygg.
                </p>
              </div>
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

                {geoError && (
                  <p className="text-xs text-red-500 text-center leading-snug">{geoError}</p>
                )}

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
              adminContent={effectiveAdmin && viewMode !== "demo" ? (() => {
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
            <QuoteForm configuration={configuration} pricing={pricing} packageType={packageType} roofType={roofType} addedElements={addedElements} grunnarbeid={grunnarbeid ?? undefined} open={quoteOpen} address={selectedAddress ?? undefined} mapCenter={mapCenter} mapRotation={mapRotation} />
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
