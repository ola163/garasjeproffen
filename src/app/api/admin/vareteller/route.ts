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

const FILTER_STATUSES: Record<string, string[]> = {
  pagaende: ["in_review", "pending_approval", "offer_sent", "paid"],
  ferdigstilte: ["ferdigstilt"],
  alle: ["in_review", "pending_approval", "offer_sent", "paid", "ferdigstilt"],
};

export interface VaretellerProject {
  id: string;
  ticketNumber: string;
  customerName: string;
  status: string;
  quantity: number;
}

export interface VaretellerItem {
  key: string;
  varenr: string;
  description: string;
  enhet: string;
  totalQuantity: number;
  projectCount: number;
  projects: VaretellerProject[];
}

export interface VaretellerResponse {
  items: VaretellerItem[];
  totalProjects: number;
  statusCounts: Record<string, number>;
}

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "alle";
  const statuses = FILTER_STATUSES[filter] ?? FILTER_STATUSES.alle;

  const sb = getSupabase();

  const { data: quotes, error } = await sb
    .from("quotes")
    .select("id, ticket_number, customer_name, status, offer_sections")
    .in("status", statuses)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Count statuses
  const statusCounts: Record<string, number> = {};
  for (const q of quotes ?? []) {
    statusCounts[q.status] = (statusCounts[q.status] ?? 0) + 1;
  }

  // Aggregate line items by varenr (GP varenr preferred, else description)
  const itemMap = new Map<string, VaretellerItem>();

  for (const quote of quotes ?? []) {
    const sections = (quote.offer_sections ?? []) as OfferSection[];
    for (const section of sections) {
      for (const item of (section.line_items ?? []) as LineItem[]) {
        const qty = item.quantity ?? 1;
        if (qty <= 0) continue;

        // Key: prefer GP varenr, fall back to normalized description
        const varenr = item.varenr?.trim() ?? "";
        const key = varenr || item.description.trim().toLowerCase();
        if (!key) continue;

        if (!itemMap.has(key)) {
          itemMap.set(key, {
            key,
            varenr,
            description: item.description,
            enhet: item.enhet ?? "",
            totalQuantity: 0,
            projectCount: 0,
            projects: [],
          });
        }

        const entry = itemMap.get(key)!;
        entry.totalQuantity += qty;

        // Only add project once per quote per item key
        const alreadyHas = entry.projects.find(p => p.id === quote.id);
        if (alreadyHas) {
          alreadyHas.quantity += qty;
        } else {
          entry.projectCount += 1;
          entry.projects.push({
            id: quote.id,
            ticketNumber: quote.ticket_number,
            customerName: quote.customer_name,
            status: quote.status,
            quantity: qty,
          });
        }
      }
    }
  }

  const items = Array.from(itemMap.values());

  return NextResponse.json({
    items,
    totalProjects: (quotes ?? []).length,
    statusCounts,
  } satisfies VaretellerResponse);
}
