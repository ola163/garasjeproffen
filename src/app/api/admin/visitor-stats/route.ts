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
    .select("ip, path, user_agent, visited_at")
    .order("visited_at", { ascending: false })
    .limit(5000);

  if (error) return new Response(error.message, { status: 500 });

  const rows = data ?? [];

  // Aggregate unique IPs
  const ipMap = new Map<string, { count: number; firstSeen: string; lastSeen: string; paths: Set<string> }>();
  for (const row of rows) {
    const entry = ipMap.get(row.ip);
    if (!entry) {
      ipMap.set(row.ip, {
        count: 1,
        firstSeen: row.visited_at,
        lastSeen: row.visited_at,
        paths: new Set(row.path ? [row.path] : []),
      });
    } else {
      entry.count++;
      if (row.visited_at < entry.firstSeen) entry.firstSeen = row.visited_at;
      if (row.visited_at > entry.lastSeen) entry.lastSeen = row.visited_at;
      if (row.path) entry.paths.add(row.path);
    }
  }

  const uniqueIps = Array.from(ipMap.entries())
    .map(([ip, v]) => ({
      ip,
      count: v.count,
      firstSeen: v.firstSeen,
      lastSeen: v.lastSeen,
      paths: Array.from(v.paths).slice(0, 10),
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
    uniqueIps,
    topPages,
  });
}
