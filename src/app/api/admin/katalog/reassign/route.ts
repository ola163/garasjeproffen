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

type CatRow = { id: string; label: string; varenr_start: number; varenr_end: number | null; parent_id: string | null };
type ProductRow = { id: string; varenr: string; category: string };

// POST /api/admin/katalog/reassign
// Finds products in main categories whose GPV varenr falls inside a subcategory range
// and moves them to the first free slot in the main category's own range.
// Also updates gp_product_supplier_links to reflect the new varenr.
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();

  const [{ data: allCats }, { data: allProds }] = await Promise.all([
    sb.from("gp_categories").select("id, label, varenr_start, varenr_end, parent_id"),
    sb.from("gp_products").select("id, varenr, category").like("varenr", "GPV-%"),
  ]);

  const cats = (allCats ?? []) as CatRow[];
  const prods = (allProds ?? []) as ProductRow[];

  // Map: parent category id → subcategory blocked ranges
  const subcatBlocked = new Map<string, Array<{ s: number; e: number }>>();
  for (const cat of cats) {
    if (!cat.parent_id) continue;
    const ss = cat.varenr_start;
    const se = cat.varenr_end;
    if (ss == null || se == null) continue;
    if (!subcatBlocked.has(cat.parent_id)) subcatBlocked.set(cat.parent_id, []);
    subcatBlocked.get(cat.parent_id)!.push({ s: ss, e: se });
  }

  // Build set of all used GPV numbers (globally) so we never double-assign
  const usedNums = new Set<number>();
  for (const p of prods) {
    const n = parseInt(p.varenr.replace("GPV-", ""));
    if (!isNaN(n)) usedNums.add(n);
  }

  const reassigned: Array<{ oldVarenr: string; newVarenr: string; name?: string }> = [];

  // Process each main (top-level) category that has subcategories
  for (const cat of cats) {
    if (cat.parent_id) continue; // skip subcategories
    const blocked = subcatBlocked.get(cat.id);
    if (!blocked || blocked.length === 0) continue; // no subcategories → nothing to fix

    const start = cat.varenr_start;
    const end   = cat.varenr_end ?? (start + 999);

    // Find products in THIS main category whose varenr is inside a subcategory range
    const conflicts = prods.filter(p => {
      if (p.category !== cat.label) return false;
      const n = parseInt(p.varenr.replace("GPV-", ""));
      if (isNaN(n) || n < start || n > end) return false;
      return blocked.some(b => n >= b.s && n <= b.e);
    });

    if (conflicts.length === 0) continue;

    for (const p of conflicts) {
      // Find first free slot outside all blocked ranges
      let newNum: number | null = null;
      for (let n = start; n <= end; n++) {
        if (blocked.some(b => n >= b.s && n <= b.e)) continue;
        if (usedNums.has(n)) continue;
        newNum = n;
        break;
      }
      if (newNum === null) continue; // main range is full — leave it alone

      const newVarenr = `GPV-${newNum}`;
      usedNums.add(newNum); // reserve immediately so next iteration doesn't reuse it

      // Update product varenr
      const { error: prodErr } = await sb
        .from("gp_products")
        .update({ varenr: newVarenr })
        .eq("id", p.id);
      if (prodErr) continue; // skip if update failed

      // Update supplier links that reference the old varenr
      await sb
        .from("gp_product_supplier_links")
        .update({ gp_varenr: newVarenr })
        .eq("gp_varenr", p.varenr);

      reassigned.push({ oldVarenr: p.varenr, newVarenr });
    }
  }

  return NextResponse.json({ reassigned, count: reassigned.length });
}
