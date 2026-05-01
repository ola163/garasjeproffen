import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];
const ALL_SUPPLIERS = ["Optimera", "XLBygg", "Coop Obs Bygg", "Neumann"];

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

// GET /api/admin/supplier-prices/similar?q=48x98&exclude_supplier=Optimera&limit=5
// Searches all other suppliers for products with similar names.
// Returns { data: { [supplier]: row[] } }
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const excludeSupplier = searchParams.get("exclude_supplier") ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "5"), 20);

  if (!q) return NextResponse.json({ data: {} });

  const sb = getSupabase();
  const suppliers = ALL_SUPPLIERS.filter(s => s !== excludeSupplier);

  const results = await Promise.all(
    suppliers.map(async sup => {
      const { data } = await sb
        .from("supplier_prices")
        .select("varenr,varebenevnelse,dimensjon,enhet,nettopris,bruttopris,supplier")
        .eq("supplier", sup)
        .or(`varebenevnelse.ilike.%${q}%,dimensjon.ilike.%${q}%`)
        .limit(limit);
      return [sup, data ?? []] as const;
    })
  );

  return NextResponse.json({ data: Object.fromEntries(results) });
}
