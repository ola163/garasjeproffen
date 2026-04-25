import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 3) return NextResponse.json({ adresser: [] });

  const url = `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(q)}&treffPerSide=6&asciiKompatibel=true`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) return NextResponse.json({ adresser: [] });

  const data = await res.json() as { adresser?: unknown[] };
  return NextResponse.json({ adresser: data.adresser ?? [] });
}
