import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { validateFile } from "@/lib/file-validation";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const adminEmail = formData.get("adminEmail") as string;
    const ticketNumber = formData.get("ticketNumber") as string;
    const quoteId = formData.get("quoteId") as string;
    const files = formData.getAll("files") as File[];

    if (!ALLOWED_ADMINS.includes((adminEmail ?? "").toLowerCase())) {
      return NextResponse.json({ success: false, error: "Ikke tilgang" }, { status: 403 });
    }

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sbUrl || !sbKey) {
      return NextResponse.json({ success: false, error: "Supabase ikke konfigurert" }, { status: 500 });
    }

    const sb = createClient(sbUrl, sbKey);
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const validation = await validateFile(buffer, file.name, file.type);
      if (!validation.valid) {
        return NextResponse.json({ success: false, error: validation.reason }, { status: 400 });
      }
      const safeName = file.name
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-");
      const path = `${ticketNumber}/${Date.now()}-${safeName}`;

      const { error } = await sb.storage
        .from("quote-attachments")
        .upload(path, buffer, { contentType: file.type, upsert: true });

      if (error) {
        console.error("Storage upload error:", error.message);
        return NextResponse.json({ success: false, error: `Storage: ${error.message}` }, { status: 500 });
      }

      const { data } = sb.storage.from("quote-attachments").getPublicUrl(path);
      uploadedUrls.push(data.publicUrl);
    }

    if (uploadedUrls.length === 0) {
      return NextResponse.json({ success: false, error: "Ingen filer ble lastet opp" }, { status: 500 });
    }

    // Fetch existing attachments and append
    const { data: existing } = await sb.from("quotes").select("attachments").eq("id", quoteId).single();
    const current: string[] = existing?.attachments ?? [];
    const updated = [...current, ...uploadedUrls];

    await sb.from("quotes").update({ attachments: updated }).eq("id", quoteId);

    return NextResponse.json({ success: true, urls: uploadedUrls, all: updated });
  } catch (err) {
    console.error("upload-attachment error:", err);
    return NextResponse.json({ success: false, error: "Noe gikk galt" }, { status: 500 });
  }
}
