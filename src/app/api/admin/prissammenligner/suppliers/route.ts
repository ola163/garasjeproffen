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

// GET /api/admin/prissammenligner/suppliers
// Returns all distinct supplier names that have data in supplier_prices,
// plus any explicitly registered suppliers from the suppliers table.
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = getSupabase();

  // Fetch from both sources in parallel
  const [priceRes, regRes] = await Promise.all([
    sb.from("supplier_prices").select("supplier").limit(1000),
    sb.from("suppliers").select("name").order("name"),
  ]);

  const fromPrices = new Set<string>((priceRes.data ?? []).map((r: { supplier: string }) => r.supplier).filter(Boolean));
  const fromRegistry = (regRes.data ?? []).map((r: { name: string }) => r.name).filter(Boolean);

  // Union: registered suppliers first (ordered), then any extra from price data
  const all = [...fromRegistry];
  for (const s of fromPrices) {
    if (!all.includes(s)) all.push(s);
  }

  return NextResponse.json({ suppliers: all });
}
