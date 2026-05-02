import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

async function updateAndCount(
  db: ReturnType<typeof createClient>,
  ip: string,
  email: string
): Promise<number> {
  const { data } = await db
    .from("visitor_logs")
    .update({ user_email: email })
    .eq("ip", ip)
    .is("user_email", null)
    .select("id");
  return data?.length ?? 0;
}

export async function POST() {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "DB not configured" }, { status: 503 });

  const db = createClient(url, key);
  let linked = 0;

  // ── 1. Spread existing user_email to all rows with the same IP ────────────
  const { data: knownRows } = await db
    .from("visitor_logs")
    .select("ip, user_email")
    .not("user_email", "is", null);

  const ipEmailMap = new Map<string, string>();
  for (const row of (knownRows ?? []) as { ip: string; user_email: string }[]) {
    if (!ipEmailMap.has(row.ip)) ipEmailMap.set(row.ip, row.user_email);
  }
  for (const [ip, email] of ipEmailMap) {
    linked += await updateAndCount(db, ip, email);
  }

  // ── 2. Cross-reference user_profiles.consent_ip ───────────────────────────
  const { data: profiles } = await db
    .from("user_profiles")
    .select("email, consent_ip")
    .not("consent_ip", "is", null)
    .not("email", "is", null);

  for (const p of (profiles ?? []) as { email: string; consent_ip: string }[]) {
    linked += await updateAndCount(db, p.consent_ip, p.email);
  }

  // ── 3. Time-window match: visitor near a quote submission ──────────────────
  // For each quote, find visitor_log rows in the 60 min before submission.
  // Only link if exactly 1 distinct IP visited in that window (avoid ambiguity).
  const { data: quotes } = await db
    .from("quotes")
    .select("customer_email, created_at")
    .not("customer_email", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  for (const q of (quotes ?? []) as { customer_email: string; created_at: string }[]) {
    const windowStart = new Date(new Date(q.created_at).getTime() - 60 * 60 * 1000).toISOString();
    const { data: candidates } = await db
      .from("visitor_logs")
      .select("ip")
      .gte("visited_at", windowStart)
      .lte("visited_at", q.created_at)
      .is("user_email", null);

    const distinctIps = [...new Set((candidates ?? []).map((r: { ip: string }) => r.ip))];
    if (distinctIps.length !== 1) continue;

    linked += await updateAndCount(db, distinctIps[0], q.customer_email.toLowerCase());
  }

  // ── 4. Final spread pass after steps 2+3 added new emails ─────────────────
  const { data: newKnown } = await db
    .from("visitor_logs")
    .select("ip, user_email")
    .not("user_email", "is", null);

  const ipEmailMap2 = new Map<string, string>();
  for (const row of (newKnown ?? []) as { ip: string; user_email: string }[]) {
    if (!ipEmailMap2.has(row.ip)) ipEmailMap2.set(row.ip, row.user_email);
  }
  for (const [ip, email] of ipEmailMap2) {
    linked += await updateAndCount(db, ip, email);
  }

  return Response.json({ success: true, linked });
}
