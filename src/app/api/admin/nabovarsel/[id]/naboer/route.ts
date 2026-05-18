import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function requireAdmin() {
  const jar = await cookies();
  return jar.get("gp-admin")?.value === "1";
}

// GET  — list neighbours for a nabovarsel case
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { data, error } = await sb()
    .from("nabovarsel_naboer")
    .select("*")
    .eq("nabovarsel_id", id)
    .order("created_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST  — bulk-insert neighbours (from Kartverket lookup or manual add)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: nabovarsel_id } = await params;
  const body = await request.json();

  // Accept either a single object or an array
  const rows = (Array.isArray(body) ? body : [body]).map((n) => ({
    nabovarsel_id,
    gnr: n.gnr ?? null,
    bnr: n.bnr ?? null,
    snr: n.snr ?? 0,
    fnr: n.fnr ?? 0,
    kommunenr: n.kommunenr ?? null,
    eiendom_adresse: n.eiendom_adresse ?? null,
    eier_navn: n.eier_navn ?? null,
    eier_postadresse: n.eier_postadresse ?? null,
    eier_epost: n.eier_epost ?? null,
  }));

  const { data, error } = await sb()
    .from("nabovarsel_naboer")
    .insert(rows)
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
