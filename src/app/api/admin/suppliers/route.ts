import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function getDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function isAdmin() {
  const cookieStore = await cookies();
  return cookieStore.get("gp-admin")?.value === "1";
}

// GET /api/admin/suppliers
export async function GET() {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const db = getDb();
  const { data, error } = await db.from("suppliers").select("name").order("name");
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ suppliers: (data ?? []).map((r) => r.name) });
}

// POST /api/admin/suppliers  { name: string }
export async function POST(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return new Response("Navn mangler", { status: 400 });
  }
  const db = getDb();
  const { error } = await db.from("suppliers").insert({ name: name.trim() });
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
}

// DELETE /api/admin/suppliers?name=Leverandør
export async function DELETE(req: Request) {
  if (!(await isAdmin())) return new Response("Unauthorized", { status: 401 });
  const name = new URL(req.url).searchParams.get("name");
  if (!name) return new Response("Navn mangler", { status: 400 });
  const db = getDb();
  const { error } = await db.from("suppliers").delete().eq("name", name);
  if (error) return new Response(error.message, { status: 500 });
  return Response.json({ ok: true });
}
