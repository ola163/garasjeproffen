import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "crypto";

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(salt + password).digest("hex");
}

export function encodePassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${hashPassword(password, salt)}`;
}

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) return Response.json({ hasCustomPassword: false });

  const { data } = await db
    .from("app_settings")
    .select("value")
    .eq("key", "messe_password_hash")
    .maybeSingle();

  return Response.json({ hasCustomPassword: !!data });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  if (!db) return Response.json({ error: "DB ikke konfigurert" }, { status: 503 });

  const { password } = await request.json() as { password?: string };
  if (!password || password.length < 8) {
    return Response.json({ error: "Passord må være minst 8 tegn." }, { status: 400 });
  }

  const encoded = encodePassword(password);
  const { error } = await db.from("app_settings").upsert(
    { key: "messe_password_hash", value: encoded, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  );

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
