import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/min-side", request.url));
  res.cookies.delete("gp-user");
  res.cookies.delete("gp-admin");
  return res;
}
