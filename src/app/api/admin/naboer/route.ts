import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const LAT_M = 111320;
function lngM(lat: number) { return 111320 * Math.cos((lat * Math.PI) / 180); }

function distPointToSeg(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pointInPolygon(px: number, py: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]![0]!, yi = ring[i]![1]!;
    const xj = ring[j]![0]!, yj = ring[j]![1]!;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

// Check if two rings share a boundary (any vertex within maxDist metres of the other ring's segments)
function ringsAdjacent(
  ringA: number[][], ringB: number[][],
  LM: number, maxDist = 5,
): boolean {
  for (const [bLo, bLa] of ringB) {
    for (let i = 0; i < ringA.length - 1; i++) {
      const [aLo1, aLa1] = ringA[i]!;
      const [aLo2, aLa2] = ringA[i + 1]!;
      const px = (bLo! - aLo1!) * LM;
      const py = (bLa! - aLa1!) * LAT_M;
      const ex = (aLo2! - aLo1!) * LM;
      const ey = (aLa2! - aLa1!) * LAT_M;
      if (distPointToSeg(px, py, 0, 0, ex, ey) < maxDist) return true;
    }
  }
  for (const [aLo, aLa] of ringA) {
    for (let i = 0; i < ringB.length - 1; i++) {
      const [bLo1, bLa1] = ringB[i]!;
      const [bLo2, bLa2] = ringB[i + 1]!;
      const px = (aLo! - bLo1!) * LM;
      const py = (aLa! - bLa1!) * LAT_M;
      const ex = (bLo2! - bLo1!) * LM;
      const ey = (bLa2! - bLa1!) * LAT_M;
      if (distPointToSeg(px, py, 0, 0, ex, ey) < maxDist) return true;
    }
  }
  return false;
}

function ringCentroid(ring: number[][]): [number, number] {
  let sumLo = 0, sumLa = 0;
  for (const [lo, la] of ring) { sumLo += lo!; sumLa += la!; }
  return [sumLo / ring.length, sumLa / ring.length];
}

interface EiendomPunkt {
  matrikkelnummer?: {
    kommunenummer?: string;
    gardsnummer?: number;
    bruksnummer?: number;
  };
  adresser?: { adressetekst?: string; postnummer?: string; poststed?: string }[];
  // some API versions expose these fields directly or under different keys
  adresse?: { adressetekst?: string; postnummer?: string; poststed?: string }[];
}

export async function GET(request: Request) {
  const jar = await cookies();
  if (jar.get("gp-admin")?.value !== "1")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");

  if (isNaN(lat) || isNaN(lng))
    return NextResponse.json({ error: "lat og lng påkrevd" }, { status: 400 });

  const LM = lngM(lat);
  const d = 0.002; // ~220 m bbox
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;

  const wfsUrl =
    `https://wfs.geonorge.no/skwms1/wfs.matrikkelkart2` +
    `?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
    `&TYPENAMES=app:Teig` +
    `&CRS=urn:ogc:def:crs:EPSG::4258` +
    `&BBOX=${bbox},urn:ogc:def:crs:EPSG::4258` +
    `&outputFormat=application/json&COUNT=60`;

  let wfsData: { features?: { geometry?: { type: string; coordinates: unknown } }[] };
  try {
    const res = await fetch(wfsUrl, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return NextResponse.json({ error: "WFS feilet" }, { status: 502 });
    wfsData = await res.json();
  } catch {
    return NextResponse.json({ error: "Kartverket ikke tilgjengelig" }, { status: 502 });
  }

  const features = wfsData.features ?? [];

  // Find target ring
  let targetRing: number[][] | null = null;
  for (const feat of features) {
    const geom = feat.geometry;
    if (!geom) continue;
    let rings: number[][][] = [];
    if (geom.type === "Polygon") rings = geom.coordinates as number[][][];
    else if (geom.type === "MultiPolygon")
      rings = (geom.coordinates as number[][][][]).flat(1);
    for (const ring of rings) {
      if (pointInPolygon(lng, lat, ring)) {
        targetRing = ring;
        break;
      }
    }
    if (targetRing) break;
  }

  if (!targetRing) return NextResponse.json({ naboer: [] });

  // Collect {ring, centroid} pairs for rings that share a boundary with the target
  const candidatePairs: { ring: number[][]; centroid: [number, number] }[] = [];

  for (const feat of features) {
    const geom = feat.geometry;
    if (!geom) continue;
    let rings: number[][][] = [];
    if (geom.type === "Polygon") rings = geom.coordinates as number[][][];
    else if (geom.type === "MultiPolygon")
      rings = (geom.coordinates as number[][][][]).flat(1);

    for (const ring of rings) {
      if (ring === targetRing || pointInPolygon(lng, lat, ring)) continue;
      if (ringsAdjacent(targetRing, ring, LM)) {
        candidatePairs.push({ ring, centroid: ringCentroid(ring) });
      }
    }
  }

  if (candidatePairs.length === 0) return NextResponse.json({ naboer: [] });

  // Deduplicate pairs whose centroids are < 10m apart
  const unique: { ring: number[][]; centroid: [number, number] }[] = [];
  for (const pair of candidatePairs) {
    const dup = unique.some(u =>
      Math.hypot(
        (pair.centroid[0] - u.centroid[0]) * LM,
        (pair.centroid[1] - u.centroid[1]) * LAT_M,
      ) < 10,
    );
    if (!dup) unique.push(pair);
  }

  // Resolve gnr/bnr/adresse for each centroid, keep polygon ring
  const results = await Promise.allSettled(
    unique.slice(0, 14).map(async ({ ring, centroid: [lo, la] }) => {
      const url =
        `https://ws.geonorge.no/eiendomsopplysninger/v1/punkt` +
        `?nord=${la}&ost=${lo}&koordsys=4258`;
      const r = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 3600 },
      });
      if (!r.ok) return null;
      const data: EiendomPunkt = await r.json();
      const mat = data.matrikkelnummer;
      if (!mat?.gardsnummer || !mat?.bruksnummer) return null;
      const adresseArr = data.adresser ?? data.adresse ?? [];
      const adresseObj = adresseArr[0];
      const adresseParts = [
        adresseObj?.adressetekst,
        adresseObj?.postnummer && adresseObj?.poststed
          ? `${adresseObj.postnummer} ${adresseObj.poststed}`
          : undefined,
      ].filter(Boolean);
      return {
        gnr: mat.gardsnummer,
        bnr: mat.bruksnummer,
        kommunenr: mat.kommunenummer ?? "",
        adresse: adresseParts.length > 0 ? adresseParts.join(", ") : undefined,
        polygon: ring as [number, number][],
      };
    }),
  );

  const naboer = results
    .filter(r => r.status === "fulfilled" && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<NonNullable<unknown>>).value)
    .filter((n, i, arr) => {
      const nab = n as { gnr: number; bnr: number; kommunenr: string };
      return (
        arr.findIndex(x => {
          const x2 = x as { gnr: number; bnr: number; kommunenr: string };
          return x2.gnr === nab.gnr && x2.bnr === nab.bnr && x2.kommunenr === nab.kommunenr;
        }) === i
      );
    });

  return NextResponse.json({ naboer });
}
