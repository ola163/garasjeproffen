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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; naboId: string }> },
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { naboId } = await params;
  const body = await request.json();
  const allowed = [
    "eier_navn", "eier_postadresse", "eier_epost", "eier_personnummer",
    "eiendom_adresse", "status", "svar_tekst", "svar_mottatt_at",
  ];
  const update = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)));
  const { data, error } = await sb()
    .from("nabovarsel_naboer")
    .update(update)
    .eq("id", naboId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; naboId: string }> },
) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { naboId } = await params;
  const { error } = await sb().from("nabovarsel_naboer").delete().eq("id", naboId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
