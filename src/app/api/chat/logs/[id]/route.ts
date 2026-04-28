import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function requireAdmin() {
  const cookieStore = await cookies();
  return cookieStore.get("gp-admin")?.value === "1";
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const client = db();
  if (!client) return new Response("DB not configured", { status: 503 });
  const { error } = await client.from("chat_logs").delete().eq("id", id);
  if (error) return new Response(error.message, { status: 500 });
  return new Response("ok");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return new Response("Unauthorized", { status: 401 });
  const { id } = await params;
  const { flagged } = await req.json();
  const client = db();
  if (!client) return new Response("DB not configured", { status: 503 });
  const { error } = await client.from("chat_logs").update({ flagged }).eq("id", id);
  if (error) return new Response(error.message, { status: 500 });
  return new Response("ok");
}
