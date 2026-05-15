import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const navn = searchParams.get("navn");

  if (!navn) {
    return NextResponse.json({ error: "Missing navn" }, { status: 400 });
  }

  try {
    // Fetch coat of arms via Norwegian Wikipedia pageimages API
    const wikiTitle = `${navn} kommune`;
    const apiUrl =
      `https://no.wikipedia.org/w/api.php?action=query&prop=pageimages` +
      `&titles=${encodeURIComponent(wikiTitle)}&pithumbsize=300&pilimit=1&format=json&origin=*`;

    const wikiRes = await fetch(apiUrl, {
      headers: { "User-Agent": "GarasjeProffen/1.0 (post@garasjeproffen.no)" },
      signal: AbortSignal.timeout(5000),
    });

    if (!wikiRes.ok) throw new Error("Wikipedia API error");

    const wikiData = (await wikiRes.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source: string } }> };
    };

    const pages = wikiData.query?.pages ?? {};
    const page = Object.values(pages)[0];
    const imgUrl = page?.thumbnail?.source;

    if (!imgUrl) {
      return NextResponse.json({ error: "No image found" }, { status: 404 });
    }

    // Proxy the image from Wikimedia
    const imgRes = await fetch(imgUrl, {
      headers: { "User-Agent": "GarasjeProffen/1.0 (post@garasjeproffen.no)" },
      signal: AbortSignal.timeout(5000),
    });

    if (!imgRes.ok) {
      return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
    }

    const buffer = await imgRes.arrayBuffer();
    const contentType = imgRes.headers.get("Content-Type") || "image/png";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch logo" }, { status: 500 });
  }
}
