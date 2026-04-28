import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { path } = await req.json();

    // Skip tracking admin paths
    if (typeof path === "string" && path.startsWith("/admin")) {
      return new Response("ok");
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? null;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return new Response("ok");

    const db = createClient(url, key);
    await db.from("visitor_logs").insert({ ip, path: path ?? null, user_agent: userAgent });
  } catch {
    // never fail on tracking errors
  }
  return new Response("ok");
}
