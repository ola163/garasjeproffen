import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { OfferSection } from "@/types/quote-admin";

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

// POST /api/admin/prissammenligner/apply
// Applies selected supplier prices to the quote's offer_sections line items (matched by varenr)
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { quoteId, supplierName, items } = await req.json() as {
    quoteId: string;
    supplierName: string;
    items: { varenr: string; unitPrice: number }[];
  };

  if (!quoteId || !items?.length) {
    return NextResponse.json({ error: "quoteId and items required" }, { status: 400 });
  }

  const sb = getSupabase();

  // Fetch current quote
  const { data: quote, error: fetchError } = await sb
    .from("quotes")
    .select("offer_sections")
    .eq("id", quoteId)
    .single();

  if (fetchError || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const priceMap = new Map(items.map(i => [i.varenr.trim().toLowerCase(), i.unitPrice]));

  const sections: OfferSection[] = Array.isArray(quote.offer_sections) ? quote.offer_sections : [];

  let updatedCount = 0;
  let missedCount = 0;

  const updatedSections: OfferSection[] = sections.map(section => ({
    ...section,
    line_items: section.line_items.map(item => {
      if (!item.varenr?.trim()) return item;
      const key = item.varenr.trim().toLowerCase();
      const price = priceMap.get(key);
      if (price !== undefined) {
        updatedCount++;
        return { ...item, amount: price };
      }
      missedCount++;
      return item;
    }),
  }));

  const { error: updateError } = await sb
    .from("quotes")
    .update({ offer_sections: updatedSections })
    .eq("id", quoteId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, supplierName, updatedCount, missedCount });
}
