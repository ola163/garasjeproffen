import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const WMS_SIZE = 1024; // output image size in pixels

/** Degrees-per-meter at a given latitude for a ~1:500 print box */
function bboxFromCenter(lon: number, lat: number, halfMeters: number) {
  const latRad = (lat * Math.PI) / 180;
  const mPerDegLat = 111_132.92 - 559.82 * Math.cos(2 * latRad) + 1.175 * Math.cos(4 * latRad);
  const mPerDegLon = 111_412.84 * Math.cos(latRad) - 93.5 * Math.cos(3 * latRad);
  const dLat = halfMeters / mPerDegLat;
  const dLon = halfMeters / mPerDegLon;
  return { minLon: lon - dLon, minLat: lat - dLat, maxLon: lon + dLon, maxLat: lat + dLat };
}

function wmsUrl(baseUrl: string, layers: string, bbox: ReturnType<typeof bboxFromCenter>) {
  const b = `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`;
  return (
    `${baseUrl}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${encodeURIComponent(layers)}&SRS=EPSG:4326` +
    `&BBOX=${b}&WIDTH=${WMS_SIZE}&HEIGHT=${WMS_SIZE}` +
    `&FORMAT=image/png&TRANSPARENT=TRUE&STYLES=`
  );
}

export async function GET(req: NextRequest) {
  // Admin-only
  const jar = await cookies();
  if (jar.get("gp-admin")?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lng") ?? "");
  // halfMeters: half the side of the bounding box in metres; 125 m → 250 m side ≈ 1:500 on A4
  const halfMeters = parseFloat(searchParams.get("halfMeters") ?? "125");

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const bbox = bboxFromCenter(lon, lat, halfMeters);

  const topoUrl = wmsUrl(
    "https://wms.geonorge.no/skwms1/wms.topo",
    "topo",
    bbox,
  );
  const matrikkelUrl = wmsUrl(
    "https://wms.geonorge.no/skwms1/wms.matrikkel",
    "eiendomsgrense,adresse,eiendoms_id",
    bbox,
  );

  const [topoRes, matrikkelRes] = await Promise.all([
    fetch(topoUrl, { next: { revalidate: 3600 } }),
    fetch(matrikkelUrl, { next: { revalidate: 3600 } }),
  ]);

  if (!topoRes.ok || !matrikkelRes.ok) {
    return NextResponse.json(
      { error: `WMS fetch failed: topo=${topoRes.status} matrikkel=${matrikkelRes.status}` },
      { status: 502 },
    );
  }

  const [topoBuf, matrikkelBuf] = await Promise.all([
    topoRes.arrayBuffer(),
    matrikkelRes.arrayBuffer(),
  ]);

  return NextResponse.json({
    topo:      Buffer.from(topoBuf).toString("base64"),
    matrikkel: Buffer.from(matrikkelBuf).toString("base64"),
    bbox,
    size: WMS_SIZE,
  });
}
