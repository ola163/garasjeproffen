"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { wgs84ToUtm33N } from "@/lib/utm33n";

// A4 portrait at 150 DPI
const CANVAS_W = 1240;
const CANVAS_H = 1754;
const MAP_H    = 1400; // top portion is map
const TITLE_H  = CANVAS_H - MAP_H; // 354px title block

type BBox = { minLon: number; minLat: number; maxLon: number; maxLat: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function drawNorthArrow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  // Background circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fill();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Filled black triangle (north half)
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.38, y + r * 0.2);
  ctx.lineTo(x, y + r * 0.12);
  ctx.closePath();
  ctx.fillStyle = "#1e293b";
  ctx.fill();

  // White triangle (south half)
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x - r * 0.38, y + r * 0.2);
  ctx.lineTo(x, y + r * 0.12);
  ctx.closePath();
  ctx.fillStyle = "#e2e8f0";
  ctx.fill();

  // South tip
  ctx.beginPath();
  ctx.moveTo(x - r * 0.38, y + r * 0.2);
  ctx.lineTo(x + r * 0.38, y + r * 0.2);
  ctx.lineTo(x, y + r);
  ctx.closePath();
  ctx.fillStyle = "#e2e8f0";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y + r * 0.12);
  ctx.lineTo(x + r * 0.38, y + r * 0.2);
  ctx.lineTo(x, y + r);
  ctx.closePath();
  ctx.fillStyle = "#1e293b";
  ctx.fill();

  // Outline
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.38, y + r * 0.2);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.38, y + r * 0.2);
  ctx.closePath();
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1;
  ctx.stroke();

  // N label
  ctx.font = `bold ${Math.round(r * 0.72)}px sans-serif`;
  ctx.fillStyle = "#1e293b";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("N", x, y - r - 12);

  ctx.restore();
}

function drawScaleBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  mPerPixLon: number,
) {
  const totalM   = 50;
  const halfM    = 25;
  const totalPx  = totalM / mPerPixLon;
  const halfPx   = halfM / mPerPixLon;
  const barH     = 12;

  ctx.save();

  // Background
  ctx.fillStyle = "rgba(255,255,255,0.82)";
  ctx.fillRect(x - 8, y - 28, totalPx + 16, barH + 40);

  // Two alternating segments
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(x, y, halfPx, barH);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x + halfPx, y, halfPx, barH);

  // Border
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, totalPx, barH);
  // Mid divider
  ctx.beginPath();
  ctx.moveTo(x + halfPx, y);
  ctx.lineTo(x + halfPx, y + barH);
  ctx.stroke();

  // Labels above
  ctx.font = "bold 13px sans-serif";
  ctx.fillStyle = "#1e293b";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText("0", x, y - 3);
  ctx.textAlign = "center";
  ctx.fillText(`${halfM} m`, x + halfPx, y - 3);
  ctx.textAlign = "right";
  ctx.fillText(`${totalM} m`, x + totalPx, y - 3);

  // Caption below
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#475569";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("Målestokk 1:500", x + totalPx / 2, y + barH + 5);

  ctx.restore();
}

