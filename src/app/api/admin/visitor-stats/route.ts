import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ADMIN_EMAILS } from "@/lib/session";

type LogRow = {
  ip: string;
  path: string | null;
  user_agent: string | null;
  user_email: string | null;
  visited_at: string;
  referrer?: string | null;
  country_code?: string | null;
  city?: string | null;
};

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response("DB not configured", { status: 503 });

  const db = createClient(url, key);

  // Use select("*") so it works before and after the column migration
  const { data, error } = await db
    .from("visitor_logs")
    .select("*")
    .order("visited_at", { ascending: false })
    .limit(5000);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (data ?? []) as LogRow[];

  // Unique IPs per period
  const now = new Date();
  const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const uniqueDay   = new Set<string>();
  const uniqueWeek  = new Set<string>();
  const uniqueMonth = new Set<string>();
  for (const row of rows) {
    if (row.user_email && ADMIN_EMAILS.includes(row.user_email)) continue;
    const t = new Date(row.visited_at);
    if (t >= startOfDay)   uniqueDay.add(row.ip);
    if (t >= startOfWeek)  uniqueWeek.add(row.ip);
    if (t >= startOfMonth) uniqueMonth.add(row.ip);
  }

  // Aggregate unique IPs (skip rows from admin emails)
  const ipMap = new Map<string, { count: number; firstSeen: string; lastSeen: string; paths: Set<string>; emails: Set<string>; allIps: Set<string> }>();
  for (const row of rows) {
    if (row.user_email && ADMIN_EMAILS.includes(row.user_email)) continue;
    const entry = ipMap.get(row.ip);
    if (!entry) {
      ipMap.set(row.ip, {
        count: 1,
        firstSeen: row.visited_at,
        lastSeen: row.visited_at,
        paths: new Set(row.path ? [row.path] : []),
        emails: new Set(row.user_email ? [row.user_email] : []),
        allIps: new Set([row.ip]),
      });
    } else {
      entry.count++;
      if (row.visited_at < entry.firstSeen) entry.firstSeen = row.visited_at;
      if (row.visited_at > entry.lastSeen) entry.lastSeen = row.visited_at;
      if (row.path) entry.paths.add(row.path);
      if (row.user_email) entry.emails.add(row.user_email);
    }
  }

  // Merge IPs that share the same logged-in email — keep all IPs listed on the canonical entry
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
      const can = ipMap.get(canonical)!;
      can.count += entry.count;
      if (entry.firstSeen < can.firstSeen) can.firstSeen = entry.firstSeen;
      if (entry.lastSeen > can.lastSeen) can.lastSeen = entry.lastSeen;
      for (const p of entry.paths) can.paths.add(p);
      for (const e of entry.emails) can.emails.add(e);
      for (const i of entry.allIps) can.allIps.add(i);
      ipMap.delete(ip);
    }
  }

  // Build geo map from stored Vercel headers (rows are desc, so first hit = most recent)
  const storedGeoMap = new Map<string, { city: string; region: string; country: string; countryCode: string; hosting: boolean }>();
  for (const row of rows) {
    if (row.country_code && !storedGeoMap.has(row.ip)) {
      storedGeoMap.set(row.ip, {
        city: row.city ?? "",
        region: "",
        country: row.country_code,
        countryCode: row.country_code,
        hosting: false,
      });
    }
  }

  // Batch geo-lookup via ip-api.com only for IPs without stored geo
  const allIps = Array.from(ipMap.keys());
  const geoMap = new Map<string, { city: string; region: string; country: string; countryCode: string; hosting: boolean }>();
  const privateRanges = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|unknown)/;
  const publicIps = allIps.filter((ip) => !privateRanges.test(ip) && !storedGeoMap.has(ip));

  for (let i = 0; i < publicIps.length; i += 100) {
    const chunk = publicIps.slice(i, i + 100);
    try {
      const res = await fetch(
        "http://ip-api.com/batch?fields=query,status,country,countryCode,regionName,city,hosting",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunk.map((q) => ({ query: q }))),
        }
      );
      if (res.ok) {
        const results: { query: string; status: string; country: string; countryCode: string; regionName: string; city: string; hosting: boolean }[] =
          await res.json();
        for (const r of results) {
          if (r.status === "success") {
            geoMap.set(r.query, { city: r.city, region: r.regionName, country: r.country, countryCode: r.countryCode, hosting: r.hosting ?? false });
          }
        }
      }
    } catch {
      // geo lookup is best-effort
    }
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
        allIps: Array.from(v.allIps),
        geo,
        countryCode: geo?.countryCode ?? null,
        hosting: geo?.hosting ?? false,
      };
    })
    .filter((e) => !e.hosting)
    .sort((a, b) => b.count - a.count);

  // Top pages
  const pageMap = new Map<string, number>();
  for (const row of rows) {
    if (row.path) pageMap.set(row.path, (pageMap.get(row.path) ?? 0) + 1);
  }
  const topPages = Array.from(pageMap.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Top referrers
  const referrerMap = new Map<string, number>();
  for (const row of rows) {
    if (row.referrer) referrerMap.set(row.referrer, (referrerMap.get(row.referrer) ?? 0) + 1);
  }
  const topReferrers = Array.from(referrerMap.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return Response.json({
    totalVisits: rows.length,
    uniqueIpCount: uniqueIps.length,
    uniqueIpDay:   uniqueDay.size,
    uniqueIpWeek:  uniqueWeek.size,
    uniqueIpMonth: uniqueMonth.size,
    uniqueIps,
    topPages,
    topReferrers,
  });
}
