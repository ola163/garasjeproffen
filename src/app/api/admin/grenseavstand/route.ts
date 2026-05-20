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

// Minimum distance from an axis-aligned rectangle to a line segment
function distRectToSeg(
  cx: number, cy: number, hw: number, hl: number,
  ax: number, ay: number, bx: number, by: number,
): number {
  const corners: [number, number][] = [
    [cx - hw, cy - hl], [cx + hw, cy - hl],
    [cx + hw, cy + hl], [cx - hw, cy + hl],
  ];
  return Math.min(...corners.map(([px, py]) => distPointToSeg(px, py, ax, ay, bx, by)));
}

// Ray-casting point-in-polygon
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

function compassDir(midX: number, midY: number): string {
  const angle = Math.atan2(midY, midX) * (180 / Math.PI);
  if (angle >= -22.5 && angle < 22.5) return "Øst";
  if (angle >= 22.5 && angle < 67.5) return "Nordøst";
  if (angle >= 67.5 && angle < 112.5) return "Nord";
  if (angle >= 112.5 && angle < 157.5) return "Nordvest";
  if (angle >= -67.5 && angle < -22.5) return "Sørøst";
  if (angle >= -112.5 && angle < -67.5) return "Sør";
  if (angle >= -157.5 && angle < -112.5) return "Sørvest";
  return "Vest";
}

export async function GET(request: Request) {
  const jar = await cookies();
  if (jar.get("gp-admin")?.value !== "1")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(request.url).searchParams;
  const lat = parseFloat(sp.get("lat") ?? "");
  const lng = parseFloat(sp.get("lng") ?? "");
  const bredde = parseFloat(sp.get("bredde") ?? "0"); // metres
  const lengde = parseFloat(sp.get("lengde") ?? "0"); // metres

  if (isNaN(lat) || isNaN(lng))
    return NextResponse.json({ error: "lat og lng påkrevd" }, { status: 400 });

  // ~150 m bbox around the point
  const d = 0.0015;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;

  const wfsUrl =
    `https://wfs.geonorge.no/skwms1/wfs.matrikkelkart2` +
    `?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature` +
    `&TYPENAMES=app:Teig` +
    `&CRS=urn:ogc:def:crs:EPSG::4258` +
    `&BBOX=${bbox},urn:ogc:def:crs:EPSG::4258` +
    `&outputFormat=application/json&COUNT=30`;

  let wfsData: { features?: { geometry?: { type: string; coordinates: unknown } }[] };
  try {
    const res = await fetch(wfsUrl, { next: { revalidate: 0 } });
    if (!res.ok) return NextResponse.json({ error: "WFS feilet" }, { status: 502 });
    wfsData = await res.json();
  } catch {
    return NextResponse.json({ error: "Kartverket ikke tilgjengelig" }, { status: 502 });
  }

  const features = wfsData.features ?? [];

  // Find the polygon ring that contains the garage position
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

  if (!targetRing)
    return NextResponse.json({ error: "Fant ikke eiendomsgrensen for dette punktet" }, { status: 404 });

  // Convert ring to local metre coordinates (garage center = origin)
  const LM = lngM(lat);
  const localRing = targetRing.map(([lo, la]) => [
    (lo! - lng) * LM,
    (la! - lat) * LAT_M,
  ]);

  // Half-dimensions of the garage rectangle (0 if not provided)
  const hw = bredde > 0 ? bredde / 2 : 0;
  const hl = lengde > 0 ? lengde / 2 : 0;

  // Calculate distance to each boundary segment
  const segments: { direction: string; distance: number; wallDistance: number }[] = [];

  for (let i = 0; i < localRing.length - 1; i++) {
    const [ax, ay] = localRing[i]!;
    const [bx, by] = localRing[i + 1]!;
    const midX = (ax! + bx!) / 2;
    const midY = (ay! + by!) / 2;
    const dir = compassDir(midX!, midY!);

    // Distance from garage rectangle to this segment
    const centerDist =
      hw > 0 && hl > 0
        ? distRectToSeg(0, 0, hw, hl, ax!, ay!, bx!, by!)
        : distPointToSeg(0, 0, ax!, ay!, bx!, by!);

    // Wall distance: subtract half-garage-dimension toward this direction
    const angle = Math.atan2(midY!, midX!);
    const proj = Math.abs(hw * Math.cos(angle)) + Math.abs(hl * Math.sin(angle));
    const wallDist = Math.max(0, centerDist - proj);

    segments.push({
      direction: dir,
      distance: Math.round(centerDist * 10) / 10,
      wallDistance: Math.round(wallDist * 10) / 10,
    });
  }

  // Minimum wall distance per cardinal direction
  const byDirection: Record<string, number> = {};
  for (const seg of segments) {
    const d = seg.wallDistance;
    if (!(seg.direction in byDirection) || d < byDirection[seg.direction]!) {
      byDirection[seg.direction] = d;
    }
  }

  const allWallDistances = segments.map(s => s.wallDistance);
  const minWallDistance = Math.min(...allWallDistances);

  // Approximate property area (shoelace formula in metres)
  let area = 0;
  for (let i = 0; i < localRing.length - 1; i++) {
    const [ax, ay] = localRing[i]!;
    const [bx, by] = localRing[i + 1]!;
    area += ax! * by! - bx! * ay!;
  }
  area = Math.round(Math.abs(area) / 2);

  return NextResponse.json({
    minWallDistance,
    byDirection,
    propertyArea: area,
    garageSize: { bredde, lengde },
    needsDispensasjon: minWallDistance < 4,
  });
}
