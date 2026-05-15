import { NextResponse } from "next/server";
import { createHash } from "crypto";

const MESSE_EMAIL = "messe@garasjeproffen.no";
const FALLBACK_PASSWORD = "Jærdagen2026";

function verifyHash(password: string, encoded: string): boolean {
  try {
    const sep = encoded.indexOf(":");
    if (sep < 1) return false;
    const salt = encoded.slice(0, sep);
    const expected = encoded.slice(sep + 1);
    const actual = createHash("sha256").update(salt + password).digest("hex");
    return actual === expected;
  } catch {
    return false;
  }
}

async function getStoredHash(): Promise<string | null> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    // Dynamic import to avoid module-level initialization issues
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data } = await db
      .from("app_settings")
      .select("value")
      .eq("key", "messe_password_hash")
      .maybeSingle();
    return (data as { value?: string } | null)?.value ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const password = typeof body?.password === "string" ? body.password : "";

    if (!password) {
      return NextResponse.json({ error: "Feil passord." }, { status: 401 });
    }

    const storedHash = await getStoredHash();
    const valid = storedHash
      ? verifyHash(password, storedHash)
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
  } catch {
    return NextResponse.json({ error: "Server feil." }, { status: 500 });
  }
}
