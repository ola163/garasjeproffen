import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function normaliseRing(ring: number[][]): [number, number][] {
  if (!ring.length) return [];
  const [a] = ring[0];
  if (a > 45) return ring.map(([y, x]) => [x, y]);
  return ring as [number, number][];
}

function centroid(ring: [number, number][]): [number, number] {
  let sx = 0, sy = 0;
  for (const [x, y] of ring) { sx += x; sy += y; }
  return [sx / ring.length, sy / ring.length];
}

interface EigData {
  gaardsnummer?: number;
  bruksnummer?: number;
  seksjonsnummer?: number;
  festenummer?: number;
  kommunenummer?: string;
  adresse?: { adressetekst?: string }[];
}

interface WFSFeature {
  geometry?: { type?: string; coordinates?: unknown };
}

export async function GET(request: Request) {
  const jar = await cookies();
  if (jar.get("gp-admin")?.value !== "1")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");
  if (isNaN(lat) || isNaN(lng))
    return NextResponse.json({ error: "Missing lat/lng" }, { status: 400 });

  // 1. Main property info
  let mainGnr: number | null = null;
  let mainBnr: number | null = null;
  let mainKommunenr: string | null = null;
  let mainAdresse = "";
  try {
    const res = await fetch(
      `https://ws.geonorge.no/eiendomsopplysninger/v1/punkt?nord=${lat}&ost=${lng}&koordsys=4258`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) },
    );
    if (res.ok) {
      const data: EigData = await res.json();
      mainGnr = data.gaardsnummer ?? null;
      mainBnr = data.bruksnummer ?? null;
      mainKommunenr = data.kommunenummer ?? null;
      mainAdresse = data.adresse?.[0]?.adressetekst ?? "";
    }
  } catch { /* continue */ }

  // 2. Fetch all parcels in ~400m bbox via WFS Teig
  const d = 0.004;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d},EPSG:4326`;
  let features: WFSFeature[] = [];
  for (const typeName of ["app:Teig", "Teig"]) {
    try {
      const url =
        `https://wfs.geonorge.no/skwms1/wfs.matrikkelen?SERVICE=WFS&VERSION=2.0.0` +
        `&REQUEST=GetFeature&TYPENAMES=${encodeURIComponent(typeName)}` +
        `&OUTPUTFORMAT=application/json&COUNT=60&BBOX=${bbox}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) continue;
      const data = await res.json();
      features = (data?.features ?? []) as WFSFeature[];
      if (features.length > 0) break;
    } catch { /* try next */ }
  }

  // 3. Extract centroid for each parcel polygon
  const centroids: [number, number][] = [];
  for (const f of features) {
    const geom = f.geometry;
    if (!geom) continue;
    const polys =
      geom.type === "Polygon"
        ? [geom.coordinates as number[][][]]
        : geom.type === "MultiPolygon"
        ? (geom.coordinates as number[][][][])
        : [];
    for (const poly of polys) {
      if (Array.isArray(poly[0])) {
        const ring = normaliseRing(poly[0] as number[][]);
        if (ring.length >= 3) centroids.push(centroid(ring));
      }
    }
  }

  // 4. Resolve gnr/bnr/adresse for each centroid (parallel, best-effort)
  interface Nabo {
    gnr: number; bnr: number; snr: number; fnr: number;
    kommunenr: string; eiendom_adresse: string;
    lat: number; lng: number;
  }
  const naboMap = new Map<string, Nabo>();

  await Promise.allSettled(
    centroids.map(async ([cLng, cLat]) => {
      try {
        const res = await fetch(
          `https://ws.geonorge.no/eiendomsopplysninger/v1/punkt?nord=${cLat}&ost=${cLng}&koordsys=4258`,
          { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) },
        );
        if (!res.ok) return;
        const data: EigData = await res.json();
        const gnr = data.gaardsnummer;
        const bnr = data.bruksnummer;
        if (!gnr || !bnr) return;
        if (gnr === mainGnr && bnr === mainBnr) return;
        const snr = data.seksjonsnummer ?? 0;
        const fnr = data.festenummer ?? 0;
        const kommunenr = data.kommunenummer ?? "";
        const key = `${kommunenr}-${gnr}-${bnr}-${snr}-${fnr}`;
        if (naboMap.has(key)) return;
        const eiendom_adresse =
          data.adresse?.[0]?.adressetekst ?? `Gnr. ${gnr} Bnr. ${bnr}`;
        naboMap.set(key, { gnr, bnr, snr, fnr, kommunenr, eiendom_adresse, lat: cLat, lng: cLng });
      } catch { /* ignore */ }
    }),
  );

  return NextResponse.json({
    main: { gnr: mainGnr, bnr: mainBnr, kommunenr: mainKommunenr, adresse: mainAdresse },
    naboer: Array.from(naboMap.values()),
  });
}
