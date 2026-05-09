"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// ── Canvas: A4 portrait @ 150 DPI ─────────────────────────────────────────
const CW  = 1240;
const CH  = 1754;
const TH  = 170;   // bottom title block height
const HDR = 58;    // top header strip height
const CW2 = CW / 2;                    // 620  cell width
const CH2 = (CH - TH - HDR) / 2;      // 763  cell height

// ── Garage geometry constants ─────────────────────────────────────────────
const EAVE_MM = 2400;   // wall / eave height in mm
const PITCH   = 22;     // roof pitch in degrees
const OVH_MM  = 400;    // eave + gable overhang in mm

function ridgeMm(w: number) { return (w / 2) * Math.tan(PITCH * Math.PI / 180); }

function calcScale(wMm: number, lMm: number): number {
  const rH   = ridgeMm(wMm);
  const avW  = CW2 - 130;
  const avH  = CH2 - 120;
  return Math.min(avW / (Math.max(wMm, lMm) + OVH_MM * 2), avH / (EAVE_MM + rH));
}

// ── Helpers ───────────────────────────────────────────────────────────────
function hDim(
  ctx: CanvasRenderingContext2D,
  x1: number, x2: number, y: number, labelMm: number,
) {
  const T = 7;
  ctx.save();
  ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y - T); ctx.lineTo(x1, y + T);
  ctx.moveTo(x2, y - T); ctx.lineTo(x2, y + T);
  ctx.moveTo(x1, y);     ctx.lineTo(x2, y);
  ctx.stroke();
  const txt = `${(labelMm / 1000).toFixed(1).replace(".0", "")} m`;
  ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  const tw = ctx.measureText(txt).width;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect((x1 + x2) / 2 - tw / 2 - 3, y + 3, tw + 6, 15);
  ctx.fillStyle = "#334155"; ctx.fillText(txt, (x1 + x2) / 2, y + 4);
  ctx.restore();
}

function vDim(
  ctx: CanvasRenderingContext2D,
  x: number, y1: number, y2: number, labelMm: number,
) {
  const T = 7;
  ctx.save();
  ctx.strokeStyle = "#334155"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - T, y1); ctx.lineTo(x + T, y1);
  ctx.moveTo(x - T, y2); ctx.lineTo(x + T, y2);
  ctx.moveTo(x, y1);     ctx.lineTo(x, y2);
  ctx.stroke();
  const txt = `${(labelMm / 1000).toFixed(1).replace(".0", "")} m`;
  ctx.font = "12px sans-serif";
  ctx.save();
  ctx.translate(x - 14, (y1 + y2) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const tw = ctx.measureText(txt).width;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(-tw / 2 - 3, -8, tw + 6, 15);
  ctx.fillStyle = "#334155"; ctx.fillText(txt, 0, 0);
  ctx.restore();
  ctx.restore();
}

// ── Background buildings ─────────────────────────────────────────────────
function drawBgBuildings(
  ctx: CanvasRenderingContext2D,
  wallLeft: number, wallRight: number,
  groundY: number, sc: number,
) {
  const gap   = 1500 * sc;
  const bldgs = [
    // left side (closest → furthest)
    { x: wallLeft - gap - 5400 * sc, w: 5400 * sc, h: 2300 * sc, rH: 820 * sc },
    { x: wallLeft - gap - 5400 * sc - gap - 6800 * sc, w: 6800 * sc, h: 2600 * sc, rH: 0  },
    // right side
    { x: wallRight + gap, w: 6200 * sc, h: 2400 * sc, rH: 880 * sc },
    { x: wallRight + gap + 6200 * sc + gap, w: 5000 * sc, h: 2100 * sc, rH: 700 * sc },
  ];

  ctx.save();
  for (const b of bldgs) {
    const top = groundY - b.h;
    // wall
    ctx.fillStyle = "#c9d4e0";
    ctx.fillRect(b.x, top, b.w, b.h);
    // roof
    if (b.rH > 0) {
      ctx.fillStyle = "#b5c3d2";
      ctx.beginPath();
      ctx.moveTo(b.x - 4, top);
      ctx.lineTo(b.x + b.w / 2, top - b.rH);
      ctx.lineTo(b.x + b.w + 4, top);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(b.x - 4, top);
      ctx.lineTo(b.x + b.w / 2, top - b.rH);
      ctx.lineTo(b.x + b.w + 4, top);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#b5c3d2";
      ctx.fillRect(b.x - 4, top - 12, b.w + 8, 12);
      ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1;
      ctx.strokeRect(b.x - 4, top - 12, b.w + 8, 12);
    }
    // wall outline
    ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1;
    ctx.strokeRect(b.x, top, b.w, b.h);

    // one window per building
    const winW = b.w * 0.18, winH = b.h * 0.22;
    const winX = b.x + b.w * 0.25, winY = groundY - b.h * 0.55;
    ctx.fillStyle = "#dde8f4";
    ctx.fillRect(winX, winY, winW, winH);
    ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 0.7;
    ctx.strokeRect(winX, winY, winW, winH);
  }
  ctx.restore();
}

