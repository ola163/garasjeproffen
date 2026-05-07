import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const db = getDb();
  if (!db) return Response.json([]);
  const { data } = await db
    .from("soknadshjelp_priser")
    .select("key, label, price, description, sort_order")
    .order("sort_order");
  return Response.json(data ?? []);
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  if (!db) return Response.json({ error: "DB ikke konfigurert" }, { status: 503 });
  const { key, price }: { key: string; price: number } = await request.json();
  const { error } = await db
    .from("soknadshjelp_priser")
    .update({ price, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
