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

// PATCH /api/admin/katalog/kategorier/[id]
// body: { label?, varenr_start? } OR { move: "up" | "down" }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json() as { label?: string; varenr_start?: number; varenr_end?: number | null; move?: "up" | "down" };
  const sb = getSupabase();

  if (body.move === "up" || body.move === "down") {
    // Move within the same sibling group (same parent_id level)
    const { data: thisCat } = await sb.from("gp_categories").select("parent_id").eq("id", id).single();
    let siblingsQuery = sb.from("gp_categories").select("*").order("sort_order");
    if (thisCat?.parent_id) {
      siblingsQuery = siblingsQuery.eq("parent_id", thisCat.parent_id);
    } else {
      siblingsQuery = siblingsQuery.is("parent_id", null);
    }
    const { data: cats } = await siblingsQuery;
    if (!cats) return NextResponse.json({ error: "Feil" }, { status: 500 });

    const idx = cats.findIndex(c => c.id === id);
    if (idx === -1) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });

    const swapIdx = body.move === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= cats.length) {
      return NextResponse.json({ data: cats });
    }

    const cur = cats[idx];
    const other = cats[swapIdx];
    await Promise.all([
      sb.from("gp_categories").update({ sort_order: other.sort_order }).eq("id", cur.id),
      sb.from("gp_categories").update({ sort_order: cur.sort_order }).eq("id", other.id),
    ]);

    const { data: updated } = await sb.from("gp_categories").select("*").order("sort_order");
    return NextResponse.json({ data: updated ?? [] });
  }

  const updates: Record<string, unknown> = {};
  if (body.label !== undefined) updates.label = body.label.trim();
  if (body.varenr_start !== undefined) updates.varenr_start = body.varenr_start;
  if (body.varenr_end !== undefined) updates.varenr_end = body.varenr_end;

  const { data, error } = await sb.from("gp_categories").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/admin/katalog/kategorier/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sb = getSupabase();

  // Block deletion if products use this category
  const { data: cat } = await sb.from("gp_categories").select("label").eq("id", id).single();
  if (cat) {
    const { count } = await sb.from("gp_products").select("id", { count: "exact", head: true }).eq("category", cat.label);
    if (count && count > 0) {
      return NextResponse.json({ error: `Kan ikke slette — ${count} varer bruker denne kategorien` }, { status: 409 });
    }
  }

  const { error } = await sb.from("gp_categories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
