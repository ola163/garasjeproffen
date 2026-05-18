import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAdmin() {
  const jar = await cookies();
  return jar.get("gp-admin")?.value === "1";
}

// GET /api/admin/nabovarsel?quote_id=xxx  — list all nabovarsel for a quote
export async function GET(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const quote_id = searchParams.get("quote_id");
  if (!quote_id) return NextResponse.json({ error: "quote_id required" }, { status: 400 });

  const { data, error } = await sb()
    .from("nabovarsel")
    .select("*, nabovarsel_naboer(*)")
    .eq("quote_id", quote_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/admin/nabovarsel  — create a nabovarsel case for a quote
export async function POST(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { quote_id, adresse, kommunenr, gnr, bnr, lat, lng, tiltaket } = body;
  if (!quote_id) return NextResponse.json({ error: "quote_id required" }, { status: 400 });

  const frist = new Date();
  frist.setDate(frist.getDate() + 14);

  const { data, error } = await sb()
    .from("nabovarsel")
    .insert({ quote_id, adresse, kommunenr, gnr, bnr, lat, lng, tiltaket, frist: frist.toISOString() })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
