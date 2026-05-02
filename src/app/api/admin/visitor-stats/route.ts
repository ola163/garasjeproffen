import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ADMIN_EMAILS } from "@/lib/session";

type LogRow = {
  ip: string;
  path: string | null;
  user_agent: string | null;
  user_email?: string | null;
  visited_at: string;
  referrer?: string | null;
  country_code?: string | null;
  city?: string | null;
};

type QuoteRow = { customer_email: string; customer_name: string; created_at: string };
type ProfileRow = { email: string; consent_ip: string };

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response("DB not configured", { status: 503 });

  const db = createClient(url, key);

  const [logsResult, profilesResult, quotesResult] = await Promise.all([
    db.from("visitor_logs").select("*").order("visited_at", { ascending: false }).limit(5000),
    db.from("user_profiles").select("email, consent_ip").not("consent_ip", "is", null),
    db.from("quotes").select("customer_email, customer_name, created_at").not("customer_email", "is", null),
  ]);

  if (logsResult.error) return new Response(logsResult.error.message, { status: 500 });

  const rows = (logsResult.data ?? []) as LogRow[];

  // ── Source 1: user_profiles.consent_ip ─────────────────────────────────────
  const consentIpToEmail = new Map<string, string>();
  for (const p of (profilesResult.data ?? []) as ProfileRow[]) {
    if (p.consent_ip && p.email) consentIpToEmail.set(p.consent_ip, p.email);
  }

  // ── Source 2: time-window match against quote submissions ──────────────────
  // For each quote, find IPs that were active in the 90 min before submission.
  // If exactly 1 distinct IP → that IP belongs to this customer.
  const ipToCustomer = new Map<string, { email: string; name: string }>();

  const quotes = (quotesResult.data ?? []) as QuoteRow[];
  // Sort ascending so later quotes can overwrite with more recent data
  quotes.sort((a, b) => a.created_at.localeCompare(b.created_at));

  for (const q of quotes) {
    const quoteMs = new Date(q.created_at).getTime();
    const windowStart = quoteMs - 90 * 60 * 1000;

    const ipsInWindow = new Set<string>();
    for (const row of rows) {
      const t = new Date(row.visited_at).getTime();
      if (t >= windowStart && t <= quoteMs) ipsInWindow.add(row.ip);
    }
    if (ipsInWindow.size === 1) {
      const ip = [...ipsInWindow][0];
      ipToCustomer.set(ip, {
        email: q.customer_email.toLowerCase(),
        name: q.customer_name,
      });
    }
  }

  // ── Unique IPs per period (skip admin rows) ────────────────────────────────
  const now = new Date();
  const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const uniqueDay = new Set<string>();
  const uniqueWeek = new Set<string>();
  const uniqueMonth = new Set<string>();
  for (const row of rows) {
    const email = row.user_email ?? consentIpToEmail.get(row.ip) ?? ipToCustomer.get(row.ip)?.email ?? null;
    if (email && ADMIN_EMAILS.includes(email)) continue;
    const t = new Date(row.visited_at);
    if (t >= startOfDay)   uniqueDay.add(row.ip);
    if (t >= startOfWeek)  uniqueWeek.add(row.ip);
    if (t >= startOfMonth) uniqueMonth.add(row.ip);
  }

  // ── Aggregate unique IPs ───────────────────────────────────────────────────
  const ipMap = new Map<string, {
    count: number; firstSeen: string; lastSeen: string;
    paths: Set<string>; emails: Set<string>; names: Set<string>; allIps: Set<string>;
  }>();

  for (const row of rows) {
    // Resolve identity from all three sources
    const logEmail   = row.user_email ?? null;
    const profEmail  = consentIpToEmail.get(row.ip) ?? null;
    const custInfo   = ipToCustomer.get(row.ip) ?? null;
    const resolvedEmail = logEmail ?? profEmail ?? custInfo?.email ?? null;
    const resolvedName  = custInfo?.name ?? null;

    if (resolvedEmail && ADMIN_EMAILS.includes(resolvedEmail)) continue;

    const entry = ipMap.get(row.ip);
    if (!entry) {
      ipMap.set(row.ip, {
        count: 1,
        firstSeen: row.visited_at,
        lastSeen: row.visited_at,
        paths: new Set(row.path ? [row.path] : []),
        emails: new Set(resolvedEmail ? [resolvedEmail] : []),
        names: new Set(resolvedName ? [resolvedName] : []),
        allIps: new Set([row.ip]),
      });
    } else {
      entry.count++;
      if (row.visited_at < entry.firstSeen) entry.firstSeen = row.visited_at;
      if (row.visited_at > entry.lastSeen)  entry.lastSeen  = row.visited_at;
      if (row.path)        entry.paths.add(row.path);
      if (resolvedEmail)   entry.emails.add(resolvedEmail);
      if (resolvedName)    entry.names.add(resolvedName);
    }
  }

  // ── Merge IPs sharing the same email ──────────────────────────────────────
  const emailToIps = new Map<string, Set<string>>();
  for (const [ip, entry] of ipMap.entries()) {
    for (const email of entry.emails) {
      if (!emailToIps.has(email)) emailToIps.set(email, new Set());
      emailToIps.get(email)!.add(ip);
    }
  }
  for (const [, ips] of emailToIps.entries()) {
    const ipList = Array.from(ips).filter((ip) => ipMap.has(ip));
    if (ipList.length <= 1) continue;
    const canonical = ipList.reduce((a, b) =>
      (ipMap.get(a)?.count ?? 0) >= (ipMap.get(b)?.count ?? 0) ? a : b
    );
    for (const ip of ipList) {
      if (ip === canonical) continue;
      const entry = ipMap.get(ip)!;
      const can   = ipMap.get(canonical)!;
      can.count += entry.count;
      if (entry.firstSeen < can.firstSeen) can.firstSeen = entry.firstSeen;
      if (entry.lastSeen  > can.lastSeen)  can.lastSeen  = entry.lastSeen;
      for (const p of entry.paths)  can.paths.add(p);
      for (const e of entry.emails) can.emails.add(e);
      for (const n of entry.names)  can.names.add(n);
      for (const i of entry.allIps) can.allIps.add(i);
      ipMap.delete(ip);
    }
  }

  // ── Geo lookup ────────────────────────────────────────────────────────────
  const storedGeoMap = new Map<string, { city: string; region: string; country: string; countryCode: string; hosting: boolean }>();
  for (const row of rows) {
    if (row.country_code && !storedGeoMap.has(row.ip)) {
      storedGeoMap.set(row.ip, { city: row.city ?? "", region: "", country: row.country_code, countryCode: row.country_code, hosting: false });
    }
  }

  const allIps = Array.from(ipMap.keys());
  const geoMap = new Map<string, { city: string; region: string; country: string; countryCode: string; hosting: boolean }>();
  const privateRanges = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|unknown)/;
  const publicIps = allIps.filter((ip) => !privateRanges.test(ip) && !storedGeoMap.has(ip));

  for (let i = 0; i < publicIps.length; i += 100) {
    const chunk = publicIps.slice(i, i + 100);
    try {
      const res = await fetch("http://ip-api.com/batch?fields=query,status,country,countryCode,regionName,city,hosting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk.map((q) => ({ query: q }))),
      });
      if (res.ok) {
        const results = await res.json() as { query: string; status: string; country: string; countryCode: string; regionName: string; city: string; hosting: boolean }[];
        for (const r of results) {
          if (r.status === "success") {
            geoMap.set(r.query, { city: r.city, region: r.regionName, country: r.country, countryCode: r.countryCode, hosting: r.hosting ?? false });
          }
        }
      }
    } catch { /* geo lookup is best-effort */ }
  }

  const uniqueIps = Array.from(ipMap.entries())
    .map(([ip, v]) => {
      const geo = storedGeoMap.get(ip) ?? geoMap.get(ip) ?? null;
      return {
        ip,
        count: v.count,
        firstSeen: v.firstSeen,
        lastSeen: v.lastSeen,
        paths: Array.from(v.paths).slice(0, 10),
        emails: Array.from(v.emails),
        names: Array.from(v.names),
        allIps: Array.from(v.allIps),
        geo,
        countryCode: geo?.countryCode ?? null,
        hosting: geo?.hosting ?? false,
      };
    })
    .filter((e) => !e.hosting)
    .sort((a, b) => b.count - a.count);

  // ── Top pages & referrers ─────────────────────────────────────────────────
  const pageMap = new Map<string, number>();
  const referrerMap = new Map<string, number>();
  for (const row of rows) {
    if (row.path) pageMap.set(row.path, (pageMap.get(row.path) ?? 0) + 1);
    if (row.referrer) referrerMap.set(row.referrer, (referrerMap.get(row.referrer) ?? 0) + 1);
  }

  return Response.json({
    totalVisits: rows.length,
    uniqueIpCount: uniqueIps.length,
    uniqueIpDay:   uniqueDay.size,
    uniqueIpWeek:  uniqueWeek.size,
    uniqueIpMonth: uniqueMonth.size,
    uniqueIps,
    topPages:     Array.from(pageMap.entries()).map(([path, count]) => ({ path, count })).sort((a, b) => b.count - a.count).slice(0, 20),
    topReferrers: Array.from(referrerMap.entries()).map(([domain, count]) => ({ domain, count })).sort((a, b) => b.count - a.count).slice(0, 20),
  });
}
