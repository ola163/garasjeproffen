"use client";

import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

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
  roofType: string = "saltak",
  buildingType: string = "garasje",
) {
  const latRad     = lat * Math.PI / 180;
  const mPerPixLon = (bbox.maxLon - bbox.minLon) / imgW * 111_412.84 * Math.cos(latRad);
  const mPerPixLat = (bbox.maxLat - bbox.minLat) / imgH * 111_132.92;

  const wallM = 0.22;  // 220 mm wall thickness
  const ovhM  = 0.40;  // 400 mm roof overhang (saltak)

  const halfWpx = widthMm  / 2000 / mPerPixLon;
  const halfLpx = lengthMm / 2000 / mPerPixLat;
  const wallWpx = wallM / mPerPixLon;
  const wallLpx = wallM / mPerPixLat;
  const ovhWpx  = ovhM  / mPerPixLon;
  const ovhLpx  = ovhM  / mPerPixLat;
  // Negate: canvas Y grows downward (south), geographic Y grows upward (north),
  // so the same rotation formula spins the opposite way — invert to match the map.
  const ang = -rotationDeg * Math.PI / 180;

  // Build a rotated rectangle centered on (cx, cy)
  function makeRect(hw: number, hl: number): [number, number][] {
    return (
      [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]] as [number, number][]
    ).map(([dx, dy]): [number, number] => [
      cx + dx * Math.cos(ang) - dy * Math.sin(ang),
      cy + dx * Math.sin(ang) + dy * Math.cos(ang),
    ]);
  }

  function polyPath(pts: [number, number][]) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function mid(a: [number, number], b: [number, number]): [number, number] {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }

  const outer = makeRect(halfWpx, halfLpx);
  const inner = makeRect(halfWpx - wallWpx, halfLpx - wallLpx);
  const ovh   = makeRect(halfWpx + ovhWpx,  halfLpx + ovhLpx);

  ctx.save();

  // ── 1. Takutstikk – dashed overhang outline (saltak only) ──────────
  if (roofType === "saltak") {
    polyPath(ovh);
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── 2. Building body fill ──────────────────────────────────────────
  polyPath(outer);
  ctx.fillStyle = "#f0ede6"; // warm off-white, like architectural paper
  ctx.fill();

  // ── 3. Inner wall line – 220 mm inside outer face ─────────────────
  if (buildingType !== "carport") {
    polyPath(inner);
    ctx.strokeStyle = "rgba(100,116,139,0.55)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ── 4. Møne (ridge line) – dashed along long axis ─────────────────
  if (roofType === "saltak") {
    let rA: [number, number], rB: [number, number];
    if (lengthMm >= widthMm) {
      // Long axis = Y → ridge top-mid → bottom-mid
      rA = mid(outer[0], outer[1]);
      rB = mid(outer[2], outer[3]);
    } else {
      // Long axis = X → ridge left-mid → right-mid
      rA = mid(outer[0], outer[3]);
      rB = mid(outer[1], outer[2]);
    }
    ctx.setLineDash([9, 5]);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(rA[0], rA[1]);
    ctx.lineTo(rB[0], rB[1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── 5. Outer walls ────────────────────────────────────────────────
  polyPath(outer);
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = buildingType === "carport" ? 1.5 : 3.5;
  if (buildingType === "carport") ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  // ── 6. Garasjeport – plan-view door symbol ────────────────────────
  // Door is on the short face: south (bottom) if length≥width, east (right) otherwise
  if (buildingType === "garasje") {
    let doorA: [number, number], doorB: [number, number];
    let oppA:  [number, number], oppB:  [number, number];
    if (lengthMm >= widthMm) {
      // Door on south face (bottom, short end)
      doorA = outer[3]; doorB = outer[2];
      oppA  = outer[0]; oppB  = outer[1];
    } else {
      // Door on east face (right, short end for wide/shallow garages)
      doorA = outer[1]; doorB = outer[2];
      oppA  = outer[0]; oppB  = outer[3];
    }

    const doorMid = mid(doorA, doorB);
    const oppMid  = mid(oppA, oppB);
    const fLen = Math.hypot(doorB[0] - doorA[0], doorB[1] - doorA[1]);

    // Unit vectors: along door face and inward
    const fux = (doorB[0] - doorA[0]) / fLen;
    const fuy = (doorB[1] - doorA[1]) / fLen;
    const inD = Math.hypot(oppMid[0] - doorMid[0], oppMid[1] - doorMid[1]);
    const iux = (oppMid[0] - doorMid[0]) / inD;
    const iuy = (oppMid[1] - doorMid[1]) / inD;

    // Door panels = 85% of facade width, depth ≈ wall thickness × 1.6
    const doorHW = fLen * 0.425;
    const pD = Math.max(wallWpx * 1.6, 5);

    const dL:  [number, number] = [doorMid[0] - fux * doorHW, doorMid[1] - fuy * doorHW];
    const dR:  [number, number] = [doorMid[0] + fux * doorHW, doorMid[1] + fuy * doorHW];
    const dLi: [number, number] = [dL[0] + iux * pD,          dL[1] + iuy * pD         ];
    const dRi: [number, number] = [dR[0] + iux * pD,          dR[1] + iuy * pD         ];
    const dMi: [number, number] = [doorMid[0] + iux * pD,     doorMid[1] + iuy * pD    ];

    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Left panel edge
    ctx.moveTo(dL[0],  dL[1]);  ctx.lineTo(dLi[0], dLi[1]);
    // Right panel edge
    ctx.moveTo(dR[0],  dR[1]);  ctx.lineTo(dRi[0], dRi[1]);
    // Inner face of panels (horizontal bar)
    ctx.moveTo(dLi[0], dLi[1]); ctx.lineTo(dRi[0], dRi[1]);
    // Center divider between two door panels
    ctx.moveTo(doorMid[0], doorMid[1]); ctx.lineTo(dMi[0], dMi[1]);
    ctx.stroke();
  }

  // ── 7. Dimension labels ───────────────────────────────────────────
  function edgeMid(a: [number, number], b: [number, number]): [number, number] {
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }
  function edgeAngle(a: [number, number], b: [number, number]): number {
    return Math.atan2(b[1] - a[1], b[0] - a[0]);
  }

  const widthLabel  = (widthMm  / 1000).toFixed(1).replace(".0", "") + " m";
  const lengthLabel = (lengthMm / 1000).toFixed(1).replace(".0", "") + " m";

  ctx.font = "bold 16px sans-serif";

  // Label background helper
  function labelWithBg(text: string, x: number, y: number, angle: number, baseline: CanvasTextBaseline) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.textAlign = "center";
    ctx.textBaseline = baseline;
    const tw = ctx.measureText(text).width;
    const th = 18;
    const offset = baseline === "top" ? 5 : -5;
    const oy = baseline === "top" ? offset : offset - th;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(-tw / 2 - 4, oy, tw + 8, th);
    ctx.fillStyle = "#c2410c";
    ctx.fillText(text, 0, baseline === "top" ? 5 : -5);
    ctx.restore();
  }

  // Right edge = widthLabel (existing placement)
  {
    const [bx, by] = edgeMid(outer[1], outer[2]);
    labelWithBg(widthLabel, bx, by, edgeAngle(outer[1], outer[2]), "top");
  }
  // Bottom edge = lengthLabel (existing placement)
  {
    const [rx, ry] = edgeMid(outer[2], outer[3]);
    labelWithBg(lengthLabel, rx, ry, edgeAngle(outer[2], outer[3]), "bottom");
  }

  ctx.restore();

  return { mPerPixLon, mPerPixLat, outerCorners: outer };
}

type BoundaryGeoJSON = {
  features: Array<{
    geometry: {
      type: "LineString" | "MultiLineString";
      coordinates: number[][] | number[][][];
    } | null;
  }>;
};

function drawBoundariesAndDistances(
  ctx: CanvasRenderingContext2D,
  garageCorners: [number, number][],
  boundaries: BoundaryGeoJSON,
  bbox: BBox,
  imgW: number,
  imgH: number,
  mPerPixLon: number,
) {
  function toPixel(lon: number, lat: number): [number, number] {
    return [
      (lon - bbox.minLon) / (bbox.maxLon - bbox.minLon) * imgW,
      (1 - (lat - bbox.minLat) / (bbox.maxLat - bbox.minLat)) * imgH,
    ];
  }

  const segments: [[number, number], [number, number]][] = [];
  for (const f of boundaries.features) {
    if (!f.geometry) continue;
    const rings: number[][][] =
      f.geometry.type === "LineString"
        ? [f.geometry.coordinates as number[][]]
        : (f.geometry.coordinates as number[][][]);
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        segments.push([toPixel(ring[i][0], ring[i][1]), toPixel(ring[i + 1][0], ring[i + 1][1])]);
      }
    }
  }
  if (segments.length === 0) return;

  // Draw boundary lines
  ctx.save();
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 5]);
  for (const [[x1, y1], [x2, y2]] of segments) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  ctx.setLineDash([]);

  function ptToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    const nx = x1 + t * dx, ny = y1 + t * dy;
    return { dist: Math.hypot(px - nx, py - ny), nx, ny };
  }

  const MAX_PX = 15 / mPerPixLon; // only show distances < 15 m
  const shown = new Set<number>(); // avoid duplicate labels per corner

  for (let ci = 0; ci < garageCorners.length; ci++) {
    const [cx, cy] = garageCorners[ci];
    let best = { dist: Infinity, nx: 0, ny: 0 };
    for (const [[x1, y1], [x2, y2]] of segments) {
      const r = ptToSeg(cx, cy, x1, y1, x2, y2);
      if (r.dist < best.dist) best = r;
    }
    if (best.dist > MAX_PX || shown.has(Math.round(best.dist))) continue;
    shown.add(Math.round(best.dist));

    const distM = best.dist * mPerPixLon;
    const midX = (cx + best.nx) / 2, midY = (cy + best.ny) / 2;

    // Arrow line
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(best.nx, best.ny); ctx.stroke();

    // Label
    const label = `${distM.toFixed(1)} m`;
    ctx.font = "bold 15px sans-serif";
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillRect(midX - tw / 2 - 5, midY - 11, tw + 10, 22);
    ctx.fillStyle = "#dc2626";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, midX, midY);
  }
  ctx.restore();
}

