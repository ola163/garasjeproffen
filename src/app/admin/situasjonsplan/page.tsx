"use client";

import { Suspense, useState, useRef, useEffect } from "react";
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
  const [center,         setCenter]         = useState<[number, number] | null>(initCenter);
  const [rotation,       setRotation]       = useState(initRotation);
  const [address,        setAddress]        = useState(initAddress);
  const [generating,     setGenerating]     = useState(false);
  const [genError,       setGenError]       = useState<string | null>(null);
  const [naboerPolygons, setNaboerPolygons] = useState<[number, number][][]>([]);
  const [naboCount,      setNaboCount]      = useState(0);
  const naboFetchedRef = useRef(false);

  // Auto-fetch neighbour polygons once when center is known and a quoteId is present
  useEffect(() => {
    if (!center || !quoteId || naboFetchedRef.current) return;
    naboFetchedRef.current = true;
    const [lng, lat] = center;
    fetch(`/api/admin/naboer?lat=${lat}&lng=${lng}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        const naboer: { polygon?: [number, number][] }[] = data.naboer ?? [];
        setNaboerPolygons(naboer.filter(n => n.polygon).map(n => n.polygon!));
        setNaboCount(naboer.length);
      })
      .catch(() => {});
  }, [center, quoteId]);

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

      // Fetch municipality info + logo
      let kommuneNavn = "";
      let kommuneLogo: HTMLImageElement | null = null;
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 5000);
        const mRes = await fetch(
          `https://ws.geonorge.no/adresser/v1/punktsok?lat=${center[1]}&lon=${center[0]}&radius=500&utkoordsys=4258&treffPerSide=1`,
          { signal: ctrl.signal },
        );
        const mData = await mRes.json();
        const a = mData.adresser?.[0];
        if (a?.kommunenummer) {
          kommuneNavn = a.kommunenavn
            ? (a.kommunenavn as string).charAt(0) + (a.kommunenavn as string).slice(1).toLowerCase()
            : "";
          try {
            kommuneLogo = await new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload  = () => resolve(img);
              img.onerror = reject;
              img.src = `/kommuner/${a.kommunenummer}.png`;
            });
          } catch { /* no logo file */ }
        }
      } catch { /* skip kommune info */ }

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

      // Center: kommune logo or name
      if (kommuneLogo) {
        const maxH = titleH - pad * 2;
        const maxW = Math.round(mW * 0.2);
        const scale = Math.min(maxW / kommuneLogo.width, maxH / kommuneLogo.height, 1);
        const lW = Math.round(kommuneLogo.width * scale);
        const lH = Math.round(kommuneLogo.height * scale);
        ctx.drawImage(kommuneLogo, Math.round((mW - lW) / 2), mH + Math.round((titleH - lH) / 2), lW, lH);
      } else if (kommuneNavn) {
        ctx.font = `bold ${fs}px sans-serif`;
        ctx.fillStyle = "#334155";
        ctx.textAlign = "center";
        ctx.fillText(kommuneNavn, Math.round(mW / 2), mH + pad);
      }

      // Right column
      ctx.textAlign = "right";
      ctx.fillStyle = "#475569";
      ctx.font = `${fs}px sans-serif`;
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

  const [generatingWm, setGeneratingWm] = useState(false);

  async function handleGenerateWithWatermark() {
    const map = mapInstanceRef.current;
    if (!center || !map) return;
    setGeneratingWm(true);
    setGenError(null);
    try {
      map.triggerRepaint();
      await new Promise<void>((res) => { map.once("render", res); setTimeout(res, 300); });

      const mapCanvas = map.getCanvas();
      const mW = mapCanvas.width;
      const mH = mapCanvas.height;
      const dpr = window.devicePixelRatio || 1;
      const titleH = Math.round(110 * dpr);

      let kommuneNavn = "";
      let kommuneLogo: HTMLImageElement | null = null;
      try {
        const ctrl = new AbortController();
        setTimeout(() => ctrl.abort(), 5000);
        const mRes = await fetch(
          `https://ws.geonorge.no/adresser/v1/punktsok?lat=${center[1]}&lon=${center[0]}&radius=500&utkoordsys=4258&treffPerSide=1`,
          { signal: ctrl.signal },
        );
        const mData = await mRes.json();
        const a = mData.adresser?.[0];
        if (a?.kommunenummer) {
          kommuneNavn = a.kommunenavn
            ? (a.kommunenavn as string).charAt(0) + (a.kommunenavn as string).slice(1).toLowerCase()
            : "";
          try {
            kommuneLogo = await new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload  = () => resolve(img);
              img.onerror = reject;
              img.src = `/kommuner/${a.kommunenummer}.png`;
            });
          } catch { /* no logo file */ }
        }
      } catch { /* skip */ }

      const out = document.createElement("canvas");
      out.width  = mW;
      out.height = mH + titleH;
      const ctx = out.getContext("2d")!;

      ctx.drawImage(mapCanvas, 0, 0);

      // Title block
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, mH, mW, titleH);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = Math.round(2 * dpr);
      ctx.beginPath(); ctx.moveTo(0, mH); ctx.lineTo(mW, mH); ctx.stroke();

      const pad = Math.round(16 * dpr);
      const fs  = Math.round(13 * dpr);
      const now = new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
      const [utmE, utmN] = wgs84ToUtm33N(center[0], center[1]);
      const wLabel = (config.widthMm  / 1000).toFixed(1).replace(".0", "");
      const lLabel = (config.lengthMm / 1000).toFixed(1).replace(".0", "");

      ctx.textBaseline = "top";
      ctx.font = `bold ${Math.round(18 * dpr)}px sans-serif`;
      ctx.fillStyle = "#1e293b";
      ctx.textAlign = "left";
      ctx.fillText("SITUASJONSPLAN", pad, mH + pad);
      ctx.font = `${fs}px sans-serif`;
      ctx.fillStyle = "#475569";
      if (address) ctx.fillText(address, pad, mH + pad + Math.round(26 * dpr));
      ctx.fillText(`${wLabel} × ${lLabel} m  ·  Rotasjon: ${rotation}°`, pad, mH + pad + Math.round(46 * dpr));
      ctx.fillText(`UTM33N  Ø${utmE}  N${utmN}`, pad, mH + pad + Math.round(64 * dpr));

      if (kommuneLogo) {
        const maxH = titleH - pad * 2;
        const maxW = Math.round(mW * 0.2);
        const scale = Math.min(maxW / kommuneLogo.width, maxH / kommuneLogo.height, 1);
        const lW = Math.round(kommuneLogo.width * scale);
        const lH = Math.round(kommuneLogo.height * scale);
        ctx.drawImage(kommuneLogo, Math.round((mW - lW) / 2), mH + Math.round((titleH - lH) / 2), lW, lH);
      } else if (kommuneNavn) {
        ctx.font = `bold ${fs}px sans-serif`;
        ctx.fillStyle = "#334155";
        ctx.textAlign = "center";
        ctx.fillText(kommuneNavn, Math.round(mW / 2), mH + pad);
      }

      ctx.textAlign = "right";
      ctx.fillStyle = "#475569";
      ctx.font = `${fs}px sans-serif`;
      ctx.fillText(`Dato: ${now}`, mW - pad, mH + pad);
      ctx.fillText("© Kartverket · © OpenStreetMap", mW - pad, mH + pad + Math.round(20 * dpr));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.fillStyle = "#ea580c";
      ctx.fillText("Garasjeproffen AS", mW - pad, mH + pad + Math.round(42 * dpr));

      // ── Diagonal watermark across the entire map area ──────────────────────
      const wmText = "UTKAST · GARASJEPROFFEN.NO";
      const wmFontSize = Math.round(mW * 0.042);
      ctx.save();
      ctx.translate(mW / 2, mH / 2);
      ctx.rotate(-Math.PI / 4);
      ctx.font = `bold ${wmFontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = wmFontSize * 0.12;
      ctx.lineJoin = "round";

      const lineSpacing = wmFontSize * 2.2;
      for (let i = -3; i <= 3; i++) {
        const y = i * lineSpacing;
        ctx.strokeText(wmText, 0, y);
      }
      ctx.fillStyle = "rgba(234, 88, 12, 0.11)";
      for (let i = -3; i <= 3; i++) {
        const y = i * lineSpacing;
        ctx.fillText(wmText, 0, y);
      }
      ctx.restore();

      const dl = document.createElement("a");
      dl.href     = out.toDataURL("image/png");
      dl.download = `situasjonsplan-utkast${address ? `-${address.replace(/[^a-zA-Z0-9]/g, "_")}` : ""}.png`;
      dl.click();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setGeneratingWm(false);
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
            <button
              onClick={handleGenerateWithWatermark}
              disabled={generatingWm}
              className="flex items-center gap-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 text-xs font-medium px-3 py-1.5 transition-colors"
            >
              {generatingWm ? (
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
              {generatingWm ? "Genererer…" : "Last ned med vannmerke"}
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
        {quoteId && center && (
          <Link
            href={`/admin/quotes/${quoteId}/nabovarsel`}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 transition-colors shadow-sm"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/>
            </svg>
            Nabovarsel{naboCount > 0 ? ` (${naboCount})` : ""}
          </Link>
        )}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold px-3 py-1.5 transition-colors"
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
            naboerPolygons={naboerPolygons}
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
