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


// GET /api/admin/katalog?q=&category=&limit=200&offset=0
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const limit = Math.min(500, parseInt(searchParams.get("limit") ?? "500"));
  const offset = parseInt(searchParams.get("offset") ?? "0");

  let query = sb.from("gp_products").select("*", { count: "exact" }).order("varenr");
  if (category) query = query.eq("category", category);
  if (q) query = query.or(`varenr.ilike.%${q}%,name.ilike.%${q}%,description.ilike.%${q}%`);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], count: count ?? 0 });
}

// POST /api/admin/katalog
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, category, unit, description } = body as {
    name: string; category: string; unit?: string; description?: string; varenr?: string;
  };
  let { varenr } = body as { varenr?: string };

  if (!name?.trim() || !category) {
    return NextResponse.json({ error: "name og category er påkrevd" }, { status: 400 });
  }

  const sb = getSupabase();

  if (!varenr?.trim()) {
    // Fetch category (need id + range)
    const { data: cat } = await sb
      .from("gp_categories")
      .select("id, varenr_start, varenr_end")
      .eq("label", category)
      .single();
    const start = (cat as { varenr_start?: number } | null)?.varenr_start ?? 9000;
    const end   = (cat as { varenr_end?: number | null } | null)?.varenr_end ?? (start + 999);
    const catId = (cat as { id?: string } | null)?.id ?? null;

    // Collect subcategory ranges that must be reserved and left empty for this category
    const blocked: Array<{ s: number; e: number }> = [];
    if (catId) {
      const { data: subcats } = await sb
        .from("gp_categories")
        .select("varenr_start, varenr_end")
        .eq("parent_id", catId);
      for (const sub of subcats ?? []) {
        const ss = (sub as { varenr_start?: number }).varenr_start;
        const se = (sub as { varenr_end?: number | null }).varenr_end;
        if (ss != null && se != null) blocked.push({ s: ss, e: se });
      }
    }

    // Build set of already-used GPV numbers within this range (across all categories)
    const { data: existing } = await sb.from("gp_products").select("varenr").like("varenr", "GPV-%");
    const usedNums = new Set<number>();
    for (const row of existing ?? []) {
      const num = parseInt((row.varenr as string).replace("GPV-", ""));
      if (!isNaN(num) && num >= start && num <= end) usedNums.add(num);
    }

    // First-fit: find the lowest free number that is not inside any subcategory range
    let assigned: number | null = null;
    for (let n = start; n <= end; n++) {
      if (blocked.some(b => n >= b.s && n <= b.e)) continue;
      if (usedNums.has(n)) continue;
      assigned = n;
      break;
    }
    if (assigned === null) {
      return NextResponse.json({ error: `Kategorien er full (GPV-${start} til GPV-${end})` }, { status: 409 });
    }
    varenr = `GPV-${assigned}`;
  }

  const { data, error } = await sb
    .from("gp_products")
    .insert({ varenr: varenr.trim(), name: name.trim(), category, unit: unit?.trim() || null, description: description?.trim() || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