function drawTitleBlock(
  ctx: CanvasRenderingContext2D,
  yStart: number,
  address: string,
  rotation: number,
  widthMm: number,
  lengthMm: number,
  dateStr: string,
  kommune?: { navn: string; logo?: HTMLImageElement | null } | null,
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

  // Columns: col1 = kommunevåpen (left), col2 = project info (middle), col3 = scale/nord-pil (right, narrower)
  const col1 = Math.round(W * 0.20); // ~248px — kommunevåpen only
  const col2 = Math.round(W * 0.68); // ~843px — project info + Format A4 + Dato

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(col1, y); ctx.lineTo(col1, y + H);
  ctx.moveTo(col2, y); ctx.lineTo(col2, y + H);
  ctx.stroke();

  // Outer border
  ctx.strokeRect(0, y, W, H);

  const pad = 18;
  const col1CenterX = Math.round(col1 / 2);
  const col1W = col1;

  // ── Column 1 (far left): Kommunevåpen only ──
  if (kommune?.logo) {
    const maxLogoW = col1W - pad * 2;
    const maxLogoH = Math.round(H * 0.60);
    const scale = Math.min(maxLogoW / kommune.logo.width, maxLogoH / kommune.logo.height, 1);
    const lW = Math.round(kommune.logo.width  * scale);
    const lH = Math.round(kommune.logo.height * scale);
    const logoX = Math.round((col1W - lW) / 2);
    const logoY = y + Math.round((H - lH) / 2);
    ctx.drawImage(kommune.logo, logoX, logoY, lW, lH);
    if (kommune.navn) {
      ctx.font         = "bold 11px sans-serif";
      ctx.fillStyle    = "#64748b";
      ctx.textAlign    = "center";
      ctx.textBaseline = "top";
      ctx.fillText(kommune.navn, col1CenterX, logoY + lH + 4);
    }
  } else if (kommune?.navn) {
    ctx.font         = "bold 13px sans-serif";
    ctx.fillStyle    = "#334155";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(kommune.navn, col1CenterX, y + H / 2);
  }

  // ── Column 2 (middle): Project info + Format + Dato ──
  let yl = y + pad + 2;
  ctx.font      = "bold 22px sans-serif";
  ctx.fillStyle = "#1e293b";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("SITUASJONSPLAN", col1 + pad, yl);

  yl += 34;
  ctx.font      = "15px sans-serif";
  ctx.fillStyle = "#334155";
  const addrDisplay = address || "–";
  const col2W = col2 - col1;
  if (ctx.measureText(addrDisplay).width > col2W - pad * 2) {
    const words = addrDisplay.split(" ");
    let line1 = "", line2 = "";
    for (const w of words) {
      if (ctx.measureText(line1 + " " + w).width < col2W - pad * 2) {
        line1 += (line1 ? " " : "") + w;
      } else {
        line2 += (line2 ? " " : "") + w;
      }
    }
    ctx.fillText(line1, col1 + pad, yl);
    yl += 20;
    ctx.fillText(line2, col1 + pad, yl);
    yl += 24;
  } else {
    ctx.fillText(addrDisplay, col1 + pad, yl);
    yl += 28;
  }

  ctx.font      = "14px sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("Format: A4", col1 + pad, yl);
  yl += 22;
  ctx.fillText(`Dato: ${dateStr}`, col1 + pad, yl);

  // ── Column 3 (right, narrower): Scale / company + nord-pil ──
  const col3CenterX = col2 + Math.round((W - col2) / 2);
  let y3 = y + pad + 2;
  ctx.font      = "bold 15px sans-serif";
  ctx.fillStyle = "#1e293b";
  ctx.textAlign = "left";
  ctx.fillText("Målestokk 1:500", col2 + pad, y3);
  y3 += 28;
  ctx.font      = "13px sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("© Kartverket", col2 + pad, y3);
  y3 += 22;
  ctx.font      = "bold 13px sans-serif";
  ctx.fillStyle = "#ea580c";
  ctx.fillText("Garasjeproffen AS", col2 + pad, y3);

  // Nord-pil at bottom-centre of col3
  drawNorthArrow(ctx, col3CenterX, y + H - 55, 34);
}