function drawGarageFootprint(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  bbox: BBox,
  imgW: number, imgH: number,
  lat: number,
  widthMm: number, lengthMm: number,
  rotationDeg: number,
) {
  const latRad    = lat * Math.PI / 180;
  const mPerPixLon = (bbox.maxLon - bbox.minLon) / imgW * 111_412.84 * Math.cos(latRad);
  const mPerPixLat = (bbox.maxLat - bbox.minLat) / imgH * 111_132.92;

  const halfWpx = (widthMm  / 1000) / 2 / mPerPixLon;
  const halfLpx = (lengthMm / 1000) / 2 / mPerPixLat;
  const ang = rotationDeg * Math.PI / 180;

  const corners: [number, number][] = [
    [-halfWpx, -halfLpx],
    [ halfWpx, -halfLpx],
    [ halfWpx,  halfLpx],
    [-halfWpx,  halfLpx],
  ].map(([dx, dy]) => [
    cx + dx * Math.cos(ang) - dy * Math.sin(ang),
    cy + dx * Math.sin(ang) + dy * Math.cos(ang),
  ]);

  ctx.save();

  // Fill
  ctx.beginPath();
  ctx.moveTo(corners[0][0], corners[0][1]);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i][0], corners[i][1]);
  ctx.closePath();
  ctx.fillStyle   = "rgba(234,88,12,0.28)";
  ctx.strokeStyle = "#ea580c";
  ctx.lineWidth   = 3;
  ctx.fill();
  ctx.stroke();

  // Dimension labels
  ctx.font      = "bold 16px sans-serif";
  ctx.fillStyle = "#c2410c";

  function edgeMid(a: [number,number], b: [number,number]): [number,number] {
    return [(a[0]+b[0])/2, (a[1]+b[1])/2];
  }
  function edgeAngle(a: [number,number], b: [number,number]): number {
    return Math.atan2(b[1]-a[1], b[0]-a[0]);
  }

  const widthM  = (widthMm  / 1000).toFixed(1).replace(".0", "") + " m";
  const lengthM = (lengthMm / 1000).toFixed(1).replace(".0", "") + " m";

  // Bottom edge (corners[2]→corners[3]) = width
  const [bx, by]   = edgeMid(corners[1], corners[2]);
  const bottomAng  = edgeAngle(corners[1], corners[2]);
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(bottomAng);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(widthM, 0, 5);
  ctx.restore();

  // Right edge (corners[1]→corners[2]) = length
  const [rx, ry]  = edgeMid(corners[2], corners[3]);
  const rightAng  = edgeAngle(corners[2], corners[3]);
  ctx.save();
  ctx.translate(rx, ry);
  ctx.rotate(rightAng);
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(lengthM, 0, -5);
  ctx.restore();

  ctx.restore();

  return { mPerPixLon, mPerPixLat };
}

function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  yStart: number,
  address: string,
  rotation: number,
  widthMm: number,
  lengthMm: number,
  dateStr: string,
) {
  const W  = CANVAS_W;
  const H  = TITLE_H;
  const y  = yStart;

  // Background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, y, W, H);

  // Top border line
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(W, y);
  ctx.stroke();

  // Column dividers
  const col1 = Math.round(W * 0.42);
  const col2 = Math.round(W * 0.75);

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(col1, y); ctx.lineTo(col1, y + H);
  ctx.moveTo(col2, y); ctx.lineTo(col2, y + H);
  ctx.stroke();

  // Outer border
  ctx.strokeRect(0, y, W, H);

  const pad = 18;

  // ── Column 1: Project info ──
  let yl = y + pad + 2;
  ctx.font      = "bold 22px sans-serif";
  ctx.fillStyle = "#1e293b";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("SITUASJONSPLAN", pad, yl);

  yl += 34;
  ctx.font      = "15px sans-serif";
  ctx.fillStyle = "#334155";
  const addrDisplay = address || "–";
  // wrap long address across two lines
  if (ctx.measureText(addrDisplay).width > col1 - pad * 2) {
    const words = addrDisplay.split(" ");
    let line1 = "", line2 = "";
    for (const w of words) {
      if (ctx.measureText(line1 + " " + w).width < col1 - pad * 2) {
        line1 += (line1 ? " " : "") + w;
      } else {
        line2 += (line2 ? " " : "") + w;
      }
    }
    ctx.fillText(line1, pad, yl);
    yl += 20;
    ctx.fillText(line2, pad, yl);
    yl += 24;
  } else {
    ctx.fillText(addrDisplay, pad, yl);
    yl += 28;
  }

  ctx.fillStyle = "#475569";
  ctx.font      = "14px sans-serif";
  ctx.fillText(`Rotasjon: ${rotation}°`, pad, yl);
  yl += 22;
  const wLabel = (widthMm  / 1000).toFixed(1).replace(".0", "");
  const lLabel = (lengthMm / 1000).toFixed(1).replace(".0", "");
  ctx.fillText(`${wLabel} × ${lLabel} m`, pad, yl);
  yl += 22;

  // ── Column 2: Scale / date ──
  let y2 = y + pad + 2;
  ctx.font      = "bold 16px sans-serif";
  ctx.fillStyle = "#1e293b";
  ctx.textAlign = "left";
  ctx.fillText("Målestokk 1:500", col1 + pad, y2);
  y2 += 30;
  ctx.font      = "14px sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText(`Dato: ${dateStr}`, col1 + pad, y2);
  y2 += 24;
  ctx.fillText("© Kartverket", col1 + pad, y2);
  y2 += 24;
  ctx.font      = "bold 14px sans-serif";
  ctx.fillStyle = "#ea580c";
  ctx.fillText("Garasjeproffen AS", col1 + pad, y2);

  // ── Column 3: North arrow ──
  const arrowX = col2 + Math.round((W - col2) / 2);
  const arrowY = y + Math.round(H / 2) + 10;
  drawNorthArrow(ctx, arrowX, arrowY, 38);
}

