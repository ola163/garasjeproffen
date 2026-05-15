import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const navn = searchParams.get("navn");

  if (!navn) {
    return NextResponse.json({ error: "Missing navn" }, { status: 400 });
  }

  try {
    // Wikimedia Commons pattern: {TitleCaseName}_komm.svg  (no kommunenummer prefix)
    // e.g. Stavanger_komm.svg, Sandnes_komm.svg, Ålesund_komm.svg
    const commonsUrl = await fetchCommonsUrl(navn);
    if (commonsUrl) {
      const res = await proxyImage(commonsUrl);
      if (res) return res;
    }

    return NextResponse.json({ error: "No coat of arms found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "Failed to fetch logo" }, { status: 500 });
  }
}

async function fetchCommonsUrl(navn: string): Promise<string | null> {
  // Title-case each word and join with underscores: "os og omegn" → "Os_Og_Omegn"
  const titleCase = navn
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("_");
  const filename = `${titleCase}_komm.svg`;

  const apiUrl =
    `https://commons.wikimedia.org/w/api.php?action=query` +
    `&titles=File:${encodeURIComponent(filename)}` +
    `&prop=imageinfo&iiprop=url&iiurlwidth=300&format=json&origin=*`;

  try {
    const res = await fetch(apiUrl, {
      headers: { "User-Agent": "GarasjeProffen/1.0 (post@garasjeproffen.no)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      query?: {
        pages?: Record<string, { pageid?: number; imageinfo?: [{ thumburl?: string }] }>;
      };
    };
    const pages = data.query?.pages ?? {};
    const page  = Object.values(pages)[0];
    // pageid === -1 means the file does not exist on Commons
    if (page && page.pageid !== -1 && page.imageinfo?.[0]?.thumburl) {
      return page.imageinfo[0].thumburl;
    }
    return null;
  } catch {
    return null;
  }
}

async function proxyImage(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "GarasjeProffen/1.0 (post@garasjeproffen.no)" },
      signal: AbortSignal.timeout(6000),
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
