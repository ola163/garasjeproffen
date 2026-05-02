import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type CustomerSession } from "@/lib/session";

const BOT_UA = /bot|crawl|spider|slurp|vercel|lighthouse|prerender|headless|chrome-lighthouse|dataforseo|semrush|ahrefs|mj12|googlebot|bingbot|facebookexternalhit/i;

export async function POST(req: Request) {
  try {
    const { path, referrer } = await req.json();

    if (typeof path === "string" && path.startsWith("/admin")) {
      return new Response("ok");
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? null;

    if (userAgent && BOT_UA.test(userAgent)) return new Response("ok");

    const cookieStore = await cookies();
    if (cookieStore.get("gp-admin")?.value === "1") return new Response("ok");

    // Try gp-user cookie first (Supabase email-login users)
    let userEmail: string | null = cookieStore.get("gp-user")?.value ?? null;

    // Fallback: read iron-session for OIDC-logged-in users (Signicat)
    if (!userEmail) {
      try {
        const session = await getIronSession<CustomerSession>(cookieStore, sessionOptions);
        if (session.isLoggedIn && session.email) userEmail = session.email;
      } catch {
        // iron-session read failure is non-fatal
      }
    }

    const countryCode = req.headers.get("x-vercel-ip-country") ?? null;
    const rawCity = req.headers.get("x-vercel-ip-city");
    const city = rawCity ? decodeURIComponent(rawCity) : null;

    let referrerDomain: string | null = null;
    if (typeof referrer === "string" && referrer.startsWith("http")) {
      try { referrerDomain = new URL(referrer).hostname; } catch {}
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return new Response("ok");

    const db = createClient(url, key);
    await db.from("visitor_logs").insert({
      ip,
      path: path ?? null,
      user_agent: userAgent,
      user_email: userEmail,
      referrer: referrerDomain,
      country_code: countryCode,
      city,
    });
  } catch {
    // never fail on tracking errors
  }
  return new Response("ok");
}
