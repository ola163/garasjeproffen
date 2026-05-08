import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Supabase Management API — requires SUPABASE_ACCESS_TOKEN (personal access token)
// from https://supabase.com/dashboard/account/tokens
const PROJECT_REF = "knznyeiorsypxwireuok";

export async function GET() {
  // Check migration status using anon key (read-only, safe)
  const jar = await cookies();
  if (jar.get("gp-admin")?.value !== "1") {
    return NextResponse.json({ ok: false, msg: "Unauthorized" }, { status: 401 });
  }

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/quotes?select=map_lat&limit=0`;
  const res = await fetch(url, {
    headers: {
      apikey:        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""}`,
    },
  });

  // If the column exists, PostgREST returns 200 (even with 0 rows)
  // If the column doesn't exist, PostgREST returns a 400 with PGRST error
  if (res.ok) {
    return NextResponse.json({ migrated: true });
  }
  const err = await res.json().catch(() => ({}));
  const missing = err?.code === "42703" || err?.message?.includes("map_lat");
  return NextResponse.json({ migrated: !missing, error: err?.message });
}

export async function POST(req: NextRequest) {
  const jar = await cookies();
  if (jar.get("gp-admin")?.value !== "1") {
    return NextResponse.json({ ok: false, msg: "Unauthorized" }, { status: 401 });
  }

  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!accessToken) {
    return NextResponse.json({
      ok: false,
      msg: "Legg til SUPABASE_ACCESS_TOKEN (personal access token fra supabase.com/dashboard/account/tokens) i .env.local og restart.",
    }, { status: 500 });
  }

  const { sql } = await req.json() as { sql: string };

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sql }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: false, msg: err?.message ?? `HTTP ${res.status}` });
  }

  return NextResponse.json({ ok: true, msg: "Migrasjon kjørt" });
}
