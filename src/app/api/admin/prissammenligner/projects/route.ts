import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { OfferSection, LineItem } from "@/types/quote-admin";

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

function extractLineItems(sections: OfferSection[]): LineItem[] {
  return sections.flatMap(s => s.line_items ?? []);
}

// GET /api/admin/prissammenligner/projects
export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = getSupabase();
  const { data, error } = await sb
    .from("quotes")
    .select("id, ticket_number, customer_name, status, created_at, offer_sections, offer_line_items")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const projects = (data ?? []).map(q => {
    const sections: OfferSection[] = Array.isArray(q.offer_sections) ? q.offer_sections : [];
    const flat: LineItem[] = sections.length > 0
      ? extractLineItems(sections)
      : (Array.isArray(q.offer_line_items) ? q.offer_line_items : []);

    const withVarenr = flat.filter(i => i.varenr?.trim());
    return {
      id: q.id,
      ticket_number: q.ticket_number,
      customer_name: q.customer_name,
      status: q.status,
      created_at: q.created_at,
      varenr_count: withVarenr.length,
      line_items: withVarenr.map(i => ({
        varenr: i.varenr!.trim(),
        description: i.description,
        quantity: i.quantity ?? 1,
        enhet: i.enhet ?? undefined,
        dimensjon: i.dimensjon ?? undefined,
        amount: i.amount ?? undefined,
      })),
    };
  });

  return NextResponse.json({ data: projects });
}
