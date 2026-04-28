import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Response("DB not configured", { status: 503 });

  const db = createClient(url, key);

  const { data, error } = await db
    .from("visitor_logs")
    .select("ip, path, user_agent, user_email, visited_at")
    .order("visited_at", { ascending: false })
    .limit(5000);

  if (error) return new Response(error.message, { status: 500 });

  const rows = data ?? [];

  // Unique IPs per period
  const now = new Date();
  const startOfDay   = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const uniqueDay   = new Set<string>();
  const uniqueWeek  = new Set<string>();
  const uniqueMonth = new Set<string>();
  for (const row of rows) {
    const t = new Date(row.visited_at);
    if (t >= startOfDay)   uniqueDay.add(row.ip);
    if (t >= startOfWeek)  uniqueWeek.add(row.ip);
    if (t >= startOfMonth) uniqueMonth.add(row.ip);
  }

  // Aggregate unique IPs
  const ipMap = new Map<string, { count: number; firstSeen: string; lastSeen: string; paths: Set<string>; emails: Set<string> }>();
  for (const row of rows) {
    const entry = ipMap.get(row.ip);
    if (!entry) {
      ipMap.set(row.ip, {
        count: 1,
        firstSeen: row.visited_at,
        lastSeen: row.visited_at,
        paths: new Set(row.path ? [row.path] : []),
        emails: new Set(row.user_email ? [row.user_email] : []),
      });
    } else {
      entry.count++;
      if (row.visited_at < entry.firstSeen) entry.firstSeen = row.visited_at;
      if (row.visited_at > entry.lastSeen) entry.lastSeen = row.visited_at;
      if (row.path) entry.paths.add(row.path);
      if (row.user_email) entry.emails.add(row.user_email);
    }
  }

  // Batch geo-lookup via ip-api.com (free, up to 100 IPs per request)
  const allIps = Array.from(ipMap.keys());
  const geoMap = new Map<string, { city: string; region: string; country: string; countryCode: string }>();
  const privateRanges = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|unknown)/;
  const publicIps = allIps.filter((ip) => !privateRanges.test(ip));

  for (let i = 0; i < publicIps.length; i += 100) {
    const chunk = publicIps.slice(i, i + 100);
    try {
      const res = await fetch(
        "http://ip-api.com/batch?lang=no&fields=query,status,country,countryCode,regionName,city",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(chunk.map((q) => ({ query: q }))),
        }
      );
      if (res.ok) {
        const results: { query: string; status: string; country: string; countryCode: string; regionName: string; city: string }[] =
          await res.json();
        for (const r of results) {
          if (r.status === "success") {
            geoMap.set(r.query, { city: r.city, region: r.regionName, country: r.country, countryCode: r.countryCode });
          }
        }
      }
    } catch {
      // geo lookup is best-effort
    }
  }

  const uniqueIps = Array.from(ipMap.entries())
    .map(([ip, v]) => ({
      ip,
      count: v.count,
      firstSeen: v.firstSeen,
      lastSeen: v.lastSeen,
      paths: Array.from(v.paths).slice(0, 10),
      emails: Array.from(v.emails),
      geo: geoMap.get(ip) ?? null,
      countryCode: geoMap.get(ip)?.countryCode ?? null,
    }))
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

  return Response.json({
    totalVisits: rows.length,
    uniqueIpCount: uniqueIps.length,
    uniqueIpDay:   uniqueDay.size,
    uniqueIpWeek:  uniqueWeek.size,
    uniqueIpMonth: uniqueMonth.size,
    uniqueIps,
    topPages,
  });
}
