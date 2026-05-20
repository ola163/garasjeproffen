"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import type { AddedElement } from "./DoorWindowAdder";

interface GarageMapboxProps {
  lengthMm: number;
  widthMm: number;
  roofType?: "saltak" | "flattak";
  buildingType?: "garasje" | "carport";
  externalCenter?: [number, number] | null;
  externalRotation?: number;
  onCenterChange?: (c: [number, number]) => void;
  onRotationChange?: (r: number) => void;
  readOnly?: boolean;
  forceIs3D?: boolean;
  streetView?: boolean;
  showNeighbors?: boolean;
  defaultCenter?: [number, number];
  onAddressSelect?: (address: string, coords: [number, number]) => void;
  addedElements?: AddedElement[];
  doorWidthMm?: number;
  doorHeightMm?: number;
  showCadastralToggle?: boolean;
  defaultShowCadastral?: boolean;
  onMapReady?: (map: mapboxgl.Map) => void;
  naboerPolygons?: [number, number][][];
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

async function reverseGeocodeNO(lat: number, lng: number): Promise<string> {
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
      return `${a.adressetekst}, ${a.postnummer} ${poststed}`;
    }
  } catch { /* fall through */ }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address&language=no&country=no&access_token=${TOKEN}`,
      { signal: ctrl.signal },
    );
    clearTimeout(t);
    const data = await res.json();
    return data.features?.[0]?.place_name ?? "Min posisjon";
  } catch { /* fall through */ }
  return "Min posisjon";
}

// ─── Pure helpers ────────────────────────────────────────────────────────────

type OSMBuildingData = { nodes: Array<{ lat: number; lon: number }>; height: number; roofShape?: string; color?: string };

function buildGarageGeoJSON(
  center: [number, number], lengthM: number, widthM: number, rotationDeg: number
): GeoJSON.Feature<GeoJSON.Polygon> {
  const [lng, lat] = center;
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const halfL = lengthM / 2, halfW = widthM / 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const corners: [number, number][] = [
    [-halfW, -halfL], [halfW, -halfL], [halfW, halfL], [-halfW, halfL], [-halfW, -halfL],
  ].map(([x, y]) => {
    const rx = x * Math.cos(rad) - y * Math.sin(rad);
    const ry = x * Math.sin(rad) + y * Math.cos(rad);
    return [lng + rx / mPerLng, lat + ry / mPerLat];
  });
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [corners] }, properties: {} };
}

function getModelUrl(bt?: string, rt?: string): string {
  if (bt === "carport") return "/Carport_GLB.glb";
  return rt === "saltak" ? "/garasje_saltak.glb" : "/Garasje_Flatt_tak.glb";
}

/** Point-to-segment distance (same units as inputs) */
function ptSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

/** Ray-casting point-in-polygon (lng/lat or meters — same units) */
function pointInPolygon(px: number, py: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > py) !== (yj > py)) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

/** Returns garage footprint corners as [lng, lat] pairs */
function garageCorners(
  center: [number, number], widthM: number, lengthM: number, rotDeg: number
): [number, number][] {
  const [lng, lat] = center;
  const rad = (rotDeg * Math.PI) / 180;
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos((lat * Math.PI) / 180);
  const hw = widthM / 2, hl = lengthM / 2;
  return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([x, y]) => {
    const rx = x * Math.cos(rad) - y * Math.sin(rad);
    const ry = x * Math.sin(rad) + y * Math.cos(rad);
    return [lng + rx / mPerLng, lat + ry / mPerLat] as [number, number];
  });
}

/** Minimum distance in metres from garage corners to a boundary polygon */
function minDistToBoundary(
  center: [number, number], widthM: number, lengthM: number, rotDeg: number,
  boundary: [number, number][]
): number {
  if (boundary.length < 2) return Infinity;
  const [refLng, refLat] = center;
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos((refLat * Math.PI) / 180);
  const toM = ([lng, lat]: [number, number]): [number, number] => [
    (lng - refLng) * mPerLng, (lat - refLat) * mPerLat,
  ];
  const cornersM = garageCorners(center, widthM, lengthM, rotDeg).map(toM);
  const boundaryM = boundary.map(toM);
  let min = Infinity;
  for (const [cx, cy] of cornersM) {
    for (let i = 0; i < boundaryM.length - 1; i++) {
      const [ax, ay] = boundaryM[i], [bx, by] = boundaryM[i + 1];
      min = Math.min(min, ptSegDist(cx, cy, ax, ay, bx, by));
    }
  }
  return min;
}

/** Nearest point on a boundary ring from a given lng/lat point */
function nearestBoundaryInfo(
  pLng: number, pLat: number,
  boundary: [number, number][],
): { distM: number; nearLng: number; nearLat: number } | null {
  if (boundary.length < 2) return null;
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos((pLat * Math.PI) / 180);
  let bestDist = Infinity, bestNx = 0, bestNy = 0;
  for (let i = 0; i < boundary.length - 1; i++) {
    const ax = (boundary[i][0] - pLng) * mPerLng;
    const ay = (boundary[i][1] - pLat) * mPerLat;
    const bx = (boundary[i + 1][0] - pLng) * mPerLng;
    const by = (boundary[i + 1][1] - pLat) * mPerLat;
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, (-ax * dx + -ay * dy) / lenSq));
    const nx = ax + t * dx, ny = ay + t * dy;
    const dist = Math.hypot(nx, ny);
    if (dist < bestDist) { bestDist = dist; bestNx = nx; bestNy = ny; }
  }
  return {
    distM: bestDist,
    nearLng: pLng + bestNx / mPerLng,
    nearLat: pLat + bestNy / mPerLat,
  };
}

/** Build GeoJSON feature collection for boundary distance annotations */
function buildDistanceAnnotations(
  center: [number, number],
  widthM: number, lengthM: number, rotDeg: number,
  boundary: [number, number][],
  maxDistM = 30,
): GeoJSON.FeatureCollection {
  const corners = garageCorners(center, widthM, lengthM, rotDeg);
  const sides: [[number, number], [number, number]][] = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];
  const features: GeoJSON.Feature[] = [];
  const seenDists = new Set<number>();
  const [cLng, cLat] = center;
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos((cLat * Math.PI) / 180);

  for (const [a, b] of sides) {
    const midLng = (a[0] + b[0]) / 2;
    const midLat = (a[1] + b[1]) / 2;
    const info = nearestBoundaryInfo(midLng, midLat, boundary);
    if (!info || info.distM > maxDistM) continue;

    // Only draw toward boundaries on the outward side of this wall
    const sideMx = (midLng - cLng) * mPerLng;
    const sideMy = (midLat - cLat) * mPerLat;
    const boundDx = (info.nearLng - midLng) * mPerLng;
    const boundDy = (info.nearLat - midLat) * mPerLat;
    if (sideMx * boundDx + sideMy * boundDy < 0) continue;

    const distKey = Math.round(info.distM * 10);
    if (seenDists.has(distKey)) continue;
    seenDists.add(distKey);

    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: [[midLng, midLat], [info.nearLng, info.nearLat]] },
      properties: { kind: "line" },
    });
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [(midLng + info.nearLng) / 2, (midLat + info.nearLat) / 2] },
      properties: { kind: "label", label: `${info.distM.toFixed(1)} m` },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Add or update Mapbox layers showing distance lines + labels */
function updateDistanceLayers(map: mapboxgl.Map, geojson: GeoJSON.FeatureCollection) {
  if (!map.isStyleLoaded()) return;
  const src = map.getSource("dist-annotations") as mapboxgl.GeoJSONSource | undefined;
  if (src) { src.setData(geojson); return; }
  map.addSource("dist-annotations", { type: "geojson", data: geojson });
  map.addLayer({
    id: "dist-lines",
    type: "line",
    source: "dist-annotations",
    filter: ["==", ["get", "kind"], "line"],
    paint: { "line-color": "#2563eb", "line-width": 2.5, "line-dasharray": [5, 3] },
  });
  map.addLayer({
    id: "dist-labels",
    type: "symbol",
    source: "dist-annotations",
    filter: ["==", ["get", "kind"], "label"],
    layout: {
      "text-field": ["get", "label"],
      "text-size": 13,
      "text-font": ["DIN Pro Bold", "Arial Unicode MS Bold"],
      "text-anchor": "center",
    },
    paint: {
      "text-color": "#1d4ed8",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2.5,
    },
  });
}

/** Parse Overpass API response into building footprints */
function parseOSM(data: unknown): OSMBuildingData[] {
  const elements = (data as { elements?: unknown[] })?.elements;
  if (!Array.isArray(elements)) return [];
  type OsmEl = { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; tags?: Record<string, string> };
  const els = elements as OsmEl[];
  const nodeMap = new Map<number, { lat: number; lon: number }>();
  for (const el of els)
    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined)
      nodeMap.set(el.id, { lat: el.lat, lon: el.lon });
  const buildings: OSMBuildingData[] = [];
  for (const el of els) {
    if (el.type !== "way" || !el.nodes || !el.tags?.building) continue;
    const rawH = el.tags.height
      ? parseFloat(el.tags.height)
      : el.tags["building:levels"]
      ? parseFloat(el.tags["building:levels"]) * 3.2
      : NaN;
    const height = isNaN(rawH) ? 7 : Math.max(3, rawH);
    const roofShape = el.tags["roof:shape"] ?? undefined;
    const color = el.tags["building:colour"] ?? el.tags["building:color"] ?? undefined;
    const nodes = el.nodes.map((id) => nodeMap.get(id)).filter(Boolean) as Array<{ lat: number; lon: number }>;
    if (nodes.length >= 3) buildings.push({ nodes, height, roofShape, color });
  }
  return buildings;
}

/** Build a Three.js Group (walls + roof) for a single building */
function buildingToGroup(
  { nodes, height }: OSMBuildingData,
  garMc: mapboxgl.MercatorCoordinate,
  s: number,
  index: number
): THREE.Group | null {
  if (nodes.length < 3) return null;

  const shape = new THREE.Shape();
  const first = nodes[0];
  const firstMc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: first.lon, lat: first.lat }, 0);
  shape.moveTo((firstMc.x - garMc.x) / s, -((firstMc.y - garMc.y) / s));
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i];
    const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: n.lon, lat: n.lat }, 0);
    shape.lineTo((mc.x - garMc.x) / s, -((mc.y - garMc.y) / s));
  }
  shape.closePath();

  const group = new THREE.Group();

  // Wall colour by height
  const base: [number, number, number] =
    height < 6  ? [200, 175, 140]
    : height < 12 ? [188, 182, 172]
    : [170, 178, 190];
  const jitter = ((index * 41) % 24) - 12;
  const [r, g, b] = base.map((c) => Math.max(0, Math.min(255, c + jitter)));
  const wallColor = new THREE.Color(r / 255, g / 255, b / 255);

  const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  const wallMesh = new THREE.Mesh(
    wallGeo,
    new THREE.MeshLambertMaterial({ color: wallColor })
  );
  wallMesh.rotation.x = -Math.PI / 2;
  group.add(wallMesh);

  // Flat roof cap
  const roofGeo = new THREE.ShapeGeometry(shape);
  const roofMesh = new THREE.Mesh(
    roofGeo,
    new THREE.MeshLambertMaterial({ color: 0x6a5c48, side: THREE.DoubleSide })
  );
  roofMesh.rotation.x = -Math.PI / 2;
  roofMesh.position.y = height;
  group.add(roofMesh);

  return group;
}

function clampToSegment(
  px: number, py: number,
  [ax, ay]: [number, number], [bx, by]: [number, number]
): [number, number] {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) return [ax, ay];
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return [ax + t * dx, ay + t * dy];
}

function buildHipRoof(pts: [number, number][], wallH: number, roofH: number): THREE.BufferGeometry {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const verts: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    verts.push(pts[i][0], wallH, -pts[i][1], pts[j][0], wallH, -pts[j][1], cx, wallH + roofH, -cy);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildGableRoof(pts: [number, number][], wallH: number, roofH: number): THREE.BufferGeometry {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); });
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const ra: [number, number] = maxX - minX >= maxY - minY ? [minX, cy] : [cx, minY];
  const rb: [number, number] = maxX - minX >= maxY - minY ? [maxX, cy] : [cx, maxY];
  const verts: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const [ax, ay] = pts[i], [bx, by] = pts[j];
    const [rax, ray] = clampToSegment(ax, ay, ra, rb);
    const [rbx, rby] = clampToSegment(bx, by, ra, rb);
    const apex = wallH + roofH;
    verts.push(ax, wallH, -ay, bx, wallH, -by, rbx, apex, -rby);
    verts.push(ax, wallH, -ay, rbx, apex, -rby, rax, apex, -ray);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

type BldRoofType = "hip" | "gable" | "flat" | "shed";

// Canvas-based horizontal kledning texture — one plank-row tile
function makeCladTexture(r: number, g: number, b: number): THREE.CanvasTexture {
  const W = 512, plankPx = 24, rows = 4;
  const H = plankPx * rows;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  for (let row = 0; row < rows; row++) {
    const y0 = row * plankPx;
    const v = ((row * 17) % 20) - 10;
    ctx.fillStyle = `rgb(${Math.min(255,Math.max(0,r+v))},${Math.min(255,Math.max(0,g+v))},${Math.min(255,Math.max(0,b+v))})`;
    ctx.fillRect(0, y0, W, plankPx - 2);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.fillRect(0, y0 + plankPx - 2, W, 2);
  }
  for (let x = 0; x < W; x += 10) {
    const a = 0.03 + Math.abs(Math.sin(x * 0.27)) * 0.05;
    ctx.fillStyle = `rgba(0,0,0,${a.toFixed(3)})`;
    ctx.fillRect(x, 0, 1, H);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Mono-pitch (pulttak) roof — footprint fan with per-vertex height along short axis
function buildShedRoof(pts: [number, number][], wallH: number, roofH: number): THREE.BufferGeometry {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(([x, y]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); });
  const isWide = (maxX - minX) >= (maxY - minY);
  const getH = ([x, y]: [number, number]) => {
    const t = isWide ? (y - minY) / Math.max(0.001, maxY - minY) : (x - minX) / Math.max(0.001, maxX - minX);
    return wallH + t * roofH;
  };
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const ch = pts.reduce((s, p) => s + getH(p), 0) / pts.length;
  const verts: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    verts.push(pts[i][0], getH(pts[i]), -pts[i][1], pts[j][0], getH(pts[j]), -pts[j][1], cx, ch, -cy);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

function buildingToRealisticGroup(
  { nodes, height, roofShape, color }: OSMBuildingData,
  garMc: mapboxgl.MercatorCoordinate,
  s: number,
  index: number
): THREE.Group | null {
  if (nodes.length < 3) return null;

  const pts: [number, number][] = nodes.map((n) => {
    const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: n.lon, lat: n.lat }, 0);
    return [(mc.x - garMc.x) / s, -((mc.y - garMc.y) / s)];
  });

  const group = new THREE.Group();

  // Per-building Norwegian wall palette (overridden by OSM colour tag if present)
  const jitter = ((index * 37) % 28) - 14;
  const norwPalette: [number, number, number][] = [
    [238, 228, 208], [218, 205, 190], [232, 220, 198],
    [208, 198, 185], [244, 232, 212], [200, 190, 178],
    [224, 210, 192], [212, 202, 188],
  ];
  let [pr, pg, pb] = norwPalette[index % norwPalette.length].map((c) =>
    Math.max(0, Math.min(255, c + jitter))
  );
  if (color) {
    const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
    if (m) {
      const hex = parseInt(m[1], 16);
      pr = (hex >> 16) & 0xff;
      pg = (hex >> 8) & 0xff;
      pb = hex & 0xff;
    }
  }

  const sokkelMat = new THREE.MeshStandardMaterial({ color: 0x8c8278, roughness: 0.92 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x5a9ab8, roughness: 0.04, metalness: 0.15,
    transparent: true, opacity: 0.82, side: THREE.DoubleSide,
  });
  const roofTones = [0x221a10, 0x1e1a14, 0x2a201a, 0x282020, 0x1c1c1c];
  const roofMat = new THREE.MeshStandardMaterial({
    color: roofTones[index % roofTones.length],
    roughness: 0.88, metalness: 0.02, side: THREE.DoubleSide,
  });

  const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const sokkelH = 0.45;
  const wallThk = 0.25;
  const floorH  = 3.0;
  const floors  = Math.max(1, Math.round(height / floorH));
  const winW = 0.92, winH = 1.12;
  // canvas tile: 4 planks × 24px, each plank = 0.22m → tile covers 0.88m
  const plankTileH = 0.88;

  // ─── Sokkel — footprint extruded to sokkelH ───────────────────────────────
  const footShape = new THREE.Shape();
  footShape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) footShape.lineTo(pts[i][0], pts[i][1]);
  footShape.closePath();
  const sokkelMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(footShape, { depth: sokkelH, bevelEnabled: false }),
    sokkelMat,
  );
  sokkelMesh.rotation.x = -Math.PI / 2;
  group.add(sokkelMesh);

  // ─── Per-wall panels: ExtrudeGeometry + canvas kledning texture ──────────
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const [x1, y1] = pts[i], [x2, y2] = pts[j];
    const ex = x2 - x1, ey = y2 - y1;
    const L = Math.hypot(ex, ey);
    if (L < 0.8) continue;

    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const rotY = Math.atan2(ey, ex);

    // Outer wall profile — CCW
    const wallProfile = new THREE.Shape();
    wallProfile.moveTo(-L / 2, sokkelH);
    wallProfile.lineTo( L / 2, sokkelH);
    wallProfile.lineTo( L / 2, height);
    wallProfile.lineTo(-L / 2, height);
    wallProfile.closePath();

    const numW = L >= 3.2 ? Math.max(1, Math.floor((L - 0.8) / 2.6)) : 0;
    const glassPositions: [number, number][] = [];

    for (let f = 0; f < floors; f++) {
      const floorBase = sokkelH + f * floorH;
      if (floorBase + winH + 0.9 > height) continue;
      const winBottom = floorBase + 0.9;
      for (let w = 0; w < numW; w++) {
        const lx = -L / 2 + ((w + 1) / (numW + 1)) * L;
        // CW winding (opposite of outer CCW shape — required by Earcut for holes)
        const hole = new THREE.Path();
        hole.moveTo(lx - winW / 2, winBottom);
        hole.lineTo(lx - winW / 2, winBottom + winH);
        hole.lineTo(lx + winW / 2, winBottom + winH);
        hole.lineTo(lx + winW / 2, winBottom);
        hole.closePath();
        wallProfile.holes.push(hole);
        glassPositions.push([lx, winBottom + winH / 2]);
      }
    }

    // Per-wall canvas kledning texture scaled to real-world plank size
    const cladTex = makeCladTexture(pr, pg, pb);
    cladTex.repeat.set(L / 0.6, (height - sokkelH) / plankTileH);
    const wallMat = new THREE.MeshStandardMaterial({
      map: cladTex, roughness: 0.88, metalness: 0.01,
    });

    const wallMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(wallProfile, { depth: wallThk, bevelEnabled: false }),
      wallMat,
    );
    wallMesh.position.set(mx, 0, -my);
    wallMesh.rotation.y = rotY;
    group.add(wallMesh);

    for (const [lx, winCY] of glassPositions) {
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(winW, winH), glassMat);
      glass.position.set(lx, winCY, 0.10);
      wallMesh.add(glass);
    }
  }

  // ─── Ceiling cap ──────────────────────────────────────────────────────────
  const ceilMesh = new THREE.Mesh(new THREE.ShapeGeometry(footShape), roofMat);
  ceilMesh.rotation.x = -Math.PI / 2;
  ceilMesh.position.y = height - 0.01;
  group.add(ceilMesh);

  // ─── Roof ─────────────────────────────────────────────────────────────────
  const radius = pts.reduce((a, p) => a + Math.hypot(p[0] - cx, p[1] - cy), 0) / pts.length;
  const roofH  = Math.max(1.2, Math.min(radius * 0.7, height * 0.6));

  const derivedRoof: BldRoofType =
    height >= 16 ? "flat"
    : roofShape === "flat" ? "flat"
    : roofShape === "gabled" ? "gable"
    : roofShape === "shed" || roofShape === "lean_to" ? "shed"
    : "hip";

  if (derivedRoof === "flat") {
    // ceiling cap serves as flat roof
  } else if (derivedRoof === "gable") {
    group.add(new THREE.Mesh(buildGableRoof(pts, height, roofH), roofMat));
  } else if (derivedRoof === "shed") {
    group.add(new THREE.Mesh(buildShedRoof(pts, height, roofH), roofMat));
  } else {
    group.add(new THREE.Mesh(buildHipRoof(pts, height, roofH), roofMat));
  }

  return group;
}

const WALL_H = 3.0;
const WALL_T = 0.12;

/** ECEF → local scene matrix (X=East, Y=Up, Z=-North, origin = garage centre at `height` m above ellipsoid) */
function makeEcefToLocalMatrix(lng: number, lat: number, height: number = 0): THREE.Matrix4 {
  const rad = Math.PI / 180;
  const φ = lat * rad, λ = lng * rad;
  const sinφ = Math.sin(φ), cosφ = Math.cos(φ), sinλ = Math.sin(λ), cosλ = Math.cos(λ);
  const a = 6378137.0, e2 = 0.00669437999014;
  const N = a / Math.sqrt(1 - e2 * sinφ * sinφ);
  // Include ellipsoidal height so the local origin matches `mc` (which also uses elevation)
  const ex = (N + height) * cosφ * cosλ, ey = (N + height) * cosφ * sinλ, ez = (N * (1 - e2) + height) * sinφ;
  // ENU basis in ECEF
  const eX = -sinλ,       eY = cosλ,        eZ = 0;
  const nX = -sinφ*cosλ,  nY = -sinφ*sinλ,  nZ = cosφ;
  const uX = cosφ*cosλ,   uY = cosφ*sinλ,   uZ = sinφ;
  // Row order: East(X), Up(Y), −North(Z)
  return new THREE.Matrix4().set(
    eX,   eY,   eZ,  -(eX*ex + eY*ey + eZ*ez),
    uX,   uY,   uZ,  -(uX*ex + uY*ey + uZ*ez),
   -nX,  -nY,  -nZ,   (nX*ex + nY*ey + nZ*ez),
    0,    0,    0,    1,
  );
}

/** Bearing (degrees) from a geographic center to a lngLat point; 0=North, 90=East */
function lngLatBearing(lngLat: { lng: number; lat: number }, center: [number, number]): number {
  const mPerLng = 111320 * Math.cos((center[1] * Math.PI) / 180);
  const dx = (lngLat.lng - center[0]) * mPerLng;
  const dy = (lngLat.lat - center[1]) * 111320;
  return Math.atan2(dx, dy) * (180 / Math.PI);
}

// ─── ThreeState ──────────────────────────────────────────────────────────────

type ThreeState = {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  model: THREE.Group | null;
  origSize: THREE.Vector3 | null;
  origCenter: THREE.Vector3 | null;
  origMinY: number;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function GarageMapbox({
  lengthMm, widthMm, roofType, buildingType,
  externalCenter, externalRotation,
  onCenterChange, onRotationChange,
  readOnly = false, forceIs3D = false, streetView = false,
  showNeighbors = false, defaultCenter, onAddressSelect,
  addedElements = [], doorWidthMm = 2500, doorHeightMm = 2125,
  showCadastralToggle = false, defaultShowCadastral = false,
  onMapReady, naboerPolygons,
}: GarageMapboxProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<mapboxgl.Map | null>(null);
  const markerRef     = useRef<mapboxgl.Marker | null>(null);
  const threeRef      = useRef<ThreeState | null>(null);
  const buildingGroupRef   = useRef<THREE.Group | null>(null);
  const boundaryRef        = useRef<[number, number][]>([]);
  const osmPolygonsRef     = useRef<Array<[number, number][]>>([]);

  // Element GLB assets and the live element group
  const doorGlbRef    = useRef<THREE.Group | null>(null);
  const windowGlbRef  = useRef<THREE.Group | null>(null);
  const addedGroupRef = useRef<THREE.Group | null>(null);
  const [glbsVersion, setGlbsVersion] = useState(0); // incremented when a GLB finishes loading

  // Render-time refs — read by Mapbox render callback every frame
  const centerRenderRef   = useRef<[number, number] | null>(null);
  const rotationRenderRef = useRef<number>(0);
  const dimsRenderRef     = useRef({ widthMm, lengthMm });

  const [internalCenter,   setInternalCenter]   = useState<[number, number] | null>(null);
  const [internalRotation, setInternalRotation] = useState(0);
  const [query,            setQuery]            = useState("");
  const [suggestions,      setSuggestions]      = useState<{ place_name: string; center: [number, number] }[]>([]);
  const [searching,        setSearching]        = useState(false);
  const [is3D,             setIs3D]             = useState(forceIs3D);
  const [realistic,        setRealistic]        = useState(false);
  const realisticRef       = useRef(false);
  const lastBuildingsRef   = useRef<{ buildings: OSMBuildingData[]; garCenter: [number, number] } | null>(null);
  const hiddenBuildingsRef = useRef(new Set<number>());
  const [terrainOffset,    setTerrainOffset]    = useState(0);
  const terrainOffsetRef   = useRef(0);
  const [googleTiles,      setGoogleTiles]      = useState(false);
  const googleTilesRef     = useRef(false);
  const [tilesStatus,      setTilesStatus]      = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tilesRendererRef      = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const TilesRendererClass    = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const GoogleCloudAuthClass  = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const GLTFExtensionsClass   = useRef<any>(null);
  const tilesWrapperRef       = useRef<THREE.Group | null>(null);
  const tilesCamRef        = useRef<THREE.PerspectiveCamera | null>(null);
  const [hiddenCount,      setHiddenCount]      = useState(0);
  const [boundaryWarning,  setBoundaryWarning]  = useState<null | "safe" | "nabovarsel" | "danger" | "on-building">(null);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [boundaryVersion,  setBoundaryVersion]  = useState(0);
  const [showCadastral,    setShowCadastral]    = useState(defaultShowCadastral);
  const [geoLocating,     setGeoLocating]     = useState(false);
  const [geoError,        setGeoError]        = useState<string | null>(null);
  const [geoDenied,       setGeoDenied]       = useState(false);
  const [showGeoPrompt,   setShowGeoPrompt]   = useState(false);
  const [mapBearing,      setMapBearing]      = useState(0);

  type ToolMode = "pan" | "move" | "rotate";
  const [toolMode,  setToolMode]  = useState<ToolMode>("move");
  const toolModeRef = useRef<ToolMode>("move");

  const center   = externalCenter   !== undefined ? externalCenter   : internalCenter;
  const rotation = externalRotation !== undefined ? externalRotation : internalRotation;

  function setCenter(c: [number, number] | null) {
    setInternalCenter(c);
    if (c) onCenterChange?.(c);
  }


  useEffect(() => { toolModeRef.current = toolMode; }, [toolMode]);
  useEffect(() => { terrainOffsetRef.current = terrainOffset; mapRef.current?.triggerRepaint(); }, [terrainOffset]);

  // Dynamically load 3d-tiles-renderer (optional dependency)
  useEffect(() => {
    import("3d-tiles-renderer").then((m) => { TilesRendererClass.current = m.TilesRenderer; }).catch(() => null);
    import("3d-tiles-renderer/plugins").then((m) => {
      GoogleCloudAuthClass.current = m.GoogleCloudAuthPlugin;
      GLTFExtensionsClass.current  = m.GLTFExtensionsPlugin;
    }).catch(() => null);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    if (toolMode === "pan") {
      map.dragPan.enable();
      canvas.style.cursor = "";
    } else {
      map.dragPan.disable();
      canvas.style.cursor = toolMode === "rotate" ? "crosshair" : "grab";
    }
  }, [toolMode]);

  const lengthM = lengthMm / 1000;
  const widthM  = widthMm  / 1000;
  const heightM = roofType === "saltak" ? 4.5 : 3.0;

  const SOURCE_ID      = "garage";
  const FILL_LAYER     = "garage-fill";
  const EXTRUSION_LAYER = "garage-3d";
  const OUTLINE_LAYER  = "garage-outline";

  // ─── Three.js helpers ────────────────────────────────────────────────────

  function applyModelScale(
    model: THREE.Group, origSize: THREE.Vector3,
    origCenter: THREE.Vector3, origMinY: number, wMm: number, lMm: number,
  ) {
    const scaleX = (wMm / 1000) / origSize.x;
    const scaleZ = (lMm / 1000) / origSize.z;
    model.scale.set(scaleX, 1, scaleZ);
    model.position.set(-origCenter.x * scaleX, -origMinY, -origCenter.z * scaleZ);
  }

  function loadModel(url: string) {
    const three = threeRef.current;
    if (!three) return;
    if (three.model) { three.scene.remove(three.model); three.model = null; }
    const { widthMm: w, lengthMm: l } = dimsRenderRef.current;
    new GLTFLoader().load(url, (gltf) => {
      const t = threeRef.current;
      if (!t) return;
      const model = gltf.scene;
      model.scale.set(1, 1, 1);
      const box = new THREE.Box3().setFromObject(model);
      const origSize   = new THREE.Vector3(); box.getSize(origSize);
      const origCenter = new THREE.Vector3(); box.getCenter(origCenter);
      const origMinY   = box.min.y;
      t.origSize = origSize; t.origCenter = origCenter; t.origMinY = origMinY;
      applyModelScale(model, origSize, origCenter, origMinY, w, l);
      t.model = model;
      t.scene.add(model);
      mapRef.current?.triggerRepaint();
    });
  }

  function clearBuildings() {
    const group = buildingGroupRef.current;
    if (!group) return;
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      child.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else (c.material as THREE.Material).dispose();
        }
      });
    }
  }

  function renderBuildings(buildings: OSMBuildingData[], garCenter: [number, number]) {
    clearBuildings();
    const group = buildingGroupRef.current;
    if (!group) return;
    const isRealistic = realisticRef.current;
    const hidden      = hiddenBuildingsRef.current;
    const garMc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: garCenter[0], lat: garCenter[1] }, 0);
    const s     = garMc.meterInMercatorCoordinateUnits();
    buildings.forEach((bld, idx) => {
      if (hidden.has(idx)) return;
      const g = isRealistic
        ? buildingToRealisticGroup(bld, garMc, s, idx)
        : buildingToGroup(bld, garMc, s, idx);
      if (g) group.add(g);
    });
    osmPolygonsRef.current = buildings.map((b) =>
      b.nodes.map((n) => [n.lon, n.lat] as [number, number])
    );
    lastBuildingsRef.current = { buildings, garCenter };
    mapRef.current?.triggerRepaint();
  }

  async function fetchBuildings(garCenter: [number, number]) {
    setLoadingBuildings(true);
    try {
      const [lng, lat] = garCenter;
      const res = await fetch(`/api/osm-buildings?lat=${lat}&lng=${lng}&radius=500`);
      if (!res.ok) return;
      const data = await res.json();
      const buildings = parseOSM(data);
      renderBuildings(buildings, garCenter);
    } catch {
      // silently ignore – buildings are decorative
    } finally {
      setLoadingBuildings(false);
    }
  }

  function addBoundaryLayer(map: mapboxgl.Map, geoJSON: GeoJSON.Feature<GeoJSON.Polygon>) {
    const existing = map.getSource("boundary") as mapboxgl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(geoJSON);
    } else {
      map.addSource("boundary", { type: "geojson", data: geoJSON });
      map.addLayer({
        id: "boundary-fill",
        type: "fill",
        source: "boundary",
        paint: { "fill-color": "#3b82f6", "fill-opacity": 0.07 },
      });
      map.addLayer({
        id: "boundary-line",
        type: "line",
        source: "boundary",
        paint: { "line-color": "#3b82f6", "line-width": 2.5, "line-dasharray": [5, 3] },
      });
    }
  }

  async function fetchBoundary(garCenter: [number, number]) {
    const [lng, lat] = garCenter;
    try {
      const res = await fetch(`/api/tomtegrenser?lat=${lat}&lng=${lng}`);
      if (!res.ok) return;
      const data = await res.json();
      const teiger = data?.teiger;
      if (!Array.isArray(teiger) || teiger.length === 0) return;
      const geom = teiger[0]?.geometri;
      if (!geom) return;
      const coords = geom.coordinates?.[0] as [number, number][] | undefined;
      if (!coords || coords.length < 3) return;

      boundaryRef.current = coords;
      setBoundaryVersion((v) => v + 1);

      const map = mapRef.current;
      if (map && map.isStyleLoaded()) {
        addBoundaryLayer(map, {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [coords] },
          properties: {},
        });
      }
    } catch {
      // silently ignore
    }
  }

  // ─── Proximity recalculation ─────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!center || boundaryRef.current.length < 3) {
      setBoundaryWarning(null);
      if (map?.isStyleLoaded()) {
        const src = map.getSource("dist-annotations") as mapboxgl.GeoJSONSource | undefined;
        src?.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }
    // On-building check
    for (const poly of osmPolygonsRef.current) {
      if (pointInPolygon(center[0], center[1], poly)) {
        setBoundaryWarning("on-building");
        return;
      }
    }
    const dist = minDistToBoundary(center, widthM, lengthM, rotation, boundaryRef.current);
    if (dist < 1)      setBoundaryWarning("danger");
    else if (dist < 4) setBoundaryWarning("nabovarsel");
    else               setBoundaryWarning("safe");

    // Draw dimension lines from each garage side to nearest boundary
    if (map) {
      const geojson = buildDistanceAnnotations(center, widthM, lengthM, rotation, boundaryRef.current);
      updateDistanceLayers(map, geojson);
    }
  }, [center, rotation, widthM, lengthM, boundaryVersion]);

  // ─── Map initialisation ──────────────────────────────────────────────────

  const updateGarage = useCallback(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    const geo = buildGarageGeoJSON(center, lengthM, widthM, rotation);
    const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (src) {
      src.setData(geo);
      // Hide the 2D fill polygon — the Three.js model is always shown when placed
      if (map.isStyleLoaded() && map.getLayer(FILL_LAYER))
        map.setLayoutProperty(FILL_LAYER, "visibility", "none");
    }
  }, [center, lengthM, widthM, rotation]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = TOKEN;

    const initCenter = externalCenter ?? defaultCenter ?? [5.7, 58.74];
    const initRot    = externalRotation ?? 0;

    let streetCenter: [number, number] = initCenter;
    if (streetView && externalCenter) {
      const rad   = ((initRot + 180) * Math.PI) / 180;
      const distM = 28;
      const lat   = initCenter[1];
      const dLng  = (distM * Math.sin(rad)) / (111320 * Math.cos((lat * Math.PI) / 180));
      const dLat  = (distM * Math.cos(rad)) / 111320;
      streetCenter = [initCenter[0] + dLng, initCenter[1] + dLat];
    }

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: streetView && externalCenter ? streetCenter : initCenter,
      zoom: streetView ? 19.5 : externalCenter ? 19 : 14,
      pitch:   streetView ? 72  : forceIs3D ? 60 : 0,
      bearing: streetView ? initRot : forceIs3D ? -20 : 0,
      preserveDrawingBuffer: true,
      logoPosition: "bottom-left",
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.doubleClickZoom.disable();

    map.on("load", () => {
      // Mapbox terrain DEM — enables 3D terrain when is3D/realistic
      map.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });

      // Kartverket Matrikkel WMS — property boundaries, addresses, parcel IDs (all Norway, free, no auth)
      map.addSource("cadastral", {
        type: "raster",
        tiles: [
          "https://wms.geonorge.no/skwms1/wms.matrikkel?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap" +
          "&LAYERS=eiendomsgrense,adresse,eiendoms_id&SRS=EPSG:3857" +
          "&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=TRUE&STYLES=",
        ],
        tileSize: 256,
        attribution: "© Kartverket",
      });
      map.addLayer({
        id: "cadastral-layer",
        type: "raster",
        source: "cadastral",
        paint: { "raster-opacity": 0.9 },
        layout: { visibility: "none" },
      });

      map.addSource(SOURCE_ID, { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: FILL_LAYER, type: "fill", source: SOURCE_ID,
        paint: { "fill-color": "#e2520a", "fill-opacity": 0.5 } });
      map.addLayer({ id: EXTRUSION_LAYER, type: "fill-extrusion", source: SOURCE_ID,
        paint: { "fill-extrusion-color": "#e2520a", "fill-extrusion-height": heightM,
                 "fill-extrusion-base": 0, "fill-extrusion-opacity": 0.75 },
        layout: { visibility: "none" } });
      map.addLayer({ id: OUTLINE_LAYER, type: "line", source: SOURCE_ID,
        paint: { "line-color": "#fff", "line-width": 2 } });

      // Neighbouring cadastral parcels (passed from parent)
      map.addSource("naboer-src", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "naboer-fill", type: "fill", source: "naboer-src", paint: { "fill-color": "#f97316", "fill-opacity": 0.08 } });
      map.addLayer({ id: "naboer-line", type: "line", source: "naboer-src", paint: { "line-color": "#f97316", "line-width": 2, "line-dasharray": [4, 2] } });

      // Mapbox Streets building layer for background (distant buildings)
      if (showNeighbors) {
        map.addLayer({
          id: "neighbors-3d",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#c0b8aa",
            "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "height"]],
            "fill-extrusion-base":   ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "min_height"]],
            "fill-extrusion-opacity": 0.5,
          },
          layout: { visibility: "none" },
        });
      }

      // Three.js custom layer for the GLB garage model
      const customLayer: mapboxgl.CustomLayerInterface = {
        id: "glb-model",
        type: "custom",
        renderingMode: "3d",
        onAdd(_map, gl) {
          const renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl as unknown as WebGL2RenderingContext,
            antialias: true,
          });
          renderer.autoClear = false;

          const scene = new THREE.Scene();
          scene.add(new THREE.HemisphereLight(0xc8dff0, 0x7a6a50, 1.2));
          const sun = new THREE.DirectionalLight(0xfff5e0, 2.2);
          sun.position.set(2, 5, 3).normalize();
          scene.add(sun);
          const fill = new THREE.DirectionalLight(0xd0e8ff, 0.5);
          fill.position.set(-2, 1, -1).normalize();
          scene.add(fill);

          // Building group — populated by fetchBuildings
          const buildingGroup = new THREE.Group();
          scene.add(buildingGroup);
          buildingGroupRef.current = buildingGroup;

          // Google 3D Tiles wrapper — matrix set to ECEF→local when tiles are enabled
          const tilesWrapper = new THREE.Group();
          tilesWrapper.matrixAutoUpdate = false;
          scene.add(tilesWrapper);
          tilesWrapperRef.current = tilesWrapper;

          threeRef.current = {
            scene, camera: new THREE.Camera(), renderer,
            model: null, origSize: null, origCenter: null, origMinY: 0,
          };
          // Trigger an immediate rebuild now that the scene is ready, even
          // before the element GLBs finish loading (they'll trigger again later).
          setGlbsVersion((v) => v + 1);
          loadModel(getModelUrl(buildingType, roofType));

          new GLTFLoader().load("/Garasjeport_2500x2125.glb", (gltf) => {
            doorGlbRef.current = gltf.scene;
            setGlbsVersion((v) => v + 1);
          });
          new GLTFLoader().load("/Vindu_100x50glb.glb", (gltf) => {
            windowGlbRef.current = gltf.scene;
            setGlbsVersion((v) => v + 1);
          });
        },
        render(_gl, matrix) {
          const three = threeRef.current;
          if (!three || !centerRenderRef.current) return;

          const [lng, lat] = centerRenderRef.current;
          const elevation = (mapRef.current?.queryTerrainElevation([lng, lat]) ?? 0) + terrainOffsetRef.current;
          const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng, lat }, elevation);
          const s  = mc.meterInMercatorCoordinateUnits();
          const rotRad = (rotationRenderRef.current * Math.PI) / 180;

          // Apply rotation to the garage model and its attached elements
          if (three.model) three.model.rotation.y = rotRad;
          if (addedGroupRef.current) addedGroupRef.current.rotation.y = rotRad;

          // Scene transform: translate to placement → scale → flip to Three.js Z-up
          // RotY is NOT included here so building meshes are not affected by garage rotation
          const l = new THREE.Matrix4()
            .makeTranslation(mc.x, mc.y, mc.z)
            .scale(new THREE.Vector3(s, -s, s))
            .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

          three.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(l);

          // Tick Google 3D Tiles renderer — use a proper PerspectiveCamera so that
          // sseDenominator is computed from a standard FOV, not the combined Mapbox VP matrix.
          const tiles = tilesRendererRef.current;
          const tilesCam = tilesCamRef.current;
          if (tiles && tilesCam && mapRef.current) {
            // ecefToLocal origin = garage at terrain elevation so local Y=0 is ground level,
            // matching mc.z which also uses elevation.  Without this, tiles appear elevated
            // by one terrain-height above where they should be.
            const ecefToLocal = makeEcefToLocalMatrix(lng, lat, elevation);
            // Update tiles.group.matrix each frame so it tracks terrain changes.
            tiles.group.matrix.copy(ecefToLocal);
            tiles.group.matrixWorldNeedsUpdate = true;

            // Derive camera position from Mapbox's free-camera state, convert to local ENU.
            const freeCam = mapRef.current.getFreeCameraOptions();
            if (freeCam.position) {
              const lngLat = freeCam.position.toLngLat();
              const alt    = freeCam.position.toAltitude();
              const rad    = Math.PI / 180;
              const clat   = lngLat.lat * rad, clng = lngLat.lng * rad;
              const ea     = 6378137.0, ee2 = 0.00669437999014;
              const Nv     = ea / Math.sqrt(1 - ee2 * Math.sin(clat) * Math.sin(clat));
              const camPos = new THREE.Vector3(
                (Nv + alt) * Math.cos(clat) * Math.cos(clng),
                (Nv + alt) * Math.cos(clat) * Math.sin(clng),
                (Nv * (1 - ee2) + alt) * Math.sin(clat),
              ).applyMatrix4(ecefToLocal);
              tilesCam.position.copy(camPos);
              // Always focus on the garage origin — loads only nearby tiles.
              tilesCam.lookAt(0, 0, 0);
            } else {
              tilesCam.position.set(0, 500, 0);
              tilesCam.lookAt(0, 0, 0);
            }
            const canvas = three.renderer.domElement;
            const camDist = tilesCam.position.length();
            tilesCam.aspect = canvas.width / canvas.height;
            tilesCam.fov   = 60;
            tilesCam.near  = Math.max(1, camDist * 0.01);
            tilesCam.far   = camDist + 400; // 400 m past garage → only load nearby buildings
            tilesCam.updateProjectionMatrix();
            tilesCam.updateMatrixWorld();
            // tiles.group.matrix = ecefToLocal (set at creation, matrixAutoUpdate=false).
            // Call updateMatrixWorld(true) BEFORE tiles.update() so frustum culling in
            // tiles.update() reads the correct group.matrixWorld.  The patch on the group
            // also propagates any newly-loaded tile scenes that have matrixWorldNeedsUpdate=true.
            tiles.group.updateMatrixWorld(true);
            tiles.setCamera(tilesCam);
            tiles.setResolutionFromRenderer(tilesCam, three.renderer);
            tiles.update();
            // Second call after tiles.update() in case it added new tile scenes.
            tiles.group.updateMatrixWorld(true);
            mapRef.current.triggerRepaint();
          }

          three.renderer.resetState();
          if (tilesRendererRef.current) three.renderer.clearDepth();
          three.renderer.render(three.scene, three.camera);
        },
      };
      map.addLayer(customLayer);

      if (externalCenter) {
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = new mapboxgl.Marker({ color: "#e2520a" })
          .setLngLat(externalCenter).addTo(map);
        if (forceIs3D || streetView)
          map.setLayoutProperty(FILL_LAYER, "visibility", "none");
      }

      onMapReady?.(map);

      // Sync bearing state for compass
      map.on("rotate", () => setMapBearing(map.getBearing()));
      setMapBearing(map.getBearing());
    });

    if (!readOnly) {
      map.dragPan.disable(); // default tool is "move"
      map.getCanvas().style.cursor = "grab";

      // Local drag state — lives in the init closure, safe from React re-renders
      type DS = {
        clientX: number; clientY: number;
        prevX: number; prevY: number;
        startLngLat: mapboxgl.LngLat;
        startBearing: number; startRotation: number;
        startCenter: [number, number];
        effectiveMode: "move" | "rotate" | "pan";
      };
      let ds: DS | null = null;
      let dragging = false;

      map.on("mousedown", (e) => {
        if (toolModeRef.current === "pan") return; // Mapbox dragPan handles it
        dragging = false;
        const cur = centerRenderRef.current;
        const mode = toolModeRef.current;

        let effectiveMode: "move" | "rotate" | "pan";
        if (mode === "rotate") {
          effectiveMode = "rotate";
        } else if (!cur) {
          effectiveMode = "move"; // no garage placed yet — place on click
        } else {
          const { widthMm: wm, lengthMm: lm } = dimsRenderRef.current;
          const corners = garageCorners(cur, wm / 1000, lm / 1000, rotationRenderRef.current);
          effectiveMode = pointInPolygon(e.lngLat.lng, e.lngLat.lat, corners) ? "move" : "pan";
        }

        ds = {
          clientX: e.originalEvent.clientX,
          clientY: e.originalEvent.clientY,
          prevX: e.originalEvent.clientX,
          prevY: e.originalEvent.clientY,
          startLngLat: e.lngLat,
          startBearing: cur ? lngLatBearing(e.lngLat, cur) : 0,
          startRotation: rotationRenderRef.current,
          startCenter: cur ? [cur[0], cur[1]] : [e.lngLat.lng, e.lngLat.lat],
          effectiveMode,
        };
        map.getCanvas().style.cursor = effectiveMode === "rotate" ? "crosshair" : "grabbing";
      });

      map.on("mousemove", (e) => {
        if (!ds) return;
        const dx = e.originalEvent.clientX - ds.clientX;
        const dy = e.originalEvent.clientY - ds.clientY;
        if (!dragging && Math.hypot(dx, dy) < 4) return;
        dragging = true;

        if (ds.effectiveMode === "pan") {
          const pdx = e.originalEvent.clientX - ds.prevX;
          const pdy = e.originalEvent.clientY - ds.prevY;
          ds.prevX = e.originalEvent.clientX;
          ds.prevY = e.originalEvent.clientY;
          map.panBy([-pdx, -pdy], { animate: false });
        } else if (ds.effectiveMode === "rotate" && centerRenderRef.current) {
          const delta = lngLatBearing(e.lngLat, centerRenderRef.current) - ds.startBearing;
          const newRot = ((ds.startRotation + delta) % 360 + 360) % 360;
          setInternalRotation(Math.round(newRot));
          onRotationChange?.(Math.round(newRot));
        } else if (ds.effectiveMode === "move") {
          const newCenter: [number, number] = [
            ds.startCenter[0] + (e.lngLat.lng - ds.startLngLat.lng),
            ds.startCenter[1] + (e.lngLat.lat - ds.startLngLat.lat),
          ];
          setInternalCenter(newCenter);
          onCenterChange?.(newCenter);
          if (markerRef.current) markerRef.current.setLngLat(newCenter);
        }
      });

      map.on("mouseup", (e) => {
        const wasDragging = dragging;
        const savedDs = ds;
        dragging = false;
        ds = null;
        map.getCanvas().style.cursor = toolModeRef.current === "rotate" ? "crosshair" : "grab";
        if (!wasDragging && savedDs?.effectiveMode === "move") {
          const c: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          // In realistic mode: clicking a building polygon hides/shows it
          if (realisticRef.current) {
            const bldIdx = osmPolygonsRef.current.findIndex((poly) =>
              pointInPolygon(c[0], c[1], poly)
            );
            if (bldIdx >= 0) {
              if (hiddenBuildingsRef.current.has(bldIdx)) hiddenBuildingsRef.current.delete(bldIdx);
              else hiddenBuildingsRef.current.add(bldIdx);
              setHiddenCount(hiddenBuildingsRef.current.size);
              const cached = lastBuildingsRef.current;
              if (cached) renderBuildings(cached.buildings, cached.garCenter);
              return;
            }
          }
          setInternalCenter(c);
          onCenterChange?.(c);
          if (markerRef.current) markerRef.current.remove();
          markerRef.current = new mapboxgl.Marker({ color: "#e2520a" }).setLngLat(c).addTo(map);
          reverseGeocodeNO(e.lngLat.lat, e.lngLat.lng).then((name) => {
            setQuery(name);
            onAddressSelect?.(name, c);
          });
        }
      });

      // Double-click always places / moves garage to that position
      map.on("dblclick", (e) => {
        if (toolModeRef.current === "pan") return;
        const c: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setInternalCenter(c);
        onCenterChange?.(c);
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = new mapboxgl.Marker({ color: "#e2520a" }).setLngLat(c).addTo(map);
        reverseGeocodeNO(e.lngLat.lat, e.lngLat.lng).then((name) => {
          setQuery(name);
          onAddressSelect?.(name, c);
        });
      });

      // ── Touch equivalents (mobile) ───────────────────────────────────────
      map.on("touchstart", (e) => {
        if (e.originalEvent.touches.length !== 1) { ds = null; return; }
        if (toolModeRef.current === "pan") return;
        dragging = false;
        const cur = centerRenderRef.current;
        const mode = toolModeRef.current;

        let effectiveMode: "move" | "rotate" | "pan";
        if (mode === "rotate") {
          effectiveMode = "rotate";
        } else if (!cur) {
          effectiveMode = "move";
        } else {
          const { widthMm: wm, lengthMm: lm } = dimsRenderRef.current;
          const corners = garageCorners(cur, wm / 1000, lm / 1000, rotationRenderRef.current);
          effectiveMode = pointInPolygon(e.lngLat.lng, e.lngLat.lat, corners) ? "move" : "pan";
        }

        const t0 = e.originalEvent.touches[0];
        ds = {
          clientX: t0.clientX, clientY: t0.clientY,
          prevX: t0.clientX,   prevY: t0.clientY,
          startLngLat: e.lngLat,
          startBearing: cur ? lngLatBearing(e.lngLat, cur) : 0,
          startRotation: rotationRenderRef.current,
          startCenter: cur ? [cur[0], cur[1]] : [e.lngLat.lng, e.lngLat.lat],
          effectiveMode,
        };
      });

      map.on("touchmove", (e) => {
        if (e.originalEvent.touches.length !== 1 || !ds) return;
        const t0 = e.originalEvent.touches[0];
        const dx = t0.clientX - ds.clientX;
        const dy = t0.clientY - ds.clientY;
        if (!dragging && Math.hypot(dx, dy) < 4) return;
        dragging = true;

        if (ds.effectiveMode === "pan") {
          const pdx = t0.clientX - ds.prevX;
          const pdy = t0.clientY - ds.prevY;
          ds.prevX = t0.clientX;
          ds.prevY = t0.clientY;
          map.panBy([-pdx, -pdy], { animate: false });
        } else if (ds.effectiveMode === "rotate" && centerRenderRef.current) {
          const delta = lngLatBearing(e.lngLat, centerRenderRef.current) - ds.startBearing;
          const newRot = ((ds.startRotation + delta) % 360 + 360) % 360;
          setInternalRotation(Math.round(newRot));
          onRotationChange?.(Math.round(newRot));
        } else if (ds.effectiveMode === "move") {
          const newCenter: [number, number] = [
            ds.startCenter[0] + (e.lngLat.lng - ds.startLngLat.lng),
            ds.startCenter[1] + (e.lngLat.lat - ds.startLngLat.lat),
          ];
          setInternalCenter(newCenter);
          onCenterChange?.(newCenter);
          if (markerRef.current) markerRef.current.setLngLat(newCenter);
        }
      });

      map.on("touchend", (e) => {
        const wasDragging = dragging;
        const savedDs = ds;
        dragging = false;
        ds = null;
        if (!wasDragging && savedDs?.effectiveMode === "move") {
          const c: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          setInternalCenter(c);
          onCenterChange?.(c);
          if (markerRef.current) markerRef.current.remove();
          markerRef.current = new mapboxgl.Marker({ color: "#e2520a" }).setLngLat(c).addTo(map);
          reverseGeocodeNO(e.lngLat.lat, e.lngLat.lng).then((name) => {
            setQuery(name);
            onAddressSelect?.(name, c);
          });
        }
      });
    }

    return () => {
      if (tilesRendererRef.current) { tilesRendererRef.current.dispose(); tilesRendererRef.current = null; }
      map.remove();
      mapRef.current        = null;
      threeRef.current      = null;
      buildingGroupRef.current = null;
      addedGroupRef.current = null;
      tilesWrapperRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { updateGarage(); }, [updateGarage]);

  useEffect(() => {
    centerRenderRef.current = center;
    const map = mapRef.current;
    if (!center || !map) { map?.triggerRepaint(); return; }

    if (map.isStyleLoaded()) {
      const mc = map.getCenter();
      const dlng = Math.abs(center[0] - mc.lng);
      const dlat = Math.abs(center[1] - mc.lat);
      // Fly only when the change is large enough to be external (geolocation / address pick)
      // — not a user drag which stays within a few pixels (~0.0001°)
      if (dlng > 0.0005 || dlat > 0.0005) {
        map.flyTo({ center, zoom: 19, duration: 1200 });
        return;
      }
    }
    map.triggerRepaint();
  }, [center]);

  useEffect(() => {
    rotationRenderRef.current = rotation;
    mapRef.current?.triggerRepaint();
  }, [rotation]);

  useEffect(() => {
    mapRef.current?.triggerRepaint();
  }, [is3D]);

  useEffect(() => {
    dimsRenderRef.current = { widthMm, lengthMm };
    const three = threeRef.current;
    if (!three?.model || !three.origSize || !three.origCenter) return;
    applyModelScale(three.model, three.origSize, three.origCenter, three.origMinY, widthMm, lengthMm);
    mapRef.current?.triggerRepaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthMm, lengthMm]);

  useEffect(() => {
    loadModel(getModelUrl(buildingType, roofType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roofType, buildingType]);

  // ─── Element group (port + windows/doors on walls) ───────────────────────

  const rebuildElements = useCallback(() => {
    const three = threeRef.current;
    if (!three) return;

    // Tear down previous group
    if (addedGroupRef.current) {
      three.scene.remove(addedGroupRef.current);
      addedGroupRef.current.traverse((c) => {
        if (c instanceof THREE.Mesh) {
          c.geometry.dispose();
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else (c.material as THREE.Material).dispose();
        }
      });
      addedGroupRef.current = null;
    }

    const group = new THREE.Group();
    const halfL = lengthMm / 2000;
    const halfW = widthMm  / 2000;
    const DW    = doorWidthMm  / 1000;
    const DH    = doorHeightMm / 1000;

    // ── Garage port (flattak, not carport) ─────────────────────────────────
    if (roofType === "flattak" && buildingType !== "carport") {
      if (doorGlbRef.current) {
        const clone = doorGlbRef.current.clone(true);
        const box  = new THREE.Box3().setFromObject(clone);
        const size = new THREE.Vector3(); box.getSize(size);
        clone.scale.set(
          size.x > 0.001 ? DW   / size.x : 1,
          size.y > 0.001 ? DH   / size.y : 1,
          size.z > 0.001 ? 0.05 / size.z : 1,
        );
        clone.position.set(0, DH / 2, halfL - 0.02);
        group.add(clone);
      } else {
        // Fallback box until the GLB finishes loading
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(DW, DH, 0.05),
          new THREE.MeshLambertMaterial({ color: 0x8B6914 }),
        );
        mesh.position.set(0, DH / 2, halfL - 0.02);
        group.add(mesh);
      }
    }

    // ── Added windows and doors on walls ───────────────────────────────────
    const elDims = (cat: string) => {
      const w  = cat === "door" ? 0.9 : 1.0;
      const h  = cat === "door" ? 2.1 : cat === "window1" ? 0.5 : cat === "window2" ? 0.6 : 1.0;
      const cy = cat === "door" ? h / 2 : WALL_H * 0.55;
      return { w, h, cy };
    };

    for (const el of addedElements) {
      const { w, h, cy } = elDims(el.category);
      const fracs = el.placement === "both" ? [-0.25, 0.25] : el.placement === "left" ? [0.25] : [-0.25];

      for (const frac of fracs) {
        const isFrontBack = el.side === "front" || el.side === "back";

        if (isFrontBack) {
          const dir  = el.side === "front" ? 1 : -1;
          const x    = (widthMm / 1000) * frac;
          const wCz  = dir * (halfL - WALL_T / 2);
          const rotY = el.side === "back" ? Math.PI : 0;

          if (el.category === "window1" && windowGlbRef.current) {
            const clone = windowGlbRef.current.clone(true);
            const box  = new THREE.Box3().setFromObject(clone);
            const size = new THREE.Vector3(); box.getSize(size);
            if (size.x > 0.001 && size.y > 0.001)
              clone.scale.set(1.0 / size.x, 0.5 / size.y, size.z > 0.001 ? WALL_T / size.z : 1);
            const box2    = new THREE.Box3().setFromObject(clone);
            const center2 = new THREE.Vector3(); box2.getCenter(center2);
            clone.position.sub(center2);
            const g = new THREE.Group(); g.add(clone);
            g.position.set(x, cy, wCz); g.rotation.y = rotY;
            group.add(g);
          } else {
            const color = el.category === "door" ? 0xC4A882 : 0x9ECFEA;
            const mesh  = new THREE.Mesh(
              new THREE.BoxGeometry(w, h, WALL_T),
              new THREE.MeshLambertMaterial({ color }),
            );
            mesh.position.set(x, cy, wCz);
            group.add(mesh);
          }
        } else {
          const dir  = el.side === "right" ? 1 : -1;
          const z    = (lengthMm / 1000) * frac;
          const wCx  = dir * (halfW - WALL_T / 2);
          const rotY = el.side === "right" ? -Math.PI / 2 : Math.PI / 2;

          if (el.category === "window1" && windowGlbRef.current) {
            const clone = windowGlbRef.current.clone(true);
            const box  = new THREE.Box3().setFromObject(clone);
            const size = new THREE.Vector3(); box.getSize(size);
            if (size.x > 0.001 && size.y > 0.001)
              clone.scale.set(1.0 / size.x, 0.5 / size.y, size.z > 0.001 ? WALL_T / size.z : 1);
            const box2    = new THREE.Box3().setFromObject(clone);
            const center2 = new THREE.Vector3(); box2.getCenter(center2);
            clone.position.sub(center2);
            const g = new THREE.Group(); g.add(clone);
            g.position.set(wCx, cy, z); g.rotation.y = rotY;
            group.add(g);
          } else {
            const color = el.category === "door" ? 0xC4A882 : 0x9ECFEA;
            const mesh  = new THREE.Mesh(
              new THREE.BoxGeometry(w, h, WALL_T),
              new THREE.MeshLambertMaterial({ color }),
            );
            mesh.position.set(wCx, cy, z);
            mesh.rotation.y = rotY;
            group.add(mesh);
          }
        }
      }
    }

    three.scene.add(group);
    addedGroupRef.current = group;
    mapRef.current?.triggerRepaint();
  }, [addedElements, widthMm, lengthMm, doorWidthMm, doorHeightMm, roofType, buildingType, glbsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { rebuildElements(); }, [rebuildElements]);

  // 3D toggle: camera angle, neighbor visibility, and terrain
  // (fill layer is managed by updateGarage — hidden whenever a center is placed)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer(EXTRUSION_LAYER)) map.setLayoutProperty(EXTRUSION_LAYER, "visibility", "none");
    if (showNeighbors && map.getLayer("neighbors-3d"))
      map.setLayoutProperty("neighbors-3d", "visibility", is3D ? "visible" : "none");
    if (map.getSource("mapbox-dem")) {
      if (is3D) {
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.0 });
      } else {
        map.setTerrain(null);
      }
    }
    map.easeTo({ pitch: is3D ? 60 : 0, bearing: is3D ? -20 : 0, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [is3D]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer(EXTRUSION_LAYER))
      map.setPaintProperty(EXTRUSION_LAYER, "fill-extrusion-height", heightM);
  }, [heightM]);

  // Always fetch property boundary when center changes (enables warning badge in 2D too)
  useEffect(() => {
    if (!center) return;
    const id = setTimeout(() => fetchBoundary(center), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);

  // Draw neighbour cadastral polygons whenever the prop updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const src = map.getSource("naboer-src") as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData({
      type: "FeatureCollection",
      features: (naboerPolygons ?? []).map(ring => ({
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: [ring] },
        properties: {},
      })),
    });
  }, [naboerPolygons]);

  // Fetch OSM 3D buildings in 3D or realistic mode
  useEffect(() => {
    if (!center || (!is3D && !realistic)) return;
    const id = setTimeout(() => fetchBuildings(center), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1], is3D, realistic]);

  // Re-render buildings when realistic toggle changes
  useEffect(() => {
    realisticRef.current = realistic;
    if (realistic && !is3D) setIs3D(true);
    if (!realistic) { hiddenBuildingsRef.current.clear(); setHiddenCount(0); }
    const cached = lastBuildingsRef.current;
    if (cached) renderBuildings(cached.buildings, cached.garCenter);
    else if (realistic && center) fetchBuildings(center);
    mapRef.current?.triggerRepaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realistic]);

  // Toggle cadastral (situasjonsplan) layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer("cadastral-layer"))
      map.setLayoutProperty("cadastral-layer", "visibility", showCadastral ? "visible" : "none");
  }, [showCadastral]);

  // Google Photorealistic 3D Tiles — create/destroy renderer on toggle
  useEffect(() => {
    googleTilesRef.current = googleTiles;
    const wrapper = tilesWrapperRef.current;
    const map     = mapRef.current;

    // Tear down existing renderer
    if (tilesRendererRef.current) {
      tilesRendererRef.current.dispose();
      tilesRendererRef.current = null;
      tilesCamRef.current = null;
      if (wrapper) while (wrapper.children.length) wrapper.remove(wrapper.children[0]);
    }

    // Hide or restore Three.js OSM buildings and Mapbox style extrusions.
    // Exclude EXTRUSION_LAYER (orange garage block) — it is managed separately
    // by the is3D effect and must stay hidden while the Three.js GLB model is shown.
    const buildingGroup = buildingGroupRef.current;
    if (buildingGroup) buildingGroup.visible = !googleTiles;
    if (map?.isStyleLoaded()) {
      map.getStyle().layers?.forEach((l: any) => {
        if (l.type === "fill-extrusion" && l.id !== EXTRUSION_LAYER)
          map.setLayoutProperty(l.id, "visibility", googleTiles ? "none" : "visible");
      });
    }

    if (!googleTiles || !center) return;

    const Cls = TilesRendererClass.current;
    if (!Cls) { setTilesStatus("ERR: 3d-tiles-renderer ikke lastet"); return; }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    if (!apiKey) { setTilesStatus("ERR: API-nøkkel mangler"); return; }

    setTilesStatus("Starter…");

    const AuthCls = GoogleCloudAuthClass.current;
    if (!AuthCls) { setTilesStatus("ERR: GoogleCloudAuthPlugin ikke lastet"); return; }

    const tiles = new Cls("https://tile.googleapis.com/v1/3dtiles/root.json");
    tiles.registerPlugin(new AuthCls({ apiToken: apiKey, useRecommendedSettings: true }));

    const ExtCls = GLTFExtensionsClass.current;
    if (ExtCls) {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
      tiles.registerPlugin(new ExtCls({ dracoLoader }));
    }

    // useRecommendedSettings sets errorTarget=40 (for global views). Override to 6 so
    // the renderer refines down to street-level building geometry.
    tiles.errorTarget = 6;

    // TilesGroup.updateMatrixWorld only propagates matrixWorld to children when
    // isDifferent=true (first frame).  After that, isDifferent is always false so newly
    // loaded tile scenes never have their matrixWorld set.  Patch the instance to also
    // propagate to any child that still has matrixWorldNeedsUpdate=true (freshly added tiles).
    {
      const grp = tiles.group as any;
      const _orig = grp.updateMatrixWorld;
      grp.updateMatrixWorld = function(this: THREE.Object3D, force?: boolean) {
        _orig.call(this, force);
        for (let i = 0; i < this.children.length; i++) {
          const child = this.children[i];
          if (child.matrixWorldNeedsUpdate) {
            child.updateMatrixWorld(true);
          }
        }
      };
    }

    tiles.addEventListener("load-tile-set", () => setTilesStatus("Laster…"));
    tiles.addEventListener("load-model", (e: any) => {
      // GLTF tiles can have alphaMode=BLEND — force opaque so they don't
      // alpha-blend with the Mapbox layer underneath.
      e.scene?.traverse((child: any) => {
        if (child.isMesh) {
          const mats: THREE.Material[] = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m) => { m.transparent = false; m.opacity = 1; });
        }
      });
      mapRef.current?.triggerRepaint();
    });
    tiles.addEventListener("tiles-load-end", () => {
      setTilesStatus(`${tiles.visibleTiles?.size ?? 0} tiles`);
      mapRef.current?.triggerRepaint();
    });
    tiles.addEventListener("load-error", (e: any) => setTilesStatus(`Feil: ${e?.message ?? "ukjent"}`));

    if (wrapper) {
      // Put ecefToLocal on tiles.group.matrix directly with matrixAutoUpdate=false so
      // Three.js never resets it from position/rotation/scale.  wrapper stays at identity.
      tiles.group.matrixAutoUpdate = false;
      tiles.group.matrix.copy(makeEcefToLocalMatrix(center[0], center[1]));
      tiles.group.matrixWorldNeedsUpdate = true;
      wrapper.add(tiles.group);
    }

    tilesCamRef.current = new THREE.PerspectiveCamera(60, 1, 1, 2e6);
    tilesRendererRef.current = tiles;

    mapRef.current?.triggerRepaint();
    return () => {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleTiles]);

  // Keep ECEF→local matrix fresh when garage is moved
  useEffect(() => {
    const tilesRenderer = tilesRendererRef.current;
    if (!tilesRenderer || !center || !googleTilesRef.current) return;
    tilesRenderer.group.matrix.copy(makeEcefToLocalMatrix(center[0], center[1]));
    tilesRenderer.group.matrixWorldNeedsUpdate = true;
    mapRef.current?.triggerRepaint();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1]]);

  // ─── Geolocation ─────────────────────────────────────────────────────────

  function geolocate() {
    if (!navigator?.geolocation) {
      setGeoError("Posisjonstjenester støttes ikke av denne enheten.");
      setGeoDenied(false);
      return;
    }
    setGeoError(null);
    setGeoDenied(false);
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        const c: [number, number] = [lng, lat];
        const name = await reverseGeocodeNO(lat, lng);
        setQuery(name);
        onAddressSelect?.(name, c);
        setCenter(c);
        const map = mapRef.current;
        if (map) {
          map.flyTo({ center: c, zoom: 19, duration: 1200 });
          if (markerRef.current) markerRef.current.remove();
          markerRef.current = new mapboxgl.Marker({ color: "#e2520a" }).setLngLat(c).addTo(map);
        }
        try {
          localStorage.setItem("gp-map-lat", String(lat));
          localStorage.setItem("gp-map-lng", String(lng));
        } catch {}
        setGeoLocating(false);
      },
      (err) => {
        setGeoLocating(false);
        if (err.code === 1) {
          setGeoDenied(true);
          setGeoError("denied");
        } else {
          setGeoError(`Kunne ikke hente posisjon (kode ${err.code}). Skriv inn adressen.`);
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  // Show location prompt on mount when no center is set
  useEffect(() => {
    if (!center && !readOnly && navigator.geolocation) {
      const t = setTimeout(() => setShowGeoPrompt(true), 600);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Address search ──────────────────────────────────────────────────────

  async function searchAddress(q: string) {
    if (!q.trim()) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${TOKEN}&country=no&language=no&limit=5`;
      const data = await (await fetch(url)).json();
      setSuggestions(data.features ?? []);
    } finally { setSearching(false); }
  }

  function pickSuggestion(s: { place_name: string; center: [number, number] }) {
    setQuery(s.place_name);
    setSuggestions([]);
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: s.center, zoom: 19, pitch: is3D ? 60 : 0, duration: 1500 });
    setCenter(s.center);
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = new mapboxgl.Marker({ color: "#e2520a" }).setLngLat(s.center).addTo(map);
    try { localStorage.setItem("gp-map-address", s.place_name); } catch {}
    onAddressSelect?.(s.place_name, s.center);
  }

  // ─── Warning badge config ────────────────────────────────────────────────

  const warningConfig = boundaryWarning
    ? {
        "danger":      { bg: "bg-red-500 text-white",        label: "For nær tomtegrense (< 1 m) – ikke tillatt" },
        "nabovarsel":  { bg: "bg-amber-400 text-gray-900",   label: "Nabovarsel nødvendig (< 4 m fra grense)" },
        "on-building": { bg: "bg-red-600 text-white",        label: "Plassert på eksisterende bygg" },
        "safe":        { bg: "bg-emerald-500 text-white",    label: "Avstand til grense er OK (≥ 4 m)" },
      }[boundaryWarning]
    : null;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full flex flex-col">
      <style>{`.mapboxgl-ctrl-logo { display: none !important; }`}</style>
      {/* Warning badge */}
      {warningConfig && (
        <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-md whitespace-nowrap pointer-events-none ${warningConfig.bg}`}>
          <span>{boundaryWarning === "safe" ? "✓" : "⚠"}</span>
          {warningConfig.label}
        </div>
      )}

      {/* Building loading spinner */}
      {loadingBuildings && (
        <div className="absolute top-2 right-14 z-20 flex items-center gap-1.5 bg-white/90 rounded-full px-2.5 py-1 text-xs text-gray-600 shadow-sm">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
          Laster bygninger…
        </div>
      )}

      {/* Search bar */}
      {!readOnly && (
        <div className="absolute left-3 right-12 z-10 flex flex-col gap-1" style={{ top: 52 }}>
          <div className="flex gap-2">
            {/* GPS button */}
            <button
              onClick={geolocate}
              disabled={geoLocating}
              title="Bruk min nåværende posisjon"
              className="flex-none flex items-center justify-center w-10 h-10 rounded-lg bg-white/95 border border-gray-200 shadow-md hover:bg-orange-50 hover:border-orange-300 disabled:opacity-60 transition-colors"
            >
              {geoLocating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                  <circle cx="12" cy="12" r="8" strokeDasharray="4 2"/>
                </svg>
              )}
            </button>
            <div className="relative flex-1">
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); searchAddress(e.target.value); }}
                placeholder="Søk etter adresse…"
                className="w-full rounded-lg border border-gray-200 bg-white/95 px-3 py-2 text-sm shadow-md focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400 backdrop-blur-sm"
              />
              {searching && (
                <div className="absolute right-2 top-2.5 h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
              )}
            </div>
          </div>
          {geoError && !geoLocating && (
            geoDenied ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-amber-800 mb-1">GPS-tilgang blokkert</p>
                    <p className="text-xs text-amber-700">Klikk 🔒 i adressefeltet → Posisjon → Tillat, eller sjekk Windows-innstillinger → Personvern → Posisjon.</p>
                    <button onClick={geolocate} className="text-xs text-amber-800 underline hover:text-amber-900 font-medium mt-1">
                      Prøv igjen
                    </button>
                  </div>
                  <button
                    onClick={() => { setGeoError(null); setGeoDenied(false); }}
                    className="flex-none text-amber-500 hover:text-amber-800 leading-none mt-0.5"
                    title="Lukk"
                  >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs text-red-600 shadow-sm">
                <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="flex-none">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                </svg>
                {geoError}
              </div>
            )
          )}
          {suggestions.length > 0 && (
            <ul className="rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    onClick={() => pickSuggestion(s)}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
                  >
                    {s.place_name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 3D toggle (also enables realistic buildings) */}
      {!readOnly && (
        <div className="absolute bottom-24 left-16 z-10 flex flex-col gap-2 items-start">
          <div className="flex gap-2">
            <button
              onClick={() => { const next = !is3D; setIs3D(next); setRealistic(next); if (!next) setGoogleTiles(false); }}
              className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-lg border transition-colors ${
                is3D
                  ? "bg-orange-500 text-white border-transparent"
                  : "bg-white/95 text-gray-700 border-gray-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
              }`}
            >
              {is3D ? "3D på" : "3D av"}
            </button>
            {is3D && (
              <>
                <button
                  onClick={() => setGoogleTiles((v) => !v)}
                  title="Google Photorealistic 3D Tiles — krever Google API-nøkkel"
                  className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-lg border transition-colors ${
                    googleTiles
                      ? "bg-blue-600 text-white border-transparent"
                      : "bg-white/95 text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                  }`}
                >
                  {googleTiles ? "Google 3D på" : "Google 3D"}
                </button>
                {googleTiles && tilesStatus && (
                  <span className="text-xs text-gray-500 px-1">{tilesStatus}</span>
                )}
              </>
            )}
          </div>
          {is3D && (
            <div className="flex flex-col gap-1 bg-white/95 rounded-xl shadow-lg border border-gray-200 px-2.5 py-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 font-medium">Høyde</span>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.05}
                  value={terrainOffset}
                  onChange={(e) => setTerrainOffset(Number(e.target.value))}
                  className="w-24 accent-orange-500"
                />
                <input
                  type="number"
                  min={-5}
                  max={5}
                  step={0.05}
                  value={terrainOffset}
                  onChange={(e) => setTerrainOffset(Math.max(-5, Math.min(5, Number(e.target.value))))}
                  className="w-14 text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-800 font-semibold focus:outline-none focus:border-orange-400 text-right"
                />
                <span className="text-xs text-gray-400">m</span>
                {terrainOffset !== 0 && (
                  <button
                    onClick={() => setTerrainOffset(0)}
                    className="text-xs text-orange-500 hover:text-orange-700"
                    title="Nullstill"
                  >↺</button>
                )}
              </div>
            </div>
          )}
          {is3D && hiddenCount > 0 && (
            <div className="flex gap-1 bg-white/95 rounded-xl shadow-lg border border-gray-200 p-1">
              <button
                onClick={() => {
                  hiddenBuildingsRef.current.clear();
                  setHiddenCount(0);
                  const cached = lastBuildingsRef.current;
                  if (cached) renderBuildings(cached.buildings, cached.garCenter);
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors"
              >
                Vis alle
              </button>
            </div>
          )}
        </div>
      )}
      {/* Cadastral toggle — admin only, stays top-right */}
      {!readOnly && showCadastralToggle && (
        <div className="absolute right-3 z-10" style={{ top: 52 }}>
          <button
            onClick={() => setShowCadastral((v) => !v)}
            title="Vis situasjonsplan fra Kartverket"
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-md transition-colors ${
              showCadastral ? "bg-orange-500 text-white" : "bg-white/95 text-gray-700 hover:bg-orange-50"
            }`}
          >
            {showCadastral ? "Kart på" : "Kart av"}
          </button>
        </div>
      )}

      {/* Map */}
      <div ref={containerRef} className="flex-1 w-full" />

      {/* Compass rose */}
      <div
        className="absolute right-3 z-10 pointer-events-none select-none"
        style={{ bottom: 90 }}
      >
        <div
          className="relative flex items-center justify-center w-14 h-14"
          style={{ transform: `rotate(${-mapBearing}deg)` }}
        >
          {/* Ring */}
          <svg viewBox="0 0 56 56" width="56" height="56" className="absolute inset-0">
            <circle cx="28" cy="28" r="26" fill="white" fillOpacity="0.92" stroke="#d1d5db" strokeWidth="1.5" />
          </svg>
          {/* N needle — red */}
          <svg viewBox="0 0 56 56" width="56" height="56" className="absolute inset-0">
            <polygon points="28,6 32,28 28,24 24,28" fill="#e2520a" />
            <polygon points="28,50 32,28 28,32 24,28" fill="#6b7280" />
          </svg>
          {/* Cardinal labels — counter-rotate to stay upright */}
          {([["N", 0], ["Ø", 90], ["S", 180], ["V", 270]] as [string, number][]).map(([lbl, deg]) => {
            const rad = (deg * Math.PI) / 180;
            const r = 18;
            const x = 28 + r * Math.sin(rad);
            const y = 28 - r * Math.cos(rad);
            return (
              <div
                key={lbl}
                className="absolute text-[9px] font-bold leading-none"
                style={{
                  left: x,
                  top: y,
                  transform: `translate(-50%, -50%) rotate(${mapBearing}deg)`,
                  color: lbl === "N" ? "#e2520a" : "#374151",
                }}
              >
                {lbl}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tool toolbar */}
      {!readOnly && (
        <div className="absolute bottom-4 left-3 z-10 flex flex-col gap-1 bg-white/95 rounded-xl shadow-lg p-1.5 backdrop-blur-sm">
          {/* Move */}
          <button
            onClick={() => setToolMode("move")}
            title="Flytt garasje"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${toolMode === "move" ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-orange-50"}`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/>
              <polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>
              <line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>
            </svg>
          </button>
          {/* Rotate */}
          <button
            onClick={() => setToolMode("rotate")}
            title="Roter garasje"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${toolMode === "rotate" ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-orange-50"}`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6"/>
              <path d="M21.34 15.57a10 10 0 1 1-.57-8.38"/>
            </svg>
          </button>
          {/* Pan */}
          <button
            onClick={() => setToolMode("pan")}
            title="Panorér kart"
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${toolMode === "pan" ? "bg-orange-500 text-white" : "text-gray-600 hover:bg-orange-50"}`}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v0"/>
              <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"/>
              <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"/>
              <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
            </svg>
          </button>
        </div>
      )}
      {/* Rotation / size readout + input */}
      {!readOnly && center && (
        <div className="absolute bottom-4 left-16 z-10 bg-white/95 rounded-lg shadow-md px-2.5 py-2 text-xs text-gray-600 backdrop-blur-sm leading-tight flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-gray-500">Rotasjon</span>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={rotation}
              onChange={(e) => {
                const val = Number(e.target.value);
                setInternalRotation(val);
                onRotationChange?.(val);
                mapRef.current?.triggerRepaint();
              }}
              className="w-24 accent-orange-500"
            />
            <input
              type="number"
              min={0}
              max={359}
              step={1}
              value={rotation}
              onChange={(e) => {
                const val = ((Number(e.target.value) % 360) + 360) % 360;
                setInternalRotation(val);
                onRotationChange?.(val);
                mapRef.current?.triggerRepaint();
              }}
              className="w-14 text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-800 font-semibold focus:outline-none focus:border-orange-400 text-right"
            />
            <span className="text-gray-400">°</span>
          </div>
          <span className="text-gray-400">{lengthM.toFixed(1)}×{widthM.toFixed(1)} m</span>
        </div>
      )}
      {/* Placement hint + instructions */}
      {!readOnly && !center && (
        <div className="absolute bottom-4 left-16 right-16 z-10">
          <div className="rounded-xl bg-white/95 shadow-lg backdrop-blur-sm px-4 py-3">
            <p className="text-xs font-semibold text-gray-700 mb-1.5">Slik plasserer du garasjen</p>
            <ul className="space-y-1 text-xs text-gray-500">
              <li className="flex gap-2"><span>👆</span><span>Dobbeltklikk i kartet for å plassere garasjen</span></li>
              <li className="flex gap-2"><span>✋</span><span>Dra garasjen for å flytte den presist</span></li>
              <li className="flex gap-2"><span>🔄</span><span>Velg roter-knappen og dra for å endre retning</span></li>
              <li className="flex gap-2"><span>🔢</span><span>Skriv inn grader i feltet nede til venstre for nøyaktig vinkel</span></li>
            </ul>
          </div>
        </div>
      )}

      {/* GPS locating overlay */}
      {geoLocating && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-sm pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl px-6 py-4 flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent flex-none" />
            <span className="text-sm font-medium text-gray-700">Henter din posisjon…</span>
          </div>
        </div>
      )}

      {/* Location permission prompt */}
      {showGeoPrompt && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-5 mx-4 w-full max-w-xs">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-3">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                  <circle cx="12" cy="12" r="8" strokeDasharray="4 2"/>
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 text-base mb-1">Bruk din posisjon?</h3>
              <p className="text-sm text-gray-500">Vi bruker posisjonen din til å plassere garasjen på riktig sted i kartet.</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setShowGeoPrompt(false); geolocate(); }}
                className="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition-colors"
              >
                Tillat posisjon
              </button>
              <button
                onClick={() => setShowGeoPrompt(false)}
                className="w-full py-2.5 text-gray-500 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Ikke nå
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
