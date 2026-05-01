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

// GET /api/admin/prissammenligner?suppliers=Optimera,XLBygg&varenrs=GPV-1001,GPV-1002,...
// Supports both native supplier varenrs and GPV-prefixed internal varenrs.
// GPV varenrs are translated to supplier varenrs via gp_product_supplier_links,
// and the returned rows use the GPV varenr as the key so the frontend can match.
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = getSupabase();
  const { searchParams } = new URL(req.url);
  const suppliersParam = searchParams.get("suppliers") ?? "";
  const suppliers = suppliersParam.split(",").map(s => s.trim()).filter(Boolean);
  if (suppliers.length === 0) return NextResponse.json({ data: [] });

  const varenrsParam = searchParams.get("varenrs") ?? "";
  const varenrs = varenrsParam.split(",").map(v => v.trim()).filter(Boolean);

  // Separate GP internal varenrs (GPV-*) from native supplier varenrs
  const gpVarenrs = varenrs.filter(v => v.startsWith("GPV-"));
  const nativeVarenrs = varenrs.filter(v => !v.startsWith("GPV-"));

  const PAGE = 5000;
  const result: unknown[] = [];

  for (const supplier of suppliers) {
    // Build a reverse map: supplier_varenr → gp_varenr for this supplier
    const reverseMap: Record<string, string> = {};
    let supplierNativeVarenrs: string[] = [...nativeVarenrs];

    if (gpVarenrs.length > 0) {
      const { data: links } = await sb
        .from("gp_product_supplier_links")
        .select("gp_varenr, supplier_varenr")
        .eq("supplier", supplier)
        .in("gp_varenr", gpVarenrs);

      for (const link of links ?? []) {
        reverseMap[link.supplier_varenr] = link.gp_varenr;
        supplierNativeVarenrs.push(link.supplier_varenr);
      }
    }

    let offset = 0;
    while (true) {
      let query = sb
        .from("supplier_prices")
        .select("varenr,varebenevnelse,enhet,nettopris,bruttopris,dimensjon,supplier")
        .eq("supplier", supplier)
        .order("varenr");

      if (supplierNativeVarenrs.length > 0) {
        query = query.in("varenr", supplierNativeVarenrs);
      } else if (varenrs.length > 0) {
        // All varenrs were GPV-prefixed but none had links for this supplier — skip
        break;
      }

      const { data, error } = await query.range(offset, offset + PAGE - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!data?.length) break;

      // Translate supplier varenrs back to GPV varenrs where applicable
      const translated = data.map(row => ({
        ...row,
        varenr: reverseMap[(row as { varenr: string }).varenr] ?? (row as { varenr: string }).varenr,
      }));
      result.push(...translated);

      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }

  return NextResponse.json({ data: result });
}
