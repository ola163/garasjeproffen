import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { points } = await req.json() as { points: [number, number][] };
  const elevations = await Promise.all(
    points.map(async ([lng, lat]) => {
      try {
        const url = `https://ws.geonorge.no/hoydedata/v1/punkt?koordsys=4326&nord=${lat}&ost=${lng}&geoid=NN2000`;
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const data = await res.json() as { punkter?: { z?: number }[] };
        return data.punkter?.[0]?.z ?? null;
      } catch {
        return null;
      }
    })
  );
  return NextResponse.json({ elevations });
}
