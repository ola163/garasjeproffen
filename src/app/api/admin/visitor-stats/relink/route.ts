import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return Response.json({ error: "DB not configured" }, { status: 503 });

  // Use `any` so Supabase's generic table types don't fight the update payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createClient(url, key) as any;
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
    const { data: r } = await db
      .from("visitor_logs")
      .update({ user_email: email })
      .eq("ip", ip)
      .is("user_email", null)
      .select("id");
    linked += (r as unknown[])?.length ?? 0;
  }

  // ── 2. Cross-reference user_profiles.consent_ip ───────────────────────────
  const { data: profiles } = await db
    .from("user_profiles")
    .select("email, consent_ip")
    .not("consent_ip", "is", null)
    .not("email", "is", null);

  for (const p of (profiles ?? []) as { email: string; consent_ip: string }[]) {
    const { data: r } = await db
      .from("visitor_logs")
      .update({ user_email: p.email })
      .eq("ip", p.consent_ip)
      .is("user_email", null)
      .select("id");
    linked += (r as unknown[])?.length ?? 0;
  }

  // ── 3. Time-window match: visitor near a quote submission ──────────────────
  // Only link when exactly 1 distinct IP visited in the 60 min before submission
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

    const distinctIps = [...new Set(((candidates ?? []) as { ip: string }[]).map((r) => r.ip))];
    if (distinctIps.length !== 1) continue;

    const { data: r } = await db
      .from("visitor_logs")
      .update({ user_email: q.customer_email.toLowerCase() })
      .eq("ip", distinctIps[0])
      .is("user_email", null)
      .select("id");
    linked += (r as unknown[])?.length ?? 0;
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
    const { data: r } = await db
      .from("visitor_logs")
      .update({ user_email: email })
      .eq("ip", ip)
      .is("user_email", null)
      .select("id");
    linked += (r as unknown[])?.length ?? 0;
  }

  return Response.json({ success: true, linked });
}
