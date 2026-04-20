import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = db();
  if (!client) return new Response("DB not configured", { status: 503 });
  const { error } = await client.from("chat_logs").delete().eq("id", id);
  if (error) return new Response(error.message, { status: 500 });
  return new Response("ok");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { flagged } = await req.json();
  const client = db();
  if (!client) return new Response("DB not configured", { status: 503 });
  const { error } = await client.from("chat_logs").update({ flagged }).eq("id", id);
  if (error) return new Response(error.message, { status: 500 });
  return new Response("ok");
}