// ── Single elevation cell ────────────────────────────────────────────────
function drawCell(
  ctx: CanvasRenderingContext2D,
  cellX: number, cellY: number,
  label: string,
  facadeWmm: number,   // width of THIS facade face in mm
  isGable: boolean,    // true = front/back; false = side (eave view)
  showDoor: boolean,
  widthMm: number, lengthMm: number,
  roofType: string, buildingType: string,
  sc: number,
) {
  const rH       = ridgeMm(widthMm);
  const wallWpx  = facadeWmm * sc;
  const wallHpx  = EAVE_MM   * sc;
  const ridgeHpx = rH        * sc;
  const ovhPx    = OVH_MM    * sc;

  const groundY  = cellY + CH2 - 75;
  const cellCX   = cellX + CW2 / 2;
  const wallL    = cellCX - wallWpx / 2;
  const wallR    = wallL + wallWpx;

  // ── Ground ──────────────────────────────────────────────────────────
  const gndH = 28;
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(wallL - 90, groundY, wallWpx + 180, gndH);
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 0.6;
  for (let i = 0; i < wallWpx + 180 + 20; i += 13) {
    ctx.beginPath();
    ctx.moveTo(wallL - 90 + i, groundY);
    ctx.lineTo(wallL - 90 + i - 16, groundY + gndH);
    ctx.stroke();
  }
  ctx.strokeStyle = "#475569"; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(wallL - 95, groundY); ctx.lineTo(wallR + 95, groundY);
  ctx.stroke();

  // ── Background buildings ─────────────────────────────────────────────
  drawBgBuildings(ctx, wallL, wallR, groundY, sc);

  // ── Sky gradient ──────────────────────────────────────────────────────
  const skyGrad = ctx.createLinearGradient(cellX, cellY + 28, cellX, groundY);
  skyGrad.addColorStop(0, "rgba(219,234,254,0.30)");
  skyGrad.addColorStop(1, "rgba(255,255,255,0.00)");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(cellX, cellY + 28, CW2, groundY - cellY - 28);

  if (isGable) {
    // ────────────────── GABLE ELEVATION (front / back) ──────────────────
    const roofL = wallL - ovhPx;
    const roofR = wallR + ovhPx;

    // Wall fill
    ctx.fillStyle = "#f0ede6";
    ctx.fillRect(wallL, groundY - wallHpx, wallWpx, wallHpx);

    if (roofType === "saltak") {
      const peakY = groundY - wallHpx - ridgeHpx;

      // Gable triangle fill
      ctx.fillStyle = "#e4dfd9";
      ctx.beginPath();
      ctx.moveTo(roofL, groundY - wallHpx);
      ctx.lineTo(cellCX, peakY);
      ctx.lineTo(roofR, groundY - wallHpx);
      ctx.closePath();
      ctx.fill();

      // Eave soffit (underside of overhang)
      ctx.strokeStyle = "#8898a8"; ctx.lineWidth = 1; ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(wallL, groundY - wallHpx); ctx.lineTo(roofL, groundY - wallHpx);
      ctx.moveTo(wallR, groundY - wallHpx); ctx.lineTo(roofR, groundY - wallHpx);
      ctx.stroke(); ctx.setLineDash([]);

      // Roof outline
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(roofL, groundY - wallHpx);
      ctx.lineTo(cellCX, peakY);
      ctx.lineTo(roofR, groundY - wallHpx);
      ctx.stroke();

      // Ridge end tick (shows ridge goes into the building)
      ctx.setLineDash([3, 3]); ctx.strokeStyle = "#64748b"; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cellCX - 14, peakY + 6); ctx.lineTo(cellCX + 14, peakY + 6);
      ctx.stroke(); ctx.setLineDash([]);

      // Pitch annotation on slope
      ctx.font = "italic 11px sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const slopeAngle = Math.atan2(ridgeHpx, wallWpx / 2);
      const annotX = wallL + wallWpx * 0.15 + ovhPx * 0.5;
      const annotY = groundY - wallHpx - ridgeHpx * 0.3;
      ctx.fillText(`${PITCH}°`, annotX, annotY);

    } else {
      // Flattak – parapet
      const parH = 80 * sc;
      ctx.fillStyle = "#e4dfd9";
      ctx.fillRect(wallL - 7, groundY - wallHpx - parH, wallWpx + 14, parH);
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2;
      ctx.strokeRect(wallL - 7, groundY - wallHpx - parH, wallWpx + 14, parH);
    }

    // Wall outline (on top of roof fill so it's crisp)
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 3;
    ctx.strokeRect(wallL, groundY - wallHpx, wallWpx, wallHpx);

    // Inner wall line
    const iWall = Math.max(5, 220 * sc);
    ctx.strokeStyle = "rgba(100,116,139,0.45)"; ctx.lineWidth = 1;
    ctx.strokeRect(wallL + iWall, groundY - wallHpx + iWall, wallWpx - iWall * 2, wallHpx - iWall);

    // ── Garage door ───────────────────────────────────────────────────
    if (showDoor && buildingType === "garasje") {
      // Single or double door based on width
      const singleW = 2500;
      const numDoors = widthMm >= 5000 ? 2 : 1;
      const doorWmm  = numDoors === 2 ? widthMm - 700 : Math.min(singleW, widthMm - 600);
      const doorHmm  = 2125;
      const dWpx = doorWmm * sc;
      const dHpx = doorHmm * sc;
      const dL   = cellCX - dWpx / 2;

      // Door fill (slightly different from wall)
      ctx.fillStyle = "#dbd6ce";
      ctx.fillRect(dL, groundY - dHpx, dWpx, dHpx);

      // Door panels – 4 horizontal sections
      ctx.strokeStyle = "#5a6a7a"; ctx.lineWidth = 1.2;
      ctx.strokeRect(dL, groundY - dHpx, dWpx, dHpx);
      const panH = dHpx / 4;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(dL, groundY - dHpx + panH * i);
        ctx.lineTo(dL + dWpx, groundY - dHpx + panH * i);
        ctx.stroke();
      }
      // Center divider for double door
      if (numDoors === 2) {
        ctx.beginPath();
        ctx.moveTo(cellCX, groundY - dHpx); ctx.lineTo(cellCX, groundY);
        ctx.stroke();
      }

      // Door label
      ctx.font = "10px sans-serif"; ctx.fillStyle = "#64748b";
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText("GARASJEPORT", cellCX, groundY - dHpx - 4);
    }

    // ── Height dim (eave) ───────────────────────────────────────────────
    vDim(ctx, wallL - 48, groundY - wallHpx, groundY, EAVE_MM);

    // ── Width dim ───────────────────────────────────────────────────────
    hDim(ctx, wallL, wallR, groundY + 32, widthMm);

  } else {
    // ────────────────── SIDE ELEVATION (eave view) ──────────────────────
    const roofL = wallL - ovhPx;
    const roofW = wallWpx + ovhPx * 2;

    // Wall fill
    ctx.fillStyle = "#f0ede6";
    ctx.fillRect(wallL, groundY - wallHpx, wallWpx, wallHpx);

    if (roofType === "saltak") {
      // Near slope (rectangular band in orthographic projection from eave side)
      ctx.fillStyle = "#e4dfd9";
      ctx.fillRect(roofL, groundY - wallHpx - ridgeHpx, roofW, ridgeHpx);

      // Slope hatching (diagonal lines show it's a sloping surface)
      ctx.save();
      ctx.beginPath();
      ctx.rect(roofL, groundY - wallHpx - ridgeHpx, roofW, ridgeHpx);
      ctx.clip();
      ctx.strokeStyle = "rgba(71,85,105,0.15)"; ctx.lineWidth = 1;
      const sp = 20;
      for (let d = -ridgeHpx * 2; d < roofW + ridgeHpx * 2; d += sp) {
        ctx.beginPath();
        ctx.moveTo(roofL + d, groundY - wallHpx);
        ctx.lineTo(roofL + d + ridgeHpx * 1.8, groundY - wallHpx - ridgeHpx);
        ctx.stroke();
      }
      ctx.restore();

      // Eave soffit
      ctx.strokeStyle = "#8898a8"; ctx.lineWidth = 1; ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(wallL, groundY - wallHpx); ctx.lineTo(roofL, groundY - wallHpx);
      ctx.moveTo(wallR, groundY - wallHpx); ctx.lineTo(roofL + roofW, groundY - wallHpx);
      ctx.stroke(); ctx.setLineDash([]);

      // Roof outline
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2.5;
      ctx.strokeRect(roofL, groundY - wallHpx - ridgeHpx, roofW, ridgeHpx);

      // Pitch label + arrow in roof area
      const pitchLabelX = cellCX;
      const pitchLabelY = groundY - wallHpx - ridgeHpx / 2;
      ctx.font = `italic ${Math.max(12, Math.round(ridgeHpx * 0.35))}px sans-serif`;
      ctx.fillStyle = "#4a5568";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(`${PITCH}°`, pitchLabelX, pitchLabelY);

      // Ridge dim (optional, shows height of ridge above eave)
      vDim(ctx, wallL - 48, groundY - wallHpx - ridgeHpx, groundY - wallHpx, Math.round(ridgeMm(widthMm)));

    } else {
      // Flattak
      const parH = 80 * sc;
      ctx.fillStyle = "#e4dfd9";
      ctx.fillRect(wallL - 7, groundY - wallHpx - parH, wallWpx + 14, parH);
      ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2;
      ctx.strokeRect(wallL - 7, groundY - wallHpx - parH, wallWpx + 14, parH);
    }

    // Wall outline
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 3;
    ctx.strokeRect(wallL, groundY - wallHpx, wallWpx, wallHpx);

    // Inner wall line
    const iWall = Math.max(5, 220 * sc);
    ctx.strokeStyle = "rgba(100,116,139,0.45)"; ctx.lineWidth = 1;
    ctx.strokeRect(wallL + iWall, groundY - wallHpx + iWall, wallWpx - iWall * 2, wallHpx - iWall);

    // Eave height dim
    vDim(ctx, wallL - 48, groundY - wallHpx, groundY, EAVE_MM);

    // Length dim
    hDim(ctx, wallL, wallR, groundY + 32, facadeWmm);
  }

  // ── Cell label ───────────────────────────────────────────────────────
  ctx.font = "bold 14px sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  ctx.fillText(label, cellX + CW2 / 2, cellY + 10);

  // ── Cell border ──────────────────────────────────────────────────────
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
  ctx.strokeRect(cellX + 0.5, cellY + 0.5, CW2 - 1, CH2 - 1);
}

