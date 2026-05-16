import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function requireAdmin() {
  const cookieStore = await cookies();
  return cookieStore.get("gp-admin")?.value === "1";
}

export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  if (!db) return Response.json([], { status: 200 });
  const { data, error } = await db
    .from("messe_notater")
    .select("id, content, url, url_label, created_at")
    .order("created_at", { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data ?? []);
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  if (!db) return Response.json({ error: "DB ikke konfigurert" }, { status: 503 });
  const body = await request.json() as { content?: string; url?: string; url_label?: string };
  const content = body.content?.trim() ?? "";
  if (!content) return Response.json({ error: "Innhold er påkrevd." }, { status: 400 });
  const { data, error } = await db
    .from("messe_notater")
    .insert({ content, url: body.url?.trim() || null, url_label: body.url_label?.trim() || null })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
