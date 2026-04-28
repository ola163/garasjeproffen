import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// In-memory rate limiter per Edge instance.
// Not shared across Vercel instances — use Upstash KV for distributed limiting.
const hits = new Map<string, { n: number; reset: number }>();

function allow(ip: string, prefix: string, limit: number, windowMs: number): boolean {
  const key = `${ip}|${prefix}`;
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.reset) {
    hits.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (entry.n >= limit) return false;
  entry.n++;
  return true;
}

const RATE_LIMITS: Array<{ prefix: string; limit: number; windowMs: number }> = [
  { prefix: "/api/auth/email-login",      limit: 5,  windowMs: 60_000 },
  { prefix: "/api/chat",                  limit: 20, windowMs: 60_000 },
  { prefix: "/api/kontakt",               limit: 5,  windowMs: 60_000 },
  { prefix: "/api/soknadshjelp",          limit: 5,  windowMs: 60_000 },
  { prefix: "/api/quote",                 limit: 10, windowMs: 60_000 },
  { prefix: "/api/address-suggest",       limit: 30, windowMs: 60_000 },
  { prefix: "/api/admin/parse-pdf",       limit: 10, windowMs: 60_000 },
  { prefix: "/api/admin/visitor-stats",   limit: 20, windowMs: 60_000 },
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  for (const rule of RATE_LIMITS) {
    if (pathname.startsWith(rule.prefix)) {
      if (!allow(ip, rule.prefix, rule.limit, rule.windowMs)) {
        return new NextResponse("For mange forespørsler. Prøv igjen om litt.", {
          status: 429,
          headers: { "Retry-After": "60" },
        });
      }
      break;
    }
  }

  if (pathname.startsWith("/admin")) {
    const isAdmin = request.cookies.get("gp-admin")?.value === "1";
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/auth/email-login",
    "/api/chat/:path*",
    "/api/kontakt",
    "/api/soknadshjelp",
    "/api/quote/:path*",
    "/api/address-suggest",
    "/api/admin/:path*",
    "/admin/:path*",
  ],
};