// ── Title block ───────────────────────────────────────────────────────────
function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  yStart: number,
  widthMm: number, lengthMm: number,
  roofType: string, address: string, dateStr: string,
) {
  const W = CW, H = TH, y = yStart;
  const pad = 16;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, y, W, H);

  ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();

  const col1 = Math.round(W * 0.45);
  const col2 = Math.round(W * 0.72);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(col1, y); ctx.lineTo(col1, y + H);
  ctx.moveTo(col2, y); ctx.lineTo(col2, y + H);
  ctx.stroke();
  ctx.strokeRect(0, y, W, H);

  // Col 1
  ctx.font = "bold 21px sans-serif"; ctx.fillStyle = "#1e293b";
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("FASADETEGNING", pad, y + pad);
  ctx.font = "14px sans-serif"; ctx.fillStyle = "#334155";
  ctx.fillText(address || "–", pad, y + pad + 30);
  ctx.font = "13px sans-serif"; ctx.fillStyle = "#475569";
  const wL = (widthMm / 1000).toFixed(1).replace(".0", "");
  const lL = (lengthMm / 1000).toFixed(1).replace(".0", "");
  ctx.fillText(`${wL} × ${lL} m  ·  ${roofType === "saltak" ? "Saltak" : "Flattak"}  ·  Vegghoyde ${(EAVE_MM / 1000).toFixed(1)} m`, pad, y + pad + 52);
  ctx.fillText(`Takvinkel ${PITCH}°  ·  Takutstikk ${(OVH_MM / 1000).toFixed(1)} m`, pad, y + pad + 70);

  // Col 2
  ctx.font = "bold 15px sans-serif"; ctx.fillStyle = "#1e293b";
  ctx.fillText("Målestokk 1:50 (indikativ)", col1 + pad, y + pad);
  ctx.font = "13px sans-serif"; ctx.fillStyle = "#475569";
  ctx.fillText(`Dato: ${dateStr}`, col1 + pad, y + pad + 26);
  ctx.font = "bold 13px sans-serif"; ctx.fillStyle = "#ea580c";
  ctx.fillText("Garasjeproffen AS", col1 + pad, y + pad + 46);

  // Col 3 – simple north arrow (orientation note)
  const c3cx = col2 + Math.round((W - col2) / 2);
  ctx.font = "11px sans-serif"; ctx.fillStyle = "#64748b";
  ctx.textAlign = "center";
  ctx.fillText("FASADER VIST FRA", c3cx, y + pad + 4);
  ctx.fillText("UTSIDEN AV BYGGET", c3cx, y + pad + 18);
  // Small orientation arrow
  const ax = c3cx, ay = y + pad + 55, ar = 28;
  ctx.beginPath(); ctx.arc(ax, ay, ar + 5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.fill();
  ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1; ctx.stroke();
  ctx.font = `bold ${Math.round(ar * 0.55)}px sans-serif`;
  ctx.fillStyle = "#334155";
  ctx.fillText("SØR", ax, ay - ar * 0.25);
  ctx.font = `${Math.round(ar * 0.38)}px sans-serif`; ctx.fillStyle = "#64748b";
  ctx.fillText("FRONT", ax, ay + ar * 0.35);
}