// ── Main render function ──
async function renderSituasjonsplan(
  canvas: HTMLCanvasElement,
  lat: number,
  lng: number,
  widthMm: number,
  lengthMm: number,
  rotation: number,
  address: string,
): Promise<void> {
  const ctx = canvas.getContext("2d")!;

  // 1. Fetch map images at A4 map area dimensions
  const apiUrl = `/api/admin/situasjonsplan/generate?lat=${lat}&lng=${lng}&halfMeters=80&width=${CANVAS_W}&height=${MAP_H}`;
  const res    = await fetch(apiUrl);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    topo: string; matrikkel: string;
    bbox: BBox;
    width: number; height: number;
  };

  const [topoImg, matrikkelImg] = await Promise.all([
    loadImage(`data:image/png;base64,${data.topo}`),
    loadImage(`data:image/png;base64,${data.matrikkel}`),
  ]);

  const imgW = data.width;
  const imgH = data.height;
  const bbox = data.bbox;

  // 2. Draw base maps in the map area
  ctx.drawImage(topoImg,      0, 0, imgW, imgH);
  ctx.drawImage(matrikkelImg, 0, 0, imgW, imgH);

  // 3. Calculate garage center in pixel coords
  const cx = (lng - bbox.minLon) / (bbox.maxLon - bbox.minLon) * imgW;
  const cy = (1 - (lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * imgH;

  // 4. Draw garage footprint + get scale info
  const { mPerPixLon } = drawGarageFootprint(
    ctx, cx, cy, bbox, imgW, imgH,
    lat, widthMm, lengthMm, rotation,
  );

  // 5. Scale bar (bottom-left of map area)
  drawScaleBar(ctx, 40, imgH - 68, mPerPixLon);

  // 6. North arrow (top-right of map area)
  drawNorthArrow(ctx, imgW - 68, 72, 32);

  // 7. Title block
  const now = new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
  drawTitleBlock(ctx, MAP_H, address, rotation, widthMm, lengthMm, now);

  // 8. Thin separator line between map and title block
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, MAP_H);
  ctx.lineTo(CANVAS_W, MAP_H);
  ctx.stroke();
}