function drawWatermark(ctx: CanvasRenderingContext2D) {
  // ── 1. Big diagonal "GarasjeProffen" text ──
  ctx.save();
  const cx      = CANVAS_W / 2;
  const cy      = MAP_H / 2;
  const diagLen = Math.hypot(CANVAS_W, MAP_H);
  const angle   = -Math.atan2(MAP_H, CANVAS_W);

  const testSize = 100;
  ctx.font = `bold ${testSize}px sans-serif`;
  const measured = ctx.measureText("GarasjeProffen").width;
  const fontSize = Math.floor((diagLen * 0.88) / measured * testSize);

  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalAlpha  = 0.12;
  ctx.fillStyle    = "#1e293b";
  ctx.textAlign    = "center";
  ctx.textBaseline = "middle";
  ctx.font         = `bold ${fontSize}px sans-serif`;
  ctx.fillText("GarasjeProffen", 0, 0);
  ctx.restore();

  // ── 2. Copyright notice box at bottom-centre of map area ──
  const copyrightLines = [
    "Denne tegning tilhører Garasjeproffen og er beskyttet av åndsverkloven.",
    "Kopiering og annen bruk uten Garasjeproffen sin godkjenning er forbudt.",
    "Misbruk kan medføre erstatningsansvar.",
  ];

  ctx.save();
  const cFontSize = 16;
  const cLineH    = cFontSize * 1.65;
  const cPadY     = 16;
  const cBoxW     = CANVAS_W - 80;
  const cBoxH     = copyrightLines.length * cLineH + cPadY * 2;
  const cBoxX     = (CANVAS_W - cBoxW) / 2;
  const cBoxY     = MAP_H - cBoxH - 50;

  ctx.globalAlpha = 0.92;
  ctx.fillStyle   = "rgba(255,255,255,0.93)";
  ctx.fillRect(cBoxX, cBoxY, cBoxW, cBoxH);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth   = 1.5;
  ctx.globalAlpha = 1;
  ctx.strokeRect(cBoxX, cBoxY, cBoxW, cBoxH);

  ctx.font         = `bold ${cFontSize}px sans-serif`;
  ctx.fillStyle    = "#1e293b";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  copyrightLines.forEach((line, i) => {
    ctx.fillText(line, CANVAS_W / 2, cBoxY + cPadY + i * cLineH);
  });
  ctx.restore();
}

