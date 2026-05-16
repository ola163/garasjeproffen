import { createClient } from "@supabase/supabase-js";
import { DEFAULT_DOOR_MARKUP } from "@/lib/door-pricing";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ door_markup: DEFAULT_DOOR_MARKUP });

  const db = createClient(url, key);
  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "door_markup")
    .single();

  const markup = data?.value != null ? Number(data.value) : DEFAULT_DOOR_MARKUP;
  return Response.json({ door_markup: markup });
}
