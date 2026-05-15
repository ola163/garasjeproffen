import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nr   = searchParams.get("nr");
  const navn = searchParams.get("navn");

  if (!navn) {
    return NextResponse.json({ error: "Missing navn" }, { status: 400 });
  }

  try {
    // 1. Try Wikimedia Commons with predictable filename: {nr}_{TitleCase}_komm.svg
    if (nr) {
      const commonsUrl = await fetchCommonsUrl(nr, navn);
      if (commonsUrl) {
        const res = await proxyImage(commonsUrl);
        if (res) return res;
      }
    }

    // 2. Fallback: Norwegian Wikipedia pageimages (infobox image)
    const wikiUrl = await fetchWikipediaPageimage(navn);
    if (wikiUrl) {
      const res = await proxyImage(wikiUrl);
      if (res) return res;
    }

    return NextResponse.json({ error: "No coat of arms found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch logo" }, { status: 500 });
  }
}

async function fetchCommonsUrl(nr: string, navn: string): Promise<string | null> {
  try {
    // Wikimedia Commons filename pattern: {kommunenummer}_{TitleCaseName}_komm.svg
    const titleCase = navn
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("_");
    const filename = `${nr}_${titleCase}_komm.svg`;

    const apiUrl =
      `https://commons.wikimedia.org/w/api.php?action=query` +
      `&titles=File:${encodeURIComponent(filename)}` +
      `&prop=imageinfo&iiprop=url&iiurlwidth=300&format=json&origin=*`;

    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "GarasjeProffen/1.0 (post@garasjeproffen.no)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      query?: {
        pages?: Record<string, { pageid?: number; imageinfo?: [{ thumburl?: string }] }>;
      };
    };
    const pages = data.query?.pages ?? {};
    const page  = Object.values(pages)[0];
    // pageid === -1 means file not found
    if (page && page.pageid !== -1 && page.imageinfo?.[0]?.thumburl) {
      return page.imageinfo[0].thumburl;
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchWikipediaPageimage(navn: string): Promise<string | null> {
  try {
    const title = `${navn} kommune`;
    const apiUrl =
      `https://no.wikipedia.org/w/api.php?action=query&prop=pageimages` +
      `&titles=${encodeURIComponent(title)}&pithumbsize=300&pilimit=1&format=json&origin=*`;

    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "GarasjeProffen/1.0 (post@garasjeproffen.no)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      query?: { pages?: Record<string, { thumbnail?: { source: string } }> };
    };
    const pages = data.query?.pages ?? {};
    const page  = Object.values(pages)[0];
    return page?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

async function proxyImage(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GarasjeProffen/1.0 (post@garasjeproffen.no)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return null;
  }
}