// ── Manual drawing types + helpers ──
type DrawPoint = { x: number; y: number };
type DrawItem =
  | { type: "line"; pts: DrawPoint[] }
  | { type: "arrow"; x: number; y: number; angleDeg: number };

function drawManualLine(ctx: CanvasRenderingContext2D, pts: DrawPoint[]) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

function drawEntryArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angleDeg: number) {
  const len = 100;
  const rad = angleDeg * Math.PI / 180;
  const dx = Math.cos(rad) * len / 2;
  const dy = Math.sin(rad) * len / 2;
  const headLen = 20;
  const headAngle = 0.45;

  ctx.save();
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(x - dx, y - dy);
  ctx.lineTo(x + dx, y + dy);
  ctx.stroke();

  for (const [ax, ay, dir] of [
    [x + dx, y + dy, rad] as [number, number, number],
    [x - dx, y - dy, rad + Math.PI] as [number, number, number],
  ]) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - headLen * Math.cos(dir - headAngle), ay - headLen * Math.sin(dir - headAngle));
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - headLen * Math.cos(dir + headAngle), ay - headLen * Math.sin(dir + headAngle));
    ctx.stroke();
  }

  // Label "Inn/Ut" above shaft midpoint
  const perpRad = rad - Math.PI / 2;
  const lx = x + Math.cos(perpRad) * 22;
  const ly = y + Math.sin(perpRad) * 22;
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(rad);
  ctx.font = "bold 18px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const label = "Inn/Ut";
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillRect(-tw / 2 - 5, -13, tw + 10, 26);
  ctx.fillStyle = "#1e293b";
  ctx.fillText(label, 0, 0);
  ctx.restore();

  ctx.restore();
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
  roofType: string = "saltak",
  buildingType: string = "garasje",
): Promise<{ mPerPixLon: number }> {
  const ctx = canvas.getContext("2d")!;

  // 1. Fetch map images at A4 map area dimensions
  const apiUrl = `/api/admin/situasjonsplan/generate?lat=${lat}&lng=${lng}&halfMeters=80&width=${CANVAS_W}&height=${MAP_H}`;
  const res    = await fetch(apiUrl);
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

  const data = await res.json() as {
    topo: string; matrikkel: string;
    bbox: BBox;
    width: number; height: number;
    boundaries: BoundaryGeoJSON | null;
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
  const { mPerPixLon, outerCorners } = drawGarageFootprint(
    ctx, cx, cy, bbox, imgW, imgH,
    lat, widthMm, lengthMm, rotation,
    roofType, buildingType,
  );

  // 4b. Property boundaries + min distances
  if (data.boundaries?.features?.length) {
    drawBoundariesAndDistances(ctx, outerCorners, data.boundaries, bbox, imgW, imgH, mPerPixLon);
  }

  // 5. Scale bar (bottom-left of map area)
  drawScaleBar(ctx, 40, imgH - 68, mPerPixLon);

  // 6. North arrow (top-right of map area)
  drawNorthArrow(ctx, imgW - 68, 72, 32);

  // 7. Fetch municipality info + logo
  let kommune: { navn: string; logo?: HTMLImageElement | null } | null = null;
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const mRes = await fetch(
      `https://ws.geonorge.no/adresser/v1/punktsok?lat=${lat}&lon=${lng}&radius=500&utkoordsys=4258&treffPerSide=1`,
      { signal: ctrl.signal },
    );
    const mData = await mRes.json();
    const a = mData.adresser?.[0];
    if (a?.kommunenummer) {
      const navn = a.kommunenavn
        ? (a.kommunenavn as string).charAt(0) + (a.kommunenavn as string).slice(1).toLowerCase()
        : "";
      let logo: HTMLImageElement | null = null;
      try { logo = await loadImage(`/api/kommunevapen?nr=${a.kommunenummer}&navn=${encodeURIComponent(navn)}`); } catch { /* no logo */ }
      kommune = { navn, logo };
    }
  } catch { /* kommuneInfo stays null */ }

  // 8. Title block
  const now = new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
  drawTitleBlock(ctx, MAP_H, address, rotation, widthMm, lengthMm, now, kommune);

  // 9. Thin separator line between map and title block
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(0, MAP_H);
  ctx.lineTo(CANVAS_W, MAP_H);
  ctx.stroke();

  return { mPerPixLon };
}

