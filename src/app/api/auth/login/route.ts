import { NextResponse } from "next/server";
import { buildAuthUrl, getRedirectUri, randomString } from "@/lib/oidc";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const state = randomString();
  const nonce = randomString();
  const redirectUri = getRedirectUri(origin);
  const authUrl = buildAuthUrl(state, nonce, redirectUri);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("oidc_state", state, { httpOnly: true, sameSite: "lax", maxAge: 300, secure: process.env.NODE_ENV === "production" });
  response.cookies.set("oidc_nonce", nonce, { httpOnly: true, sameSite: "lax", maxAge: 300, secure: process.env.NODE_ENV === "production" });
  return response;
}
