import { NextResponse } from "next/server";

export async function GET() {
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;

  if (!pageId || !token) {
    return NextResponse.json({ photos: [] });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${pageId}/photos?type=uploaded&fields=images,name,created_time&limit=12&access_token=${token}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) return NextResponse.json({ photos: [] });

    const data = await res.json();

    const photos = (data.data ?? []).map((p: {
      id: string;
      name?: string;
      created_time: string;
      images: { source: string; height: number; width: number }[];
    }) => ({
      id: p.id,
      caption: p.name ?? "",
      createdTime: p.created_time,
      src: p.images?.[0]?.source ?? "",
      thumb: p.images?.find((img) => img.width <= 720)?.source ?? p.images?.[0]?.source ?? "",
    }));

    return NextResponse.json({ photos });
  } catch {
    return NextResponse.json({ photos: [] });
  }
}
