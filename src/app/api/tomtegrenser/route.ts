// Point-in-ring ray-cast (works for any [lon, lat] ring)
function pointInRing(px: number, py: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

// Kartverket sometimes returns [lat, lon] — detect and swap
function normaliseRing(ring: number[][]): [number, number][] {
  if (!ring.length) return [];
  const [a] = ring[0];
  // Norway: lat ≈ 57–71, lon ≈ 4–32. If first coord > 45 it's latitude → swap
  if (a > 45) return ring.map(([y, x]) => [x, y]);
  return ring as [number, number][];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  if (isNaN(lat) || isNaN(lng)) return new Response("Missing lat/lng", { status: 400 });

  // ── Strategy 1: Kartverket eiendomsopplysninger (returns full parcel geometry) ──
  try {
    const res = await fetch(
      `https://ws.geonorge.no/eiendomsopplysninger/v1/punkt?nord=${lat}&ost=${lng}&koordsys=4258`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) },
    );
    if (res.ok) {
      const data = await res.json();
      const teiger = data?.teiger;
      if (Array.isArray(teiger) && teiger.length > 0) {
        const geom = teiger[0]?.geometri;
        const rawRing = geom?.coordinates?.[0];
        if (Array.isArray(rawRing) && rawRing.length >= 3) {
          const ring = normaliseRing(rawRing);
          return Response.json({ teiger: [{ geometri: { type: "Polygon", coordinates: [ring] } }] });
        }
      }
    }
  } catch { /* fall through */ }

  // ── Strategy 2: WFS Teig (full parcel polygon) ──────────────────────────────
  const d = 0.003; // ~300 m
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d},EPSG:4326`;
  for (const typeName of ["app:Teig", "Teig"]) {
    try {
      const url =
        `https://wfs.geonorge.no/skwms1/wfs.matrikkelen?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
        `&TYPENAMES=${encodeURIComponent(typeName)}&OUTPUTFORMAT=application/json&COUNT=10&BBOX=${bbox}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = await res.json();
      const features: unknown[] = data?.features ?? [];
      const rings: [number, number][][] = [];
      for (const f of features) {
        const geom = (f as { geometry?: { type?: string; coordinates?: unknown } })?.geometry;
        if (!geom) continue;
        const polys =
          geom.type === "Polygon"
            ? [geom.coordinates as number[][][]]
            : geom.type === "MultiPolygon"
            ? (geom.coordinates as number[][][][])
            : [];
        for (const poly of polys) {
          if (Array.isArray(poly[0])) rings.push(normaliseRing(poly[0] as number[][]));
        }
      }
      // Return the ring that contains the garage center, else the first ring
      const hit = rings.find(r => pointInRing(lng, lat, r));
      const ring = hit ?? rings[0];
      if (ring) return Response.json({ teiger: [{ geometri: { type: "Polygon", coordinates: [ring] } }] });
    } catch { /* try next */ }
  }

  // ── Strategy 3: WFS Eiendomsgrense (boundary line segments) ─────────────────
  try {
    const url =
      `https://wfs.geonorge.no/skwms1/wfs.matrikkelen?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
      `&TYPENAMES=app:Eiendomsgrense&OUTPUTFORMAT=application/json&COUNT=200&BBOX=${bbox}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      const features: unknown[] = data?.features ?? [];
      // Collect all unique coordinate points from line segments
      const pts: [number, number][] = [];
      for (const f of features) {
        const geom = (f as { geometry?: { type?: string; coordinates?: unknown } })?.geometry;
        if (!geom) continue;
        const lines =
          geom.type === "LineString"
            ? [geom.coordinates as number[][]]
            : geom.type === "MultiLineString"
            ? (geom.coordinates as number[][][])
            : [];
        for (const line of lines) {
          for (const c of line) pts.push(normaliseRing([c])[0]);
        }
      }
      if (pts.length >= 3) {
        // Return as a "ring" — the caller will use it for segment-distance checks
        return Response.json({ teiger: [{ geometri: { type: "Polygon", coordinates: [pts] } }] });
      }
    }
  } catch { /* ignore */ }

  return Response.json({ teiger: [] });
}
