import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { DEFAULT_DOOR_MARKUP } from "@/lib/door-pricing";

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  const db = getDb();
  if (!db) return Response.json({ door_markup: DEFAULT_DOOR_MARKUP });

  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "door_markup")
    .single();

  const markup = data?.value != null ? Number(data.value) : DEFAULT_DOOR_MARKUP;
  return Response.json({ door_markup: markup });
}

export async function PATCH(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const markup = Number(body.door_markup);
  if (isNaN(markup) || markup < 0 || markup > 5) {
    return Response.json({ error: "Ugyldig påslag" }, { status: 400 });
  }

  const db = getDb();
  if (!db) return Response.json({ error: "DB ikke konfigurert" }, { status: 503 });

  await db.from("app_settings").upsert(
    { key: "door_markup", value: String(markup) },
    { onConflict: "key" },
  );

  return Response.json({ door_markup: markup });
}
