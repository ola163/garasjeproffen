import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const res = NextResponse.redirect(`${origin}/min-side`);
  res.cookies.set("gp-user", "", { maxAge: 0, path: "/" });
  res.cookies.set("gp-admin", "", { maxAge: 0, path: "/" });
  return res;
}
