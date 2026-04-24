"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface GarageMapboxProps {
  lengthMm: number;
  widthMm: number;
  roofType?: "saltak" | "flattak";
  /** Controlled center – used when parent manages state */
  externalCenter?: [number, number] | null;
  externalRotation?: number;
  onCenterChange?: (c: [number, number]) => void;
  onRotationChange?: (r: number) => void;
  /** Hide editing controls and search (for "show on plot" read-only view) */
  readOnly?: boolean;
  /** Force 3D extrusion mode on */
  forceIs3D?: boolean;
  /** Street-view perspective: camera positioned in front of garage at ground level */
  streetView?: boolean;
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

function buildGarageGeoJSON(
  center: [number, number],
  lengthM: number,
  widthM: number,
  rotationDeg: number
): GeoJSON.Feature<GeoJSON.Polygon> {
  const lat = center[1];
  const lng = center[0];

  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos((lat * Math.PI) / 180);

  const halfL = lengthM / 2;
  const halfW = widthM / 2;
  const rad = (rotationDeg * Math.PI) / 180;

  const corners: [number, number][] = [
    [-halfW, -halfL],
    [halfW, -halfL],
    [halfW, halfL],
    [-halfW, halfL],
    [-halfW, -halfL],
  ].map(([x, y]) => {
    const rx = x * Math.cos(rad) - y * Math.sin(rad);
    const ry = x * Math.sin(rad) + y * Math.cos(rad);
    return [lng + rx / metersPerDegLng, lat + ry / metersPerDegLat];
  });

  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [corners] },
    properties: {},
  };
}

export default function GarageMapbox({
  lengthMm, widthMm, roofType,
  externalCenter, externalRotation,
  onCenterChange, onRotationChange,
  readOnly = false, forceIs3D = false, streetView = false,
}: GarageMapboxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const [internalCenter, setInternalCenter] = useState<[number, number] | null>(null);
  const [internalRotation, setInternalRotation] = useState(0);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ place_name: string; center: [number, number] }[]>([]);
  const [searching, setSearching] = useState(false);
  const [is3D, setIs3D] = useState(forceIs3D);

  // Use external state if provided, otherwise internal
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
  const widthM = widthMm / 1000;
  const heightM = roofType === "saltak" ? 4.5 : 3.0;

  const SOURCE_ID = "garage";
  const FILL_LAYER = "garage-fill";
  const EXTRUSION_LAYER = "garage-3d";
  const OUTLINE_LAYER = "garage-outline";

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

    const initCenter = externalCenter ?? [5.7, 58.74];
    const initRot    = externalRotation ?? 0;

    // For street view: position camera 28 m in front of the garage
    let streetCenter: [number, number] = initCenter;
    if (streetView && externalCenter) {
      const rad    = ((initRot + 180) * Math.PI) / 180; // direction FROM garage TO viewer
      const distM  = 28;
      const lat    = initCenter[1];
      const dLng   = (distM * Math.sin(rad)) / (111320 * Math.cos((lat * Math.PI) / 180));
      const dLat   = (distM * Math.cos(rad)) / 111320;
      streetCenter = [initCenter[0] + dLng, initCenter[1] + dLat];
    }

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: streetView && externalCenter ? streetCenter : initCenter,
      zoom: streetView ? 19.5 : externalCenter ? 19 : 14,
      pitch: streetView ? 72 : forceIs3D ? 60 : 0,
      bearing: streetView ? initRot : forceIs3D ? -20 : 0,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.addLayer({
        id: FILL_LAYER,
        type: "fill",
        source: SOURCE_ID,
        paint: { "fill-color": "#e2520a", "fill-opacity": 0.5 },
      });

      map.addLayer({
        id: EXTRUSION_LAYER,
        type: "fill-extrusion",
        source: SOURCE_ID,
        paint: {
          "fill-extrusion-color": "#e2520a",
          "fill-extrusion-height": heightM,
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.75,
        },
        layout: { visibility: "none" },
      });

      map.addLayer({
        id: OUTLINE_LAYER,
        type: "line",
        source: SOURCE_ID,
        paint: { "line-color": "#fff", "line-width": 2 },
      });
    });

    // Place marker and activate 3D extrusion for externally-set center
    if (externalCenter) {
      map.on("load", () => {
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = new mapboxgl.Marker({ color: "#e2520a" })
          .setLngLat(externalCenter)
          .addTo(map);
        if ((forceIs3D || streetView) && map.getLayer(EXTRUSION_LAYER)) {
          map.setLayoutProperty(EXTRUSION_LAYER, "visibility", "visible");
          map.setLayoutProperty(FILL_LAYER, "visibility", "none");
        }
      });
    }

    if (!readOnly) {
      map.on("click", (e) => {
        const c: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setCenter(c);
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = new mapboxgl.Marker({ color: "#e2520a" })
          .setLngLat(c)
          .addTo(map);
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateGarage();
  }, [updateGarage]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const vis = is3D ? "visible" : "none";
    if (map.getLayer(EXTRUSION_LAYER)) map.setLayoutProperty(EXTRUSION_LAYER, "visibility", vis);
    if (map.getLayer(FILL_LAYER)) map.setLayoutProperty(FILL_LAYER, "visibility", is3D ? "none" : "visible");
    map.easeTo({ pitch: is3D ? 60 : 0, bearing: is3D ? -20 : 0, duration: 600 });
  }, [is3D]);

  // Update extrusion height when roofType changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (map.getLayer(EXTRUSION_LAYER)) {
      map.setPaintProperty(EXTRUSION_LAYER, "fill-extrusion-height", heightM);
    }
  }, [heightM]);

  async function searchAddress(q: string) {
    if (!q.trim()) { setSuggestions([]); return; }
    setSearching(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${TOKEN}&country=no&language=no&limit=5`;
      const res = await fetch(url);
      const data = await res.json();
      setSuggestions(data.features ?? []);
    } finally {
      setSearching(false);
    }
  }

  function pickSuggestion(s: { place_name: string; center: [number, number] }) {
    setQuery(s.place_name);
    setSuggestions([]);
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ center: s.center, zoom: 19, pitch: is3D ? 60 : 0, duration: 1500 });
    setCenter(s.center);
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = new mapboxgl.Marker({ color: "#e2520a" })
      .setLngLat(s.center)
      .addTo(map);
  }

  return (
    <div className="relative h-full w-full flex flex-col">
      {/* Search bar — offset below the view-mode toggle (~44px) */}
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

      {/* 3D toggle — only shown in edit mode */}
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

      {/* Bottom controls — hidden in readOnly */}
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
                    type="range"
                    min={0}
                    max={359}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="flex-1 accent-orange-500"
                  />
                  <span className="text-xs text-gray-500 w-8 text-right">{rotation}°</span>
                </div>
                <p className="text-xs text-gray-400 text-center">
                  {(lengthM).toFixed(1)} m × {(widthM).toFixed(1)} m
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
