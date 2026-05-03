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

// POST /api/admin/supplier-prices/check
// body: { supplier: string, varenrs: string[] }
// Returns: { existingVarenrs: string[] } — which of the given varenrs already exist in supplier_prices
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supplier, varenrs } = (await req.json()) as { supplier: string; varenrs: string[] };
  if (!supplier || !Array.isArray(varenrs) || varenrs.length === 0) {
    return NextResponse.json({ existingVarenrs: [] });
  }

  const sb = getSupabase();
  const { data } = await sb
    .from("supplier_prices")
    .select("varenr")
    .eq("supplier", supplier)
    .in("varenr", varenrs);

  return NextResponse.json({ existingVarenrs: (data ?? []).map((r: { varenr: string }) => r.varenr) });
}