// ── Main render ───────────────────────────────────────────────────────────
function render(
  canvas: HTMLCanvasElement,
  widthMm: number, lengthMm: number,
  roofType: string, buildingType: string, address: string,
) {
  const ctx = canvas.getContext("2d")!;
  const sc  = calcScale(widthMm, lengthMm);

  // Page background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, CW, CH);

  // Header strip
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, CW, HDR);
  ctx.font = "bold 20px sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText("FASADETEGNING", 24, HDR / 2);
  ctx.font = "13px sans-serif"; ctx.fillStyle = "#94a3b8";
  ctx.textAlign = "right";
  ctx.fillText(address || "Garasjeproffen AS", CW - 24, HDR / 2);

  // Separator line between cells
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(CW2, HDR); ctx.lineTo(CW2, CH - TH);   // vertical center
  ctx.moveTo(0, HDR + CH2); ctx.lineTo(CW, HDR + CH2); // horizontal center
  ctx.stroke();

  // 4 elevation cells
  // Top-left:  Sør (front, with door)
  drawCell(ctx, 0,    HDR,       "FASADE SØR  –  FRONT (med garasjeport)",
    widthMm, true,  true,  widthMm, lengthMm, roofType, buildingType, sc);
  // Top-right: Nord (back)
  drawCell(ctx, CW2,  HDR,       "FASADE NORD  –  BAK",
    widthMm, true,  false, widthMm, lengthMm, roofType, buildingType, sc);
  // Bottom-left: Vest (left side, eave view)
  drawCell(ctx, 0,    HDR + CH2, "FASADE VEST  –  SIDE",
    lengthMm, false, false, widthMm, lengthMm, roofType, buildingType, sc);
  // Bottom-right: Øst (right side, eave view)
  drawCell(ctx, CW2,  HDR + CH2, "FASADE ØST  –  SIDE",
    lengthMm, false, false, widthMm, lengthMm, roofType, buildingType, sc);

  // Outer border
  ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CW - 2, CH - TH - 1);

  // Title block
  const now = new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
  drawTitleBlock(ctx, CH - TH, widthMm, lengthMm, roofType, address, now);
}

