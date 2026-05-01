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

export interface MatchItem {
  varenr: string;
  name: string;
  dimensjon?: string;
  enhet?: string;
  nettopris?: number;
}

export interface MatchResult {
  varenr: string;
  name: string;
  dimensjon?: string;
  enhet?: string;
  nettopris?: number;
  // "exact" = found in gp_product_supplier_links
  // "suggestion" = name/dim similarity from gp_products
  // "none" = no match found
  matchType: "exact" | "suggestion" | "none";
  gpId?: string;
  gpVarenr?: string;
  gpName?: string;
  suggestions?: { id: string; varenr: string; name: string }[];
}

function extractSearchTerm(name: string, dimensjon?: string): string {
  const combined = [name, dimensjon].filter(Boolean).join(" ");
  const dimMatch = combined.match(/\d+[x×X]\d+(?:[x×X]\d+)?/);
  if (dimMatch) return dimMatch[0].replace(/[×X]/g, "x");
  const words = name.split(/\s+/).filter(w => w.length > 3);
  return words.slice(0, 2).join(" ");
}

// POST /api/admin/katalog/match
// Body: { supplier: string; items: MatchItem[] }
// Returns: { results: MatchResult[] }
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supplier, items } = await req.json() as { supplier: string; items: MatchItem[] };
  if (!items?.length) return NextResponse.json({ results: [] });

  const sb = getSupabase();
  const varenrs = items.map(i => i.varenr);

  // 1. Exact matches via supplier links
  const { data: links } = await sb
    .from("gp_product_supplier_links")
    .select("supplier_varenr, gp_varenr")
    .eq("supplier", supplier)
    .in("supplier_varenr", varenrs);

  const linkMap = new Map<string, string>(); // supplier_varenr → gp_varenr
  for (const l of links ?? []) linkMap.set(l.supplier_varenr, l.gp_varenr);

  const gpVarenrsNeeded = [...new Set([...linkMap.values()])];
  const gpByVarenr = new Map<string, { id: string; varenr: string; name: string }>();

  if (gpVarenrsNeeded.length > 0) {
    const { data: gpRows } = await sb
      .from("gp_products")
      .select("id, varenr, name")
      .in("varenr", gpVarenrsNeeded);
    for (const row of gpRows ?? []) gpByVarenr.set(row.varenr, row);
  }

  // 2. Name/dim suggestions for unmatched items
  const unmatched = items.filter(i => !linkMap.has(i.varenr));

  const results: MatchResult[] = await Promise.all(
    items.map(async (item) => {
      const gpVarenr = linkMap.get(item.varenr);
      if (gpVarenr) {
        const gp = gpByVarenr.get(gpVarenr);
        return {
          ...item,
          matchType: "exact" as const,
          gpId: gp?.id,
          gpVarenr: gp?.varenr,
          gpName: gp?.name,
        };
      }

      // Name-based suggestion search
      const q = extractSearchTerm(item.name, item.dimensjon);
      if (!q) return { ...item, matchType: "none" as const };

      const { data: suggestions } = await sb
        .from("gp_products")
        .select("id, varenr, name")
        .or(`name.ilike.%${q}%`)
        .limit(5);

      if (!suggestions?.length) return { ...item, matchType: "none" as const };

      return {
        ...item,
        matchType: "suggestion" as const,
        suggestions: suggestions.map(s => ({ id: s.id, varenr: s.varenr, name: s.name })),
      };
    })
  );

  // Suppress unused var warning — unmatched is used conceptually but filtered above
  void unmatched;

  return NextResponse.json({ results });
}
