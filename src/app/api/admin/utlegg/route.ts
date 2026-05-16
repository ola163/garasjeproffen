import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const cookieStore = await cookies();
  const email = cookieStore.get("gp-user")?.value;
  const isAdmin = cookieStore.get("gp-admin")?.value === "1";
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  if (!db) return Response.json({ error: "DB ikke konfigurert" }, { status: 503 });

  const query = db.from("utlegg").select("*").order("created_at", { ascending: false });
  const { data, error } = isAdmin ? await query : await query.eq("submitted_by", email);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const email = cookieStore.get("gp-user")?.value;
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  if (!db) return Response.json({ error: "DB ikke konfigurert" }, { status: 503 });

  let amount: number, paid_by: string, description: string, category: string,
    ticket_number: string | undefined, notes: string | undefined, image_url: string | undefined;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    amount = parseFloat(form.get("amount") as string);
    paid_by = (form.get("paid_by") as string) || email;
    description = (form.get("description") as string) ?? "";
    category = (form.get("category") as string) ?? "";
    ticket_number = (form.get("ticket_number") as string) || undefined;
    notes = (form.get("notes") as string) || undefined;

    const file = form.get("image") as File | null;
    if (file && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await db.storage
        .from("utlegg-kvitteringer")
        .upload(path, buffer, { contentType: file.type, upsert: false });
      if (!upErr) {
        const { data: urlData } = db.storage.from("utlegg-kvitteringer").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
    }
  } else {
    const body = await request.json() as { amount?: number; paid_by?: string; description?: string; category?: string; ticket_number?: string; notes?: string };
    amount = body.amount ?? 0;
    paid_by = body.paid_by || email;
    description = body.description ?? "";
    category = body.category ?? "";
    ticket_number = body.ticket_number || undefined;
    notes = body.notes || undefined;
  }

  if (!amount || !description || !category) {
    return Response.json({ error: "Mangler påkrevde felt." }, { status: 400 });
  }

  const { data, error } = await db.from("utlegg").insert({
    submitted_by: email, paid_by, amount, description, category, ticket_number, notes, image_url,
  }).select().single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
