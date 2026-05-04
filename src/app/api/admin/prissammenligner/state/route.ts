import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Requires this column on the quotes table:
// ALTER TABLE quotes ADD COLUMN IF NOT EXISTS comparison_state JSONB;

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

// GET /api/admin/prissammenligner/state?quoteId=xxx
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const quoteId = req.nextUrl.searchParams.get("quoteId");
  if (!quoteId) return NextResponse.json({ state: null });

  const sb = getSupabase();
  const { data, error } = await sb
    .from("quotes")
    .select("comparison_state")
    .eq("id", quoteId)
    .single();

  if (error) return NextResponse.json({ state: null });
  return NextResponse.json({ state: data?.comparison_state ?? null });
}

// PUT /api/admin/prissammenligner/state
// body: { quoteId, state }
export async function PUT(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { quoteId, state } = (await req.json()) as { quoteId: string; state: unknown };
  if (!quoteId) return NextResponse.json({ error: "quoteId required" }, { status: 400 });

  const sb = getSupabase();
  const { error } = await sb
    .from("quotes")
    .update({ comparison_state: state })
    .eq("id", quoteId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
