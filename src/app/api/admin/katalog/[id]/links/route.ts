import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value === process.env.ADMIN_SESSION_SECRET) return true;
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (token) {
    const { data } = await getSupabase().auth.getUser(token);
    if (data.user?.email && ALLOWED_ADMINS.includes(data.user.email.toLowerCase())) return true;
  }
  return false;
}

// GET /api/admin/katalog/[id]/links
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sb = getSupabase();

  const { data: product } = await sb.from("gp_products").select("varenr").eq("id", id).single();
  if (!product) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });

  const { data, error } = await sb
    .from("gp_product_supplier_links")
    .select("supplier, supplier_varenr")
    .eq("gp_varenr", product.varenr);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// PUT /api/admin/katalog/[id]/links
// Body: { links: { supplier: string; supplier_varenr: string }[] }
// Replaces all links for this product (empty supplier_varenr = delete that link)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { links } = await req.json() as { links: { supplier: string; supplier_varenr: string }[] };

  const sb = getSupabase();
  const { data: product } = await sb.from("gp_products").select("varenr").eq("id", id).single();
  if (!product) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });

  const gp_varenr = product.varenr as string;

  // Delete all existing links for this product
  const { error: delError } = await sb.from("gp_product_supplier_links").delete().eq("gp_varenr", gp_varenr);
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  // Insert non-empty links
  const toInsert = links.filter(l => l.supplier_varenr.trim());
  if (toInsert.length > 0) {
    const { error } = await sb.from("gp_product_supplier_links").insert(
      toInsert.map(l => ({ gp_varenr, supplier: l.supplier, supplier_varenr: l.supplier_varenr.trim() }))
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updated: toInsert.length });
}

// PATCH /api/admin/katalog/[id]/links
// Body: { supplier: string; supplier_varenr: string }
// Upserts a single supplier link without touching other suppliers' links.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { supplier, supplier_varenr } = await req.json() as { supplier: string; supplier_varenr: string };

  const sb = getSupabase();
  const { data: product } = await sb.from("gp_products").select("varenr").eq("id", id).single();
  if (!product) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });

  const trimmed = supplier_varenr.trim();
  if (!trimmed) {
    await sb.from("gp_product_supplier_links").delete()
      .eq("gp_varenr", product.varenr as string).eq("supplier", supplier);
    return NextResponse.json({ success: true });
  }

  const { error } = await sb.from("gp_product_supplier_links").upsert(
    { gp_varenr: product.varenr as string, supplier, supplier_varenr: trimmed },
    { onConflict: "gp_varenr,supplier" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
