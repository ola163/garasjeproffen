"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

interface Props {
  lat: number;
  lng: number;
  widthMm: number;
  lengthMm: number;
  onMove: (lat: number, lng: number) => void;
  onRotationChange?: (deg: number) => void;
}

// Convert meters offset to lat/lng offset from a center point
function mToLatLng(centerLat: number, centerLng: number, dx: number, dy: number) {
  const latOffset = dy / 111132;
  const lngOffset = dx / (111320 * Math.cos((centerLat * Math.PI) / 180));
  return [centerLat + latOffset, centerLng + lngOffset] as [number, number];
}

// Get the 4 corners of a rotated rectangle (widthM × lengthM) centered at lat/lng
function rotatedCorners(
  lat: number, lng: number,
  widthM: number, lengthM: number,
  rotDeg: number
): [number, number][] {
  const rot = (rotDeg * Math.PI) / 180;
  const hw = widthM / 2;
  const hl = lengthM / 2;
  const local: [number, number][] = [
    [-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl],
  ];
  return local.map(([x, y]) => {
    const rx = x * Math.cos(rot) - y * Math.sin(rot);
    const ry = x * Math.sin(rot) + y * Math.cos(rot);
    return mToLatLng(lat, lng, rx, ry);
  });
}

export default function GaragePlacementMap({ lat, lng, widthMm, lengthMm, onMove, onRotationChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const polygonRef = useRef<import("leaflet").Polygon | null>(null);
  const centerMarkerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const labelRef = useRef<import("leaflet").Marker | null>(null);
  const [rotation, setRotation] = useState(0);
  const [center, setCenter] = useState({ lat, lng });
  const rotationRef = useRef(0);
  const centerRef = useRef({ lat, lng });

  const widthM  = widthMm  / 1000;
  const lengthM = lengthMm / 1000;

  // Sync refs so effect closures always see latest values
  useEffect(() => { rotationRef.current = rotation; }, [rotation]);
  useEffect(() => { centerRef.current = center; }, [center]);

  function redrawPolygon(L: typeof import("leaflet"), lat: number, lng: number, rot: number) {
    if (!mapRef.current) return;
    const corners = rotatedCorners(lat, lng, widthM, lengthM, rot);

    if (polygonRef.current) {
      polygonRef.current.setLatLngs(corners);
    } else {
      polygonRef.current = L.polygon(corners, {
        color: "#e2520a",
        fillColor: "#e2520a",
        fillOpacity: 0.25,
        weight: 2,
      }).addTo(mapRef.current);
    }

    if (centerMarkerRef.current) {
      centerMarkerRef.current.setLatLng([lat, lng]);
    } else {
      centerMarkerRef.current = L.circleMarker([lat, lng], {
        radius: 6,
        color: "#e2520a",
        fillColor: "#fff",
        fillOpacity: 1,
        weight: 2,
      }).addTo(mapRef.current);
    }

    // Dimension label
    const labelHtml = `<div style="background:rgba(255,255,255,0.9);border:1px solid #e2520a;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600;color:#e2520a;white-space:nowrap;">${widthM.toFixed(1)} × ${lengthM.toFixed(1)} m</div>`;
    const icon = L.divIcon({ html: labelHtml, className: "", iconAnchor: [40, -8] });
    if (labelRef.current) {
      labelRef.current.setLatLng([lat, lng]);
      labelRef.current.setIcon(icon);
    } else {
      labelRef.current = L.marker([lat, lng], { icon, interactive: false }).addTo(mapRef.current!);
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    (async () => {
      const L = (await import("leaflet")).default;

      // @ts-expect-error leaflet internals
      delete L.Icon.Default.prototype._getIconUrl;

      const map = L.map(containerRef.current!, { zoomControl: true }).setView([lat, lng], 18);

      // Esri satellite tiles — free, no API key
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles © Esri", maxZoom: 20 }
      ).addTo(map);

      mapRef.current = map;
      redrawPolygon(L, lat, lng, 0);

      // Click to move garage
      map.on("click", (e) => {
        const newCenter = { lat: e.latlng.lat, lng: e.latlng.lng };
        centerRef.current = newCenter;
        setCenter(newCenter);
        onMove(newCenter.lat, newCenter.lng);
        redrawPolygon(L, newCenter.lat, newCenter.lng, rotationRef.current);
      });
    })();

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      polygonRef.current = null;
      centerMarkerRef.current = null;
      labelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw when parent changes lat/lng (address search)
  useEffect(() => {
    if (!mapRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const newCenter = { lat, lng };
      centerRef.current = newCenter;
      setCenter(newCenter);
      mapRef.current!.setView([lat, lng], 18);
      redrawPolygon(L, lat, lng, rotationRef.current);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  function handleRotation(deg: number) {
    setRotation(deg);
    rotationRef.current = deg;
    onRotationChange?.(deg);
    if (!mapRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      redrawPolygon(L, centerRef.current.lat, centerRef.current.lng, deg);
    })();
  }

  return (
    <div className="flex flex-col gap-2">
      <div ref={containerRef} className="h-full w-full rounded-xl" style={{ minHeight: 288 }} />
      <div className="flex items-center gap-3 px-1">
        <span className="text-xs text-gray-500 shrink-0">Rotasjon</span>
        <input
          type="range"
          min={0}
          max={359}
          value={rotation}
          onChange={(e) => handleRotation(Number(e.target.value))}
          className="flex-1 accent-orange-500"
        />
        <span className="text-xs font-mono text-gray-600 w-10 text-right">{rotation}°</span>
      </div>
      <p className="text-xs text-gray-400 px-1">
        Klikk i kartet for å plassere garasjen. Bruk slideren for å rotere den.
      </p>
    </div>
  );
}
