"use client";

import { Suspense, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import GarageMapbox from "@/components/configurator/GarageMapbox";
import { wgs84ToUtm33N } from "@/lib/utm33n";

const WIDTHS  = [2400, 3000, 3600, 4000, 5000, 6000, 7000];
const LENGTHS = [4000, 5000, 6000, 7000, 8000, 9000, 10000];



function SituasjonsplanContent() {
  const params = useSearchParams();

  const initLat      = parseFloat(params.get("lat")   ?? "");
  const initLng      = parseFloat(params.get("lng")   ?? "");
  const initRotation = parseInt(params.get("rotation") ?? "0", 10);
  const initWidthMm  = parseInt(params.get("widthMm")  ?? "5000", 10);
  const initLengthMm = parseInt(params.get("lengthMm") ?? "6000", 10);
  const initRoofType     = (params.get("roofType")     as "saltak" | "flattak")  ?? "saltak";
  const initBuildingType = (params.get("buildingType") as "garasje" | "carport") ?? "garasje";
  const initAddress  = params.get("address") ?? "";
  const quoteId      = params.get("quote") ?? "";

  const hasInitialPlacement = !isNaN(initLat) && !isNaN(initLng);
  const initCenter: [number, number] | null = hasInitialPlacement ? [initLng, initLat] : null;

  const [config, setConfig] = useState({
    widthMm:      initWidthMm,
    lengthMm:     initLengthMm,
    roofType:     initRoofType,
    buildingType: initBuildingType,
  });
  const [center,      setCenter]      = useState<[number, number] | null>(initCenter);
  const [rotation,    setRotation]    = useState(initRotation);
  const [address,     setAddress]     = useState(initAddress);
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState<string | null>(null);
  const sharedParams = center
    ? `lat=${center[1]}&lng=${center[0]}&rotation=${rotation}&widthMm=${config.widthMm}&lengthMm=${config.lengthMm}&roofType=${config.roofType}&buildingType=${config.buildingType}${quoteId ? `&quote=${quoteId}` : ""}${address ? `&address=${encodeURIComponent(address)}` : ""}`
    : null;
  const fasadeUrl = sharedParams ? `/admin/fasadetegning?${sharedParams}` : null;
  const tegningUrl = sharedParams ? `/admin/situasjonsplan/print?${sharedParams}` : null;

  const utmCenter = center ? wgs84ToUtm33N(center[0], center[1]) : null;

  type MapLike = { getCanvas(): HTMLCanvasElement; triggerRepaint(): void; once(e: string, cb: () => void): void };
  const mapInstanceRef = useRef<MapLike | null>(null);

  async function handleGenerate() {
    const map = mapInstanceRef.current;
    if (!center || !map) return;
    setGenerating(true);
    setGenError(null);
    try {
      // Ensure the latest frame is rendered before capture
      map.triggerRepaint();
      await new Promise<void>((res) => { map.once("render", res); setTimeout(res, 300); });

      const mapCanvas = map.getCanvas();
      const mW = mapCanvas.width;
      const mH = mapCanvas.height;
      const dpr = window.devicePixelRatio || 1;
      const titleH = Math.round(110 * dpr);

      const out = document.createElement("canvas");
      out.width  = mW;
      out.height = mH + titleH;
      const ctx = out.getContext("2d")!;

      // Map image
      ctx.drawImage(mapCanvas, 0, 0);

      // Title block background
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, mH, mW, titleH);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = Math.round(2 * dpr);
      ctx.beginPath(); ctx.moveTo(0, mH); ctx.lineTo(mW, mH); ctx.stroke();

      const pad  = Math.round(16 * dpr);
      const fs   = Math.round(13 * dpr);
      const now  = new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
      const [utmE, utmN] = wgs84ToUtm33N(center[0], center[1]);
      const wLabel = (config.widthMm  / 1000).toFixed(1).replace(".0", "");
      const lLabel = (config.lengthMm / 1000).toFixed(1).replace(".0", "");

      ctx.textBaseline = "top";

      // Left column
      ctx.font = `bold ${Math.round(18 * dpr)}px sans-serif`;
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "left";
      ctx.fillText("SITUASJONSPLAN", pad, mH + pad);

      ctx.font = `${fs}px sans-serif`;
      ctx.fillStyle = "#475569";
      if (address) ctx.fillText(address, pad, mH + pad + Math.round(26 * dpr));
      ctx.fillText(`${wLabel} × ${lLabel} m  ·  Rotasjon: ${rotation}°`, pad, mH + pad + Math.round(46 * dpr));
      ctx.fillText(`UTM33N  Ø${utmE}  N${utmN}`, pad, mH + pad + Math.round(64 * dpr));

      // Right column
      ctx.textAlign = "right";
      ctx.fillStyle = "#475569";
      ctx.fillText(`Dato: ${now}`, mW - pad, mH + pad);
      ctx.fillText("© Kartverket · © OpenStreetMap", mW - pad, mH + pad + Math.round(20 * dpr));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.fillStyle = "#ea580c";
      ctx.fillText("Garasjeproffen AS", mW - pad, mH + pad + Math.round(42 * dpr));

      const a = document.createElement("a");
      a.href     = out.toDataURL("image/png");
      a.download = `situasjonsplan${address ? `-${address.replace(/[^a-zA-Z0-9]/g, "_")}` : ""}.png`;
      a.click();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm print:hidden">
        {quoteId ? (
          <>
            <Link href="/admin/quotes" className="text-sm text-gray-400 hover:text-orange-500 transition-colors">← Forespørsler</Link>
            <span className="text-gray-300">/</span>
            <Link href={`/admin/quotes/${quoteId}`} className="text-sm text-gray-500 hover:text-orange-500 font-mono transition-colors">{quoteId}</Link>
            <span className="text-gray-300">/</span>
          </>
        ) : (
          <>
            <Link href="/admin" className="text-sm text-gray-400 hover:text-orange-500 transition-colors">← Admin</Link>
            <span className="text-gray-300">/</span>
          </>
        )}
        <h1 className="text-sm font-semibold text-gray-800">Situasjonsplan</h1>
        <div className="flex-1" />
        {center && (
          <>
            <a
              href="https://e-torg.no/time/tilpass/NK11210300"
              target="_blank"
              rel="noopener noreferrer"
              title="Bestill offisiell situasjonskart fra Norkart e-Torg"
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs font-medium px-3 py-1.5 transition-colors"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Bestill situasjonskart
            </a>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 disabled:opacity-50 text-xs font-medium px-3 py-1.5 transition-colors"
            >
              {generating ? (
                <svg className="animate-spin" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
                  <path d="M12 2a10 10 0 0 1 10 10"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              )}
              {generating ? "Genererer…" : "Last ned PNG"}
            </button>
          </>
        )}
        {tegningUrl && (
          <Link
            href={tegningUrl}
            className="flex items-center gap-1.5 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-50 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <rect x="8" y="13" width="8" height="6" rx="0.5"/>
            </svg>
            Tegning
          </Link>
        )}
        {fasadeUrl && (
          <Link
            href={fasadeUrl}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
            </svg>
            Fasadetegning
          </Link>
        )}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 transition-colors shadow-sm"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Skriv ut
        </button>
      </div>

      {genError && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-700 print:hidden">
          Feil ved generering: {genError}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ── */}
        <div className="w-60 shrink-0 bg-white border-r border-gray-200 flex flex-col gap-5 p-4 overflow-y-auto print:hidden">

          {/* Bredde */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Bredde</p>
            <div className="flex flex-wrap gap-1">
              {WIDTHS.map((w) => (
                <button key={w} onClick={() => setConfig((c) => ({ ...c, widthMm: w }))}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${config.widthMm === w ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600"}`}>
                  {(w / 1000).toFixed(1).replace(".0", "")} m
                </button>
              ))}
            </div>
          </div>

          {/* Lengde */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Lengde</p>
            <div className="flex flex-wrap gap-1">
              {LENGTHS.map((l) => (
                <button key={l} onClick={() => setConfig((c) => ({ ...c, lengthMm: l }))}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${config.lengthMm === l ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600"}`}>
                  {(l / 1000).toFixed(1).replace(".0", "")} m
                </button>
              ))}
            </div>
          </div>

          {/* Bygningstype */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Type</p>
            <div className="flex gap-1">
              {(["garasje", "carport"] as const).map((t) => (
                <button key={t} onClick={() => setConfig((c) => ({ ...c, buildingType: t }))}
                  className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${config.buildingType === t ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600"}`}>
                  {t === "garasje" ? "Garasje" : "Carport"}
                </button>
              ))}
            </div>
          </div>

          {/* Taktype */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Tak</p>
            <div className="flex gap-1">
              {(["saltak", "flattak"] as const).map((t) => (
                <button key={t} onClick={() => setConfig((c) => ({ ...c, roofType: t }))}
                  className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors ${config.roofType === t ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600"}`}>
                  {t === "saltak" ? "Saltak" : "Flattak"}
                </button>
              ))}
            </div>
          </div>

          {/* Plasseringsinfo */}
          <div className="mt-auto border-t border-gray-100 pt-4 text-xs text-gray-500 leading-relaxed space-y-0.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Plassering</p>
            {address && <p className="font-medium text-gray-700 break-words">{address}</p>}
            {center ? (
              <>
                <p>Lng: {center[0].toFixed(5)}</p>
                <p>Lat: {center[1].toFixed(5)}</p>
                {utmCenter && <p className="font-mono text-[10px] text-gray-400">Ø {utmCenter[0]}  N {utmCenter[1]}</p>}
                <p>Rotasjon: {rotation}°</p>
                <p className="pt-1 font-medium text-gray-700">
                  {(config.widthMm / 1000).toFixed(1).replace(".0", "")} × {(config.lengthMm / 1000).toFixed(1).replace(".0", "")} m
                </p>
              </>
            ) : (
              <p className="text-gray-400 italic">Klikk i kartet for å plassere</p>
            )}
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700 leading-snug">
            <p className="font-semibold mb-1">Bruk av kartet</p>
            <p>Slå på <span className="font-medium">«Kart»</span> for matrikkellaget fra Kartverket. Trykk <span className="font-medium">«Last ned PNG»</span> for situasjonsplan med garasjefotavtrykk, eller <span className="font-medium">«Tegning»</span> for A4-PDF.</p>
          </div>

          {center && (
            <div className="rounded-lg bg-teal-50 border border-teal-100 p-3 text-xs text-teal-800 leading-snug">
              <p className="font-semibold mb-1.5">Offisiell situasjonskart</p>
              <a
                href="https://e-torg.no/time/tilpass/NK11210300"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 font-medium text-teal-700 hover:text-teal-900 hover:underline"
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Bestill fra Norkart e-Torg →
              </a>
            </div>
          )}
        </div>

        {/* ── Map area ── */}
        <div className="flex-1 relative overflow-hidden">
          <GarageMapbox
            widthMm={config.widthMm}
            lengthMm={config.lengthMm}
            roofType={config.roofType}
            buildingType={config.buildingType}
            externalCenter={center}
            externalRotation={rotation}
            showNeighbors
            showCadastralToggle
            defaultShowCadastral
            defaultCenter={initCenter ?? undefined}
            onCenterChange={setCenter}
            onRotationChange={setRotation}
            onAddressSelect={(addr) => setAddress(addr)}
            onMapReady={(m) => { mapInstanceRef.current = m as MapLike; }}
          />
        </div>

      </div>
    </div>
  );
}

export default function AdminSituasjonsplanPage() {
  return (
    <Suspense>
      <SituasjonsplanContent />
    </Suspense>
  );
}