// ── Print page content ──
function PrintContent() {
  const params     = useSearchParams();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [status,   setStatus]   = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lat       = parseFloat(params.get("lat")      ?? "");
  const lng       = parseFloat(params.get("lng")      ?? "");
  const rotation  = parseInt  (params.get("rotation") ?? "0", 10);
  const widthMm   = parseInt  (params.get("widthMm")  ?? "5000", 10);
  const lengthMm  = parseInt  (params.get("lengthMm") ?? "6000", 10);
  const roofType      = params.get("roofType")     ?? "saltak";
  const buildingType  = params.get("buildingType") ?? "garasje";
  const address       = params.get("address")      ?? "";
  const quoteId       = params.get("quote")        ?? "";

  const isValid = !isNaN(lat) && !isNaN(lng);

  const backUrl = quoteId
    ? `/admin/quotes/${quoteId}`
    : `/admin/situasjonsplan?lat=${lat}&lng=${lng}&rotation=${rotation}&widthMm=${widthMm}&lengthMm=${lengthMm}&roofType=${roofType}&buildingType=${buildingType}${address ? `&address=${encodeURIComponent(address)}` : ""}`;

  const utmCoords = isValid ? wgs84ToUtm33N(lng, lat) : null;

  const render = useCallback(async () => {
    if (!canvasRef.current || !isValid) return;
    setStatus("loading");
    setErrorMsg(null);
    try {
      await renderSituasjonsplan(
        canvasRef.current,
        lat, lng,
        widthMm, lengthMm, rotation,
        address,
      );
      setStatus("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Ukjent feil");
      setStatus("error");
    }
  }, [lat, lng, widthMm, lengthMm, rotation, address, isValid]);

  useEffect(() => {
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDownloadPng() {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.href     = canvasRef.current.toDataURL("image/png");
    a.download = `situasjonsplan${address ? `-${address.replace(/[^a-zA-Z0-9]/g, "_")}` : ""}.png`;
    a.click();
  }

  const widthLabel  = (widthMm  / 1000).toFixed(1).replace(".0", "");
  const lengthLabel = (lengthMm / 1000).toFixed(1).replace(".0", "");
  const now = new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      {/* ── Top bar ── */}
      <div className="no-print flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
        <Link href={backUrl} className="text-sm text-gray-400 hover:text-orange-500 transition-colors">← Tilbake</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-sm font-semibold text-gray-800">Situasjonsplan – Tegning</h1>
        <div className="flex-1" />

        {status === "loading" && (
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <svg className="animate-spin" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
              <path d="M12 2a10 10 0 0 1 10 10"/>
            </svg>
            Genererer kart…
          </span>
        )}

        {status === "error" && (
          <button
            onClick={render}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            ↺ Prøv igjen
          </button>
        )}

        {status === "done" && (
          <>
            <button
              onClick={handleDownloadPng}
              className="flex items-center gap-1.5 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 text-xs font-medium px-3 py-1.5 transition-colors"
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Last ned PNG
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 transition-colors shadow-sm"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              Last ned PDF
            </button>
          </>
        )}
      </div>

      {/* ── Error banner ── */}
      {status === "error" && errorMsg && (
        <div className="no-print px-4 py-3 bg-red-50 border-b border-red-200 text-sm text-red-700">
          <strong>Feil:</strong> {errorMsg}
        </div>
      )}

      {/* ── Canvas wrapper ── */}
      <div className="flex justify-center bg-gray-100 min-h-screen py-6 print:py-0 print:bg-white">
        <div className="relative" style={{ width: CANVAS_W, maxWidth: "100%" }}>

          {/* Loading overlay */}
          {status === "loading" && (
            <div className="no-print absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10 rounded">
              <svg className="animate-spin mb-3" viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#ea580c" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
                <path d="M12 2a10 10 0 0 1 10 10"/>
              </svg>
              <p className="text-sm text-gray-600">Henter kartdata fra Kartverket…</p>
            </div>
          )}

          {/* The canvas */}
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="block shadow-lg print:shadow-none"
            style={{ width: "100%", height: "auto" }}
          />
        </div>
      </div>

      {/* ── HTML title block (print-friendly supplement, hidden on screen) ── */}
      {/* The actual title block is rendered on the canvas; this version is for
          browsers that can't render canvas to PDF accurately at full resolution */}
      <div
        className="no-print hidden"
        aria-hidden="true"
        style={{
          fontFamily: "sans-serif",
          border: "1px solid #1e293b",
          display: "grid",
          gridTemplateColumns: "5fr 4fr 3fr",
          fontSize: 13,
        }}
      >
        <div style={{ padding: 12, borderRight: "1px solid #1e293b" }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>SITUASJONSPLAN</div>
          <div>{address}</div>
          <div>Rotasjon: {rotation}°</div>
          <div>{widthLabel} × {lengthLabel} m</div>
        </div>
        <div style={{ padding: 12, borderRight: "1px solid #1e293b" }}>
          <div style={{ fontWeight: 600 }}>Målestokk 1:500</div>
          <div>Dato: {now}</div>
          <div>© Kartverket</div>
          <div style={{ fontWeight: 700, color: "#ea580c" }}>Garasjeproffen AS</div>
        </div>
        <div style={{ padding: 12, textAlign: "center" }}>
          {/* Mini north arrow SVG */}
          <svg viewBox="0 0 50 70" width="50" height="70" style={{ display: "block", margin: "0 auto" }}>
            <circle cx="25" cy="35" r="22" fill="white" stroke="#94a3b8" strokeWidth="1.5"/>
            <polygon points="25,14 31,42 25,38" fill="#1e293b"/>
            <polygon points="25,14 19,42 25,38" fill="#e2e8f0"/>
            <polygon points="19,42 31,42 25,56" fill="#e2e8f0"/>
            <polygon points="25,38 31,42 25,56" fill="#1e293b"/>
            <text x="25" y="10" textAnchor="middle" fontWeight="bold" fontSize="11" fill="#1e293b">N</text>
          </svg>
          {utmCoords && (
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 6 }}>
              UTM33N<br/>Ø {utmCoords[0]}<br/>N {utmCoords[1]}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function SituasjonsplanPrintPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#ea580c" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
            <path d="M12 2a10 10 0 0 1 10 10"/>
          </svg>
          <p className="text-sm text-gray-500">Laster inn…</p>
        </div>
      </div>
    }>
      <PrintContent />
    </Suspense>
  );
}
