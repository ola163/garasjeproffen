"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

// ─── Pure helpers ────────────────────────────────────────────────────────────

type OSMBuildingData = { nodes: Array<{ lat: number; lon: number }>; height: number };

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
    const nodes = el.nodes.map((id) => nodeMap.get(id)).filter(Boolean) as Array<{ lat: number; lon: number }>;
    if (nodes.length >= 3) buildings.push({ nodes, height });
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

const WALL_H = 3.0;
const WALL_T = 0.12;

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
  onMapReady,
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
  const [boundaryWarning,  setBoundaryWarning]  = useState<null | "safe" | "nabovarsel" | "danger" | "on-building">(null);
  const [loadingBuildings, setLoadingBuildings] = useState(false);
  const [boundaryVersion,  setBoundaryVersion]  = useState(0);
  const [showCadastral,    setShowCadastral]    = useState(defaultShowCadastral);
  const [geoLocating,     setGeoLocating]     = useState(false);
  const [geoError,        setGeoError]        = useState<string | null>(null);
  const [geoDenied,       setGeoDenied]       = useState(false);

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
    const garMc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: garCenter[0], lat: garCenter[1] }, 0);
    const s     = garMc.meterInMercatorCoordinateUnits();
    buildings.forEach((bld, idx) => {
      const g = buildingToGroup(bld, garMc, s, idx);
      if (g) group.add(g);
    });
    // Store polygons for on-building check
    osmPolygonsRef.current = buildings.map((b) =>
      b.nodes.map((n) => [n.lon, n.lat] as [number, number])
    );
    mapRef.current?.triggerRepaint();
  }

  async function fetchBuildings(garCenter: [number, number]) {
    setLoadingBuildings(true);
    try {
      const [lng, lat] = garCenter;
      const res = await fetch(`/api/osm-buildings?lat=${lat}&lng=${lng}&radius=300`);
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
    if (!center || boundaryRef.current.length < 3) {
      setBoundaryWarning(null);
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
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
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
          scene.add(new THREE.AmbientLight(0xffffff, 2.5));
          const sun = new THREE.DirectionalLight(0xffffff, 1.5);
          sun.position.set(1, 3, 2).normalize();
          scene.add(sun);

          // Building group — populated by fetchBuildings
          const buildingGroup = new THREE.Group();
          scene.add(buildingGroup);
          buildingGroupRef.current = buildingGroup;

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
          const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng, lat }, 0);
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
          three.renderer.resetState();
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
          setInternalCenter(c);
          onCenterChange?.(c);
          if (markerRef.current) markerRef.current.remove();
          markerRef.current = new mapboxgl.Marker({ color: "#e2520a" }).setLngLat(c).addTo(map);
        }
      });
    }

    return () => {
      map.remove();
      mapRef.current        = null;
      threeRef.current      = null;
      buildingGroupRef.current = null;
      addedGroupRef.current = null;
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

  // 3D toggle: camera angle and neighbor visibility only
  // (fill layer is managed by updateGarage — hidden whenever a center is placed)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer(EXTRUSION_LAYER)) map.setLayoutProperty(EXTRUSION_LAYER, "visibility", "none");
    if (showNeighbors && map.getLayer("neighbors-3d"))
      map.setLayoutProperty("neighbors-3d", "visibility", is3D ? "visible" : "none");
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

  // Fetch OSM 3D buildings only in 3D mode
  useEffect(() => {
    if (!center || !is3D) return;
    const id = setTimeout(() => fetchBuildings(center), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1], is3D]);

  // Toggle cadastral (situasjonsplan) layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer("cadastral-layer"))
      map.setLayoutProperty("cadastral-layer", "visibility", showCadastral ? "visible" : "none");
  }, [showCadastral]);

  // ─── Geolocation ─────────────────────────────────────────────────────────

  async function geolocate() {
    if (!navigator.geolocation) {
      setGeoError("Nettleseren støtter ikke GPS.");
      setGeoDenied(false);
      return;
    }
    setGeoError(null);
    setGeoDenied(false);

    // Pre-check: if already denied, show instructions immediately without triggering a prompt
    if ("permissions" in navigator) {
      try {
        const perm = await navigator.permissions.query({ name: "geolocation" });
        if (perm.state === "denied") {
          setGeoDenied(true);
          setGeoError("denied");
          return;
        }
      } catch { /* permissions API not supported in this browser */ }
    }

    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        const c: [number, number] = [lng, lat];
        try {
          const res = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=address,place&language=no&country=no&access_token=${TOKEN}`
          );
          const data = await res.json();
          const name: string = data.features?.[0]?.place_name ?? "Min posisjon";
          setQuery(name);
          onAddressSelect?.(name, c);
        } catch { /* address lookup failed, position is still valid */ }
        setCenter(c);
        const map = mapRef.current;
        if (map) {
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
          setGeoError("Kunne ikke hente posisjon.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  // Auto-detect on mount when no center is set
  useEffect(() => {
    if (!center && !readOnly) {
      const t = setTimeout(() => geolocate(), 600);
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
          {geoLocating && (
            <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5 text-xs text-orange-700 shadow-sm">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-orange-500 border-t-transparent flex-none" />
              Henter din posisjon…
            </div>
          )}
          {geoError && !geoLocating && (
            geoDenied ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 shadow-sm">
                <p className="text-xs font-semibold text-amber-800 mb-1.5">Posisjon er blokkert for dette nettstedet</p>
                <ol className="text-xs text-amber-700 space-y-0.5 mb-2 list-decimal list-inside">
                  <li>Klikk på lås-ikonet (🔒) til venstre i adressefeltet</li>
                  <li>Klikk «Tillatelser for dette nettstedet»</li>
                  <li>Finn «Posisjon / Location» og sett den til «Tillat»</li>
                  <li>Last inn siden på nytt</li>
                </ol>
                <p className="text-xs text-amber-600 italic mb-2">Merk: global plasseringstilgang i Chrome er ikke nok — nettstedet må ha sin egen tillatelse.</p>
                <button
                  onClick={geolocate}
                  className="text-xs text-amber-800 underline hover:text-amber-900 font-medium"
                >
                  Prøv igjen
                </button>
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

      {/* 3D toggle + cadastral toggle */}
      {!readOnly && (
        <div className="absolute right-3 z-10 flex flex-col gap-2" style={{ top: 52 }}>
          <button
            onClick={() => setIs3D((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-md transition-colors ${
              is3D ? "bg-orange-500 text-white" : "bg-white/95 text-gray-700 hover:bg-orange-50"
            }`}
          >
            {is3D ? "3D på" : "3D av"}
          </button>
          {showCadastralToggle && (
            <button
              onClick={() => setShowCadastral((v) => !v)}
              title="Vis situasjonsplan fra Kartverket"
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold shadow-md transition-colors ${
                showCadastral ? "bg-orange-500 text-white" : "bg-white/95 text-gray-700 hover:bg-orange-50"
              }`}
            >
              {showCadastral ? "Kart på" : "Kart av"}
            </button>
          )}
        </div>
      )}

      {/* Map */}
      <div ref={containerRef} className="flex-1 w-full" />

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
      {/* Rotation / size readout + slider */}
      {!readOnly && center && (
        <div className="absolute bottom-4 left-16 z-10 bg-white/95 rounded-lg shadow-md px-2.5 py-2 text-xs text-gray-600 backdrop-blur-sm leading-tight flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-800">{rotation}°</span>
            <span className="text-gray-400">{lengthM.toFixed(1)}×{widthM.toFixed(1)} m{is3D ? ` ×${heightM.toFixed(1)}` : ""}</span>
          </div>
          <input
            type="range"
            min={0}
            max={359}
            value={rotation}
            onChange={(e) => {
              const val = Number(e.target.value);
              setInternalRotation(val);
              onRotationChange?.(val);
              mapRef.current?.triggerRepaint();
            }}
            className="w-28 accent-orange-500"
          />
        </div>
      )}
      {/* Placement hint */}
      {!readOnly && !center && (
        <div className="absolute bottom-4 left-16 right-3 z-10">
          <div className="rounded-xl bg-white/95 shadow-lg backdrop-blur-sm px-4 py-2.5 text-center">
            <p className="text-xs text-gray-500">Klikk i kartet for å plassere garasjen</p>
          </div>
        </div>
      )}
    </div>
  );
}
