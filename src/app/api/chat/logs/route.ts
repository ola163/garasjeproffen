import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response("DB not configured", { status: 503 });

  const db = createClient(url, key);
  const { data, error } = await db
    .from("chat_logs")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return new Response(error.message, { status: 500 });
  return Response.json(data ?? []);
}
