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

  const db = createClient(url, key);
  let linked = 0;

  // ── 1. Spread existing user_email to ALL rows from the same IP ────────────
  // If ANY row for an IP has an email, tag all anonymous rows from that IP too
  const { data: knownRows } = await db
    .from("visitor_logs")
    .select("ip, user_email")
    .not("user_email", "is", null);

  const ipEmailMap = new Map<string, string>();
  for (const row of knownRows ?? []) {
    if (!ipEmailMap.has(row.ip)) ipEmailMap.set(row.ip, row.user_email);
  }

  for (const [ip, email] of ipEmailMap) {
    const { count } = await db
      .from("visitor_logs")
      .update({ user_email: email })
      .eq("ip", ip)
      .is("user_email", null)
      .select("id", { count: "exact", head: true });
    linked += count ?? 0;
  }

  // ── 2. Cross-reference user_profiles.consent_ip ───────────────────────────
  const { data: profiles } = await db
    .from("user_profiles")
    .select("email, consent_ip")
    .not("consent_ip", "is", null)
    .not("email", "is", null);

  for (const p of profiles ?? []) {
    const { count } = await db
      .from("visitor_logs")
      .update({ user_email: p.email })
      .eq("ip", p.consent_ip)
      .is("user_email", null)
      .select("id", { count: "exact", head: true });
    linked += count ?? 0;
  }

  // ── 3. Time-window match: visitor_logs near a quote submission ────────────
  // For each quote, find visitor_log rows from any IP within 60 min before
  // submission where user_email is still null — link them to customer_email
  const { data: quotes } = await db
    .from("quotes")
    .select("customer_email, created_at")
    .not("customer_email", "is", null)
    .order("created_at", { ascending: false })
    .limit(500);

  // Build a list of distinct (email, time-window) pairs
  const emailWindows = (quotes ?? []).map((q: { customer_email: string; created_at: string }) => ({
    email: q.customer_email.toLowerCase(),
    from: new Date(new Date(q.created_at).getTime() - 60 * 60 * 1000).toISOString(),
    to:   q.created_at,
  }));

  for (const w of emailWindows) {
    // Find IPs that visited within this window (could be multiple visitors, so
    // we only link if there's exactly 1 distinct IP to avoid false positives)
    const { data: candidates } = await db
      .from("visitor_logs")
      .select("ip")
      .gte("visited_at", w.from)
      .lte("visited_at", w.to)
      .is("user_email", null);

    const distinctIps = [...new Set((candidates ?? []).map((r: { ip: string }) => r.ip))];
    if (distinctIps.length !== 1) continue; // skip if ambiguous

    const { count } = await db
      .from("visitor_logs")
      .update({ user_email: w.email })
      .eq("ip", distinctIps[0])
      .is("user_email", null)
      .select("id", { count: "exact", head: true });
    linked += count ?? 0;
  }

  // ── 4. Final spread pass ─────────────────────────────────────────────────
  // After steps 2+3 may have added more emails, spread again
  const { data: newKnown } = await db
    .from("visitor_logs")
    .select("ip, user_email")
    .not("user_email", "is", null);

  const ipEmailMap2 = new Map<string, string>();
  for (const row of newKnown ?? []) {
    if (!ipEmailMap2.has(row.ip)) ipEmailMap2.set(row.ip, row.user_email);
  }
  for (const [ip, email] of ipEmailMap2) {
    const { count } = await db
      .from("visitor_logs")
      .update({ user_email: email })
      .eq("ip", ip)
      .is("user_email", null)
      .select("id", { count: "exact", head: true });
    linked += count ?? 0;
  }

  return Response.json({ success: true, linked });
}
