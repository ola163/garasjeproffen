"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

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
  return rt === "saltak" ? "/garasje_saltak.glb" : "/garasje_flatt_tak.glb";
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
  showNeighbors = false, defaultCenter,
}: GarageMapboxProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<mapboxgl.Map | null>(null);
  const markerRef     = useRef<mapboxgl.Marker | null>(null);
  const threeRef      = useRef<ThreeState | null>(null);
  const buildingGroupRef   = useRef<THREE.Group | null>(null);
  const boundaryRef        = useRef<[number, number][]>([]);
  const osmPolygonsRef     = useRef<Array<[number, number][]>>([]);

  // Render-time refs — read by Mapbox render callback every frame
  const centerRenderRef   = useRef<[number, number] | null>(null);
  const rotationRenderRef = useRef<number>(0);
  const is3DRenderRef     = useRef<boolean>(forceIs3D);
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

  const center   = externalCenter   !== undefined ? externalCenter   : internalCenter;
  const rotation = externalRotation !== undefined ? externalRotation : internalRotation;

  function setCenter(c: [number, number] | null) {
    setInternalCenter(c);
    if (c) onCenterChange?.(c);
  }
  function setRotation(r: number) {
    setInternalRotation(r);
    onRotationChange?.(r);
  }

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
    if (src) src.setData(geo);
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
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
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
          loadModel(getModelUrl(buildingType, roofType));
        },
        render(_gl, matrix) {
          const three = threeRef.current;
          if (!three || !is3DRenderRef.current || !centerRenderRef.current) return;

          const [lng, lat] = centerRenderRef.current;
          const mc = mapboxgl.MercatorCoordinate.fromLngLat({ lng, lat }, 0);
          const s  = mc.meterInMercatorCoordinateUnits();
          const rotRad = (rotationRenderRef.current * Math.PI) / 180;

          // Apply rotation to the garage model only — buildings stay geographically fixed
          if (three.model) three.model.rotation.y = -rotRad;

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
    });

    if (!readOnly) {
      map.on("click", (e) => {
        const c: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setCenter(c);
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = new mapboxgl.Marker({ color: "#e2520a" }).setLngLat(c).addTo(map);
      });
    }

    return () => {
      map.remove();
      mapRef.current   = null;
      threeRef.current = null;
      buildingGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { updateGarage(); }, [updateGarage]);

  useEffect(() => {
    centerRenderRef.current = center;
    if (center) mapRef.current?.triggerRepaint();
  }, [center]);

  useEffect(() => {
    rotationRenderRef.current = rotation;
    mapRef.current?.triggerRepaint();
  }, [rotation]);

  useEffect(() => {
    is3DRenderRef.current = is3D;
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

  // 3D toggle: camera, layers, and neighbors
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer(FILL_LAYER))      map.setLayoutProperty(FILL_LAYER,      "visibility", is3D ? "none" : "visible");
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

  // Fetch OSM buildings + plot boundary whenever center changes (3D mode)
  useEffect(() => {
    if (!center || !is3D) return;
    const id = setTimeout(() => {
      fetchBuildings(center);
      fetchBoundary(center);
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.[0], center?.[1], is3D]);

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

      {/* 3D toggle */}
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
        </div>
      )}

      {/* Map */}
      <div ref={containerRef} className="flex-1 w-full" />

      {/* Bottom controls */}
      {!readOnly && (
        <div className="absolute bottom-4 left-3 right-3 z-10">
          <div className="rounded-xl bg-white/95 shadow-lg backdrop-blur-sm p-3 flex flex-col gap-2">
            {!center && (
              <p className="text-xs text-gray-500 text-center">
                Søk etter adresse eller klikk i kartet for å plassere garasjen
              </p>
            )}
            {center && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-600 shrink-0">Roter</span>
                  <input
                    type="range" min={0} max={359} value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="flex-1 accent-orange-500"
                  />
                  <span className="text-xs text-gray-500 w-8 text-right">{rotation}°</span>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  {lengthM.toFixed(1)} m × {widthM.toFixed(1)} m
                  {is3D ? ` × ${heightM.toFixed(1)} m høy` : ""} — klikk i kartet for å flytte
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