// ── Print page content ──
function PrintContent() {
  const params     = useSearchParams();
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const baseImgRef = useRef<ImageData | null>(null);
  const [status,   setStatus]   = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Drawing state
  const [drawItems,      setDrawItems]      = useState<DrawItem[]>([]);
  const [showWatermark,  setShowWatermark]  = useState(false);
  const [activeTool,     setActiveTool]     = useState<"line" | "arrow" | null>(null);
  const [currentPts,     setCurrentPts]     = useState<DrawPoint[]>([]);
  const [mousePos,       setMousePos]       = useState<DrawPoint | null>(null);
  const [arrowAngleDeg,  setArrowAngleDeg]  = useState(0);

  const lat       = parseFloat(params.get("lat")      ?? "");
  const lng       = parseFloat(params.get("lng")      ?? "");
  const rotation  = parseInt  (params.get("rotation") ?? "0", 10);
  const widthMm   = parseInt  (params.get("widthMm")  ?? "5000", 10);
  const lengthMm  = parseInt  (params.get("lengthMm") ?? "6000", 10);

  const [localWidthMm,  setLocalWidthMm]  = useState(widthMm);
  const [localLengthMm, setLocalLengthMm] = useState(lengthMm);
  const roofType      = params.get("roofType")     ?? "saltak";
  const buildingType  = params.get("buildingType") ?? "garasje";
  const address       = params.get("address")      ?? "";
  const quoteId       = params.get("quote")        ?? "";

  const isValid = !isNaN(lat) && !isNaN(lng);

  const backUrl = quoteId
    ? `/admin/quotes/${quoteId}`
    : `/admin/situasjonsplan?lat=${lat}&lng=${lng}&rotation=${rotation}&widthMm=${widthMm}&lengthMm=${lengthMm}&roofType=${roofType}&buildingType=${buildingType}${address ? `&address=${encodeURIComponent(address)}` : ""}`;

  // Re-draw overlays on top of saved base image
  const applyOverlays = useCallback((items: DrawItem[], watermark: boolean) => {
    if (!canvasRef.current || !baseImgRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    ctx.putImageData(baseImgRef.current, 0, 0);
    for (const item of items) {
      if (item.type === "line") drawManualLine(ctx, item.pts);
      else drawEntryArrow(ctx, item.x, item.y, item.angleDeg);
    }
    if (watermark) drawWatermark(ctx);
  }, []);

  useEffect(() => {
    applyOverlays(drawItems, showWatermark);
  }, [drawItems, showWatermark, applyOverlays]);

  // ESC cancels active tool
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setActiveTool(null); setCurrentPts([]); setMousePos(null); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const render = useCallback(async () => {
    if (!canvasRef.current || !isValid) return;
    setStatus("loading");
    setErrorMsg(null);
    setDrawItems([]);
    setActiveTool(null);
    setCurrentPts([]);
    baseImgRef.current = null;
    try {
      await renderSituasjonsplan(
        canvasRef.current,
        lat, lng,
        localWidthMm, localLengthMm, rotation,
        address,
        roofType, buildingType,
      );
      baseImgRef.current = canvasRef.current.getContext("2d")!
        .getImageData(0, 0, CANVAS_W, CANVAS_H);
      setStatus("done");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Ukjent feil");
      setStatus("error");
    }
  }, [lat, lng, localWidthMm, localLengthMm, rotation, address, roofType, buildingType, isValid]);

  useEffect(() => {
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Convert a mouse event on the overlay div to canvas pixel coordinates
  function toCanvas(e: React.MouseEvent<HTMLDivElement>): DrawPoint {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top)  * (CANVAS_H / rect.height),
    };
  }

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!activeTool || status !== "done") return;
    const pt = toCanvas(e);
    if (activeTool === "arrow") {
      setDrawItems(prev => [...prev, { type: "arrow", x: pt.x, y: pt.y, angleDeg: arrowAngleDeg }]);
      setActiveTool(null);
    } else {
      setCurrentPts(prev => [...prev, pt]);
    }
  }

  function handleOverlayDoubleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (activeTool !== "line") return;
    e.preventDefault();
    const pt = toCanvas(e);
    const allPts = [...currentPts, pt];
    if (allPts.length >= 2) {
      setDrawItems(prev => [...prev, { type: "line", pts: allPts }]);
    }
    setCurrentPts([]);
    setActiveTool(null);
    setMousePos(null);
  }

  function handleOverlayMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (activeTool === "line" && currentPts.length > 0) setMousePos(toCanvas(e));
  }

  function finishLine() {
    if (currentPts.length >= 2) {
      setDrawItems(prev => [...prev, { type: "line", pts: currentPts }]);
    }
    setCurrentPts([]);
    setActiveTool(null);
    setMousePos(null);
  }

  function cancelTool() { setActiveTool(null); setCurrentPts([]); setMousePos(null); }

  function undoLast() { setDrawItems(prev => prev.slice(0, -1)); }

  function handleDownloadPng() {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.href     = canvasRef.current.toDataURL("image/png");
    a.download = `situasjonsplan${address ? `-${address.replace(/[^a-zA-Z0-9]/g, "_")}` : ""}.png`;
    a.click();
  }

  // Build SVG preview path for in-progress line
  const svgPreviewPts = mousePos ? [...currentPts, mousePos] : currentPts;
  const svgPolyline = svgPreviewPts.length >= 2
    ? svgPreviewPts.map(p => `${p.x},${p.y}`).join(" ")
    : null;

  const isDrawing = activeTool !== null && status === "done";
  const cursorStyle = activeTool === "line" ? "crosshair" : activeTool === "arrow" ? "cell" : "default";

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
      <div className="no-print flex flex-wrap items-center gap-2 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
        <Link href={backUrl} className="text-sm text-gray-400 hover:text-orange-500 transition-colors">← Tilbake</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-sm font-semibold text-gray-800">Situasjonsplan – Tegning</h1>

        {/* ── Dimension editor ── */}
        <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-3">
          <span className="text-xs text-gray-500">B:</span>
          <input
            type="number"
            value={localWidthMm / 1000}
            onChange={e => setLocalWidthMm(Math.round(parseFloat(e.target.value || "0") * 1000))}
            step="0.1" min="1" max="20"
            className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-xs text-center focus:border-orange-400 focus:outline-none"
          />
          <span className="text-xs text-gray-400">m</span>
          <span className="text-xs text-gray-500 ml-1">L:</span>
          <input
            type="number"
            value={localLengthMm / 1000}
            onChange={e => setLocalLengthMm(Math.round(parseFloat(e.target.value || "0") * 1000))}
            step="0.1" min="1" max="20"
            className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-xs text-center focus:border-orange-400 focus:outline-none"
          />
          <span className="text-xs text-gray-400">m</span>
          <button
            onClick={render}
            disabled={status === "loading"}
            className="flex items-center gap-1 rounded-lg border border-orange-300 text-orange-600 hover:bg-orange-50 disabled:opacity-40 text-xs font-medium px-2.5 py-1.5 transition-colors"
          >
            ↺ Tegn på nytt
          </button>
        </div>

        {/* ── Drawing tools (shown when done) ── */}
        {status === "done" && (
          <div className="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-3">
            {activeTool === null ? (
              <>
                <button
                  onClick={() => setActiveTool("line")}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 text-gray-600 hover:border-slate-400 hover:bg-slate-50 text-xs font-medium px-2.5 py-1.5 transition-colors"
                  title="Tegn grense manuelt – klikk punkter, dobbeltklikk for å avslutte"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="19" x2="19" y2="5"/></svg>
                  Tegn grense
                </button>
                <button
                  onClick={() => setActiveTool("arrow")}
                  className="flex items-center gap-1 rounded-lg border border-gray-200 text-gray-600 hover:border-slate-400 hover:bg-slate-50 text-xs font-medium px-2.5 py-1.5 transition-colors"
                  title="Plasser inn/ut symbol ved å klikke på kartet"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/><polyline points="5 12 12 5 19 12"/></svg>
                  Inn/Ut symbol
                </button>
                <button
                  onClick={() => setShowWatermark(w => !w)}
                  className={`flex items-center gap-1 rounded-lg border text-xs font-medium px-2.5 py-1.5 transition-colors ${
                    showWatermark
                      ? "border-orange-400 bg-orange-50 text-orange-600 hover:bg-orange-100"
                      : "border-gray-200 text-gray-600 hover:border-slate-400 hover:bg-slate-50"
                  }`}
                  title="Legg til diagonalt vannmerke over hele situasjonsplanen"
                >
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 3l18 18M7 4h10M4 8h16M4 16h16M7 20h10" opacity="0.5"/>
                    <text x="4" y="17" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none" opacity="0.7">GP</text>
                  </svg>
                  {showWatermark ? "Fjern vannmerke" : "Vannmerke"}
                </button>
                {drawItems.length > 0 && (
                  <button
                    onClick={undoLast}
                    className="flex items-center gap-1 rounded-lg border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 text-xs font-medium px-2.5 py-1.5 transition-colors"
                  >
                    ↩ Angre
                  </button>
                )}
              </>
            ) : activeTool === "line" ? (
              <>
                <span className="text-xs text-slate-500 italic">
                  {currentPts.length === 0 ? "Klikk for å starte linjen" : `${currentPts.length} punkt – dobbeltklikk eller`}
                </span>
                {currentPts.length >= 2 && (
                  <button onClick={finishLine} className="rounded-lg bg-slate-700 text-white text-xs font-medium px-2.5 py-1.5 hover:bg-slate-800 transition-colors">
                    Fullfør linje
                  </button>
                )}
                <button onClick={cancelTool} className="rounded-lg border border-gray-200 text-gray-500 text-xs font-medium px-2.5 py-1.5 hover:bg-gray-50 transition-colors">Avbryt</button>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-500 italic">Velg vinkel og klikk på kartet</span>
                <input
                  type="number"
                  value={arrowAngleDeg}
                  onChange={e => setArrowAngleDeg(Number(e.target.value))}
                  className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-xs text-center focus:border-orange-400 focus:outline-none"
                  title="Retningsvinkel i grader"
                />
                <span className="text-xs text-gray-400">°</span>
                <button onClick={cancelTool} className="rounded-lg border border-gray-200 text-gray-500 text-xs font-medium px-2.5 py-1.5 hover:bg-gray-50 transition-colors">Avbryt</button>
              </>
            )}
          </div>
        )}

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

          {/* Interactive drawing overlay (no-print) */}
          {isDrawing && (
            <div
              ref={overlayRef}
              className="no-print absolute inset-0"
              style={{ cursor: cursorStyle }}
              onClick={handleOverlayClick}
              onDoubleClick={handleOverlayDoubleClick}
              onMouseMove={handleOverlayMouseMove}
            >
              <svg
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                style={{ width: "100%", height: "100%", pointerEvents: "none" }}
              >
                {svgPolyline && (
                  <polyline
                    points={svgPolyline}
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="10 6"
                    opacity="0.7"
                  />
                )}
                {currentPts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="6" fill="#1e293b" opacity="0.8" />
                ))}
              </svg>
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
