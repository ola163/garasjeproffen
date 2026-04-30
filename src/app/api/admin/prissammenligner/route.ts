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

// GET /api/admin/prissammenligner?suppliers=Optimera,XLBygg
// Returns all price rows for the given suppliers (no row limit)
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = getSupabase();
  const { searchParams } = new URL(req.url);
  const suppliersParam = searchParams.get("suppliers") ?? "";
  const suppliers = suppliersParam.split(",").map(s => s.trim()).filter(Boolean);
  if (suppliers.length === 0) {
    return NextResponse.json({ data: [] });
  }

  const varenrsParam = searchParams.get("varenrs") ?? "";
  const varenrs = varenrsParam.split(",").map(v => v.trim()).filter(Boolean);

  // Fetch rows for the given suppliers, optionally filtered by varenr list
  const PAGE = 5000;
  const result: unknown[] = [];

  for (const supplier of suppliers) {
    let offset = 0;
    while (true) {
      let query = sb
        .from("supplier_prices")
        .select("varenr,varebenevnelse,enhet,nettopris,bruttopris,dimensjon,supplier")
        .eq("supplier", supplier)
        .order("varenr");

      if (varenrs.length > 0) {
        query = query.in("varenr", varenrs);
      }

      const { data, error } = await query.range(offset, offset + PAGE - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data?.length) break;
      result.push(...data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }

  return NextResponse.json({ data: result });
}
