import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  // Cookie-based admin session
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;
  if (session === process.env.ADMIN_SESSION_SECRET) return true;

  // Supabase auth
  const sb = getSupabase();
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  if (token) {
    const { data } = await sb.auth.getUser(token);
    if (data.user?.email && ALLOWED_ADMINS.includes(data.user.email.toLowerCase())) return true;
  }
  return false;
}

// GET /api/admin/supplier-prices?supplier=Optimera&q=tre&limit=50&offset=0
export async function GET(req: NextRequest) {
  const sb = getSupabase();
  const { searchParams } = new URL(req.url);
  const supplier = searchParams.get("supplier") ?? "";
  const q        = searchParams.get("q") ?? "";
  const limit    = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
  const offset   = parseInt(searchParams.get("offset") ?? "0");

  let query = sb.from("supplier_prices").select("*", { count: "exact" });
  if (supplier) query = query.eq("supplier", supplier);
  if (q) query = query.or(`varebenevnelse.ilike.%${q}%,varenr.ilike.%${q}%,dimensjon.ilike.%${q}%`);
  query = query.order("varebenevnelse").range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count });
}

export interface SupplierPriceRow {
  supplier: string;
  varenr: string;
  ean?: string;
  varegruppenr?: string;
  kategori?: string;
  varebenevnelse: string;
  dimensjon?: string;
  enhet?: string;
  bruttopris: number;
  nettopris: number;
  antall: number;
  mva_pst: number;
}

// POST /api/admin/supplier-prices  { supplier, rows[] }
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabase();
  const { supplier, rows } = (await req.json()) as { supplier: string; rows: SupplierPriceRow[] };

  if (!supplier || !rows?.length) {
    return NextResponse.json({ error: "supplier and rows required" }, { status: 400 });
  }

  // Upsert in batches of 500
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500).map(r => ({ ...r, supplier, updated_at: new Date().toISOString() }));
    const { error } = await sb
      .from("supplier_prices")
      .upsert(batch, { onConflict: "supplier,varenr" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    inserted += batch.length;
  }

  return NextResponse.json({ inserted });
}

// DELETE /api/admin/supplier-prices?supplier=Optimera
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabase();
  const { searchParams } = new URL(req.url);
  const supplier = searchParams.get("supplier");
  if (!supplier) return NextResponse.json({ error: "supplier required" }, { status: 400 });

  const { error, count } = await sb
    .from("supplier_prices")
    .delete({ count: "exact" })
    .eq("supplier", supplier);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count });
}