// ── React component ───────────────────────────────────────────────────────
function FasadetegningContent() {
  const params = useSearchParams();

  const widthMm      = parseInt(params.get("widthMm")      ?? "5000", 10);
  const lengthMm     = parseInt(params.get("lengthMm")     ?? "6000", 10);
  const roofType     = params.get("roofType")     ?? "saltak";
  const buildingType = params.get("buildingType") ?? "garasje";
  const address      = params.get("address")      ?? "";
  const quoteId      = params.get("quote")        ?? "";
  const lat          = parseFloat(params.get("lat") ?? "");
  const lng          = parseFloat(params.get("lng") ?? "");
  const rotation     = parseInt(params.get("rotation") ?? "0", 10);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"idle" | "done">("idle");

  const situasjonsplanUrl = !isNaN(lat) && !isNaN(lng)
    ? `/admin/situasjonsplan?lat=${lat}&lng=${lng}&rotation=${rotation}&widthMm=${widthMm}&lengthMm=${lengthMm}&roofType=${roofType}&buildingType=${buildingType}${quoteId ? `&quote=${quoteId}` : ""}${address ? `&address=${encodeURIComponent(address)}` : ""}`
    : null;

  const draw = useCallback(() => {
    if (!canvasRef.current) return;
    render(canvasRef.current, widthMm, lengthMm, roofType, buildingType, address);
    setStatus("done");
  }, [widthMm, lengthMm, roofType, buildingType, address]);

  useEffect(() => { draw(); }, [draw]);

  function handleDownload() {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.href     = canvasRef.current.toDataURL("image/png");
    a.download = `fasadetegning${address ? `-${address.replace(/[^a-zA-Z0-9]/g, "_")}` : ""}.png`;
    a.click();
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { size: A4 portrait; margin: 0; }
        }
      `}</style>

      {/* Top bar */}
      <div className="no-print flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
        {quoteId ? (
          <>
            <Link href="/admin/quotes" className="text-sm text-gray-400 hover:text-orange-500">← Forespørsler</Link>
            <span className="text-gray-300">/</span>
            <Link href={`/admin/quotes/${quoteId}`} className="text-sm text-gray-500 font-mono hover:text-orange-500">{quoteId}</Link>
            <span className="text-gray-300">/</span>
          </>
        ) : (
          <>
            <Link href="/admin" className="text-sm text-gray-400 hover:text-orange-500">← Admin</Link>
            <span className="text-gray-300">/</span>
          </>
        )}
        <h1 className="text-sm font-semibold text-gray-800">Fasadetegning</h1>
        <div className="flex-1" />

        {situasjonsplanUrl && (
          <Link href={situasjonsplanUrl}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium px-3 py-1.5 transition-colors">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
            Situasjonsplan
          </Link>
        )}

        {status === "done" && (
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 text-xs font-medium px-3 py-1.5 transition-colors">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Last ned PNG
          </button>
        )}

        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 transition-colors shadow-sm">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Last ned PDF
        </button>
      </div>

      {/* Canvas wrapper */}
      <div className="flex justify-center bg-gray-100 min-h-screen py-6 print:py-0 print:bg-white">
        <div className="relative" style={{ width: CW, maxWidth: "100%" }}>
          <canvas
            ref={canvasRef}
            width={CW} height={CH}
            className="block shadow-lg print:shadow-none"
            style={{ width: "100%", height: "auto" }}
          />
        </div>
      </div>
    </>
  );
}

export default function AdminFasadetegningPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <svg className="animate-spin" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#ea580c" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
          <path d="M12 2a10 10 0 0 1 10 10"/>
        </svg>
      </div>
    }>
      <FasadetegningContent />
    </Suspense>
  );
}
