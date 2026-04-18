import { NextResponse } from "next/server";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

const CATEGORY_LABELS: Record<string, string> = {
  "garasje-carport": "Garasje/Carport",
  "hagestue-bod": "Hagestue/Bod",
  "verksted": "Verksted",
  "pergola": "Frittliggende Pergola",
  "hytte-anneks": "Hytte/Anneks",
};

export async function POST(request: Request) {
  try {
    const { title, category, description, images, userEmail } = await request.json();

    if (!ALLOWED_ADMINS.includes((userEmail ?? "").toLowerCase())) {
      return NextResponse.json({ success: false, error: "Ikke tilgang" }, { status: 403 });
    }

    const FB_PAGE_ID = process.env.FB_PAGE_ID;
    const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

    if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
      console.log("Facebook ikke konfigurert – hopper over FB-post");
      return NextResponse.json({ success: true, facebookPostId: null });
    }

    const categoryLabel = CATEGORY_LABELS[category] ?? category;
    const caption = [
      `✨ Nytt referanseprosjekt: ${title}`,
      categoryLabel,
      description || "",
      "🏠 Se flere prosjekter på garasjeproffen.no/referanseprosjekter",
    ].filter(Boolean).join("\n\n");

    const imageUrls: string[] = images ?? [];
    let facebookPostId: string | null = null;

    if (imageUrls.length === 0) {
      const res = await fetch(`https://graph.facebook.com/v20.0/${FB_PAGE_ID}/feed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: caption, access_token: FB_PAGE_ACCESS_TOKEN }),
      });
      const data = await res.json();
      if (data.error) console.error("Facebook feed error:", data.error);
      facebookPostId = data.id ?? null;
    } else if (imageUrls.length === 1) {
      const res = await fetch(`https://graph.facebook.com/v20.0/${FB_PAGE_ID}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrls[0], caption, access_token: FB_PAGE_ACCESS_TOKEN }),
      });
      const data = await res.json();
      if (data.error) console.error("Facebook photos error:", data.error);
      facebookPostId = data.post_id ?? data.id ?? null;
    } else {
      // Upload each image as unpublished, then create a multi-photo post
      const photoIds: string[] = [];
      for (const url of imageUrls) {
        const res = await fetch(`https://graph.facebook.com/v20.0/${FB_PAGE_ID}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, published: false, access_token: FB_PAGE_ACCESS_TOKEN }),
        });
        const data = await res.json();
        if (data.error) console.error("Facebook unpublished photo error:", data.error);
        if (data.id) photoIds.push(data.id);
      }
      if (photoIds.length > 0) {
        const res = await fetch(`https://graph.facebook.com/v20.0/${FB_PAGE_ID}/feed`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: caption,
            attached_media: photoIds.map((id) => ({ media_fbid: id })),
            access_token: FB_PAGE_ACCESS_TOKEN,
          }),
        });
        const data = await res.json();
        if (data.error) console.error("Facebook multi-photo feed error:", data.error);
        facebookPostId = data.id ?? null;
      }
    }

    console.log("Facebook post created:", facebookPostId);
    return NextResponse.json({ success: true, facebookPostId });
  } catch (err) {
    console.error("Referanseprosjekter API error:", err);
    return NextResponse.json({ success: false, error: "Noe gikk galt" }, { status: 500 });
  }
}
