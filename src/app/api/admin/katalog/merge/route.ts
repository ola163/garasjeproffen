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

// POST /api/admin/katalog/merge
// Body: { fromId: string; toId: string }
// Moves all supplier links from "from" product to "to" product (non-conflicting),
// then deletes the "from" product.
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { fromId, toId } = await req.json() as { fromId: string; toId: string };
  if (!fromId || !toId || fromId === toId) {
    return NextResponse.json({ error: "fromId og toId må være ulike og begge satt" }, { status: 400 });
  }

  const sb = getSupabase();

  // Fetch both products
  const [fromRes, toRes] = await Promise.all([
    sb.from("gp_products").select("id, varenr, name").eq("id", fromId).single(),
    sb.from("gp_products").select("id, varenr, name").eq("id", toId).single(),
  ]);
  if (!fromRes.data) return NextResponse.json({ error: "Kilde-vare ikke funnet" }, { status: 404 });
  if (!toRes.data) return NextResponse.json({ error: "Mål-vare ikke funnet" }, { status: 404 });

  const fromVarenr = fromRes.data.varenr as string;
  const toVarenr = toRes.data.varenr as string;

  // Fetch all links for both products
  const [fromLinksRes, toLinksRes] = await Promise.all([
    sb.from("gp_product_supplier_links").select("supplier, supplier_varenr").eq("gp_varenr", fromVarenr),
    sb.from("gp_product_supplier_links").select("supplier").eq("gp_varenr", toVarenr),
  ]);

  const toSuppliers = new Set((toLinksRes.data ?? []).map(l => l.supplier as string));

  // Move from's links that don't conflict with to's existing links
  const toMove = (fromLinksRes.data ?? []).filter(l => !toSuppliers.has(l.supplier as string));
  let movedCount = 0;
  if (toMove.length > 0) {
    const { error: insertErr } = await sb.from("gp_product_supplier_links").insert(
      toMove.map(l => ({ gp_varenr: toVarenr, supplier: l.supplier, supplier_varenr: l.supplier_varenr }))
    );
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
    movedCount = toMove.length;
  }

  // Delete all of from's links, then delete the product
  await sb.from("gp_product_supplier_links").delete().eq("gp_varenr", fromVarenr);
  const { error: delErr } = await sb.from("gp_products").delete().eq("id", fromId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    movedLinks: movedCount,
    skippedLinks: (fromLinksRes.data?.length ?? 0) - movedCount,
    fromVarenr,
    toVarenr,
  });
}
