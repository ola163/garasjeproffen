import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const MESSE_EMAIL = "messe@garasjeproffen.no";
const FALLBACK_PASSWORD = "Jærdagen2026";

function hashPassword(password: string, salt: string): string {
  return createHash("sha256").update(salt + password).digest("hex");
}

function verifyEncoded(password: string, encoded: string): boolean {
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash) return false;
  return hashPassword(password, salt) === hash;
}

async function getStoredHash(): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const db = createClient(url, key);
    const { data } = await db
      .from("app_settings")
      .select("value")
      .eq("key", "messe_password_hash")
      .maybeSingle();
    return data?.value ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password: string = body?.password ?? "";

  if (!password) {
    return NextResponse.json({ error: "Feil passord." }, { status: 401 });
  }

  const storedHash = await getStoredHash();
  const valid = storedHash
    ? verifyEncoded(password, storedHash)
    : password === FALLBACK_PASSWORD;

  if (!valid) {
    return NextResponse.json({ error: "Feil passord." }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  const maxAge = 60 * 60 * 12; // 12 hours
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };

  res.cookies.set("gp-user", MESSE_EMAIL, cookieOpts);
  res.cookies.set("gp-admin", "0", cookieOpts);
  return res;
}
