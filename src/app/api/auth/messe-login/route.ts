import { NextResponse } from "next/server";

const MESSE_EMAIL = "messe@garasjeproffen.no";
const MESSE_PASSWORD = "Jærdagen2026";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || body.password !== MESSE_PASSWORD) {
    return NextResponse.json({ error: "Feil passord." }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  const maxAge = 60 * 60 * 12; // 12 hours
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge,
    path: "/",
  };

  res.cookies.set("gp-user", MESSE_EMAIL, cookieOpts);
  res.cookies.set("gp-admin", "0", cookieOpts);
  return res;
}
