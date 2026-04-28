import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { exchangeCode, decodeIdToken, getRedirectUri } from "@/lib/oidc";
import { sessionOptions, type CustomerSession } from "@/lib/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(new URL("/min-side?error=innlogging_avbrutt", url.origin));
  }

  const cookies = request.headers.get("cookie") ?? "";

  const savedState = cookies.split(";")
    .find((c) => c.trim().startsWith("oidc_state="))
    ?.split("=")[1]?.trim();

  const savedNonce = cookies.split(";")
    .find((c) => c.trim().startsWith("oidc_nonce="))
    ?.split("=")[1]?.trim();

  if (!code || !state || state !== savedState) {
    return NextResponse.redirect(new URL("/min-side?error=invalid_state", url.origin));
  }

  try {
    const redirectUri = getRedirectUri(url.origin);
    const tokens = await exchangeCode(code, redirectUri);
    const claims = decodeIdToken(tokens.id_token);

    if (savedNonce && claims.nonce !== savedNonce) {
      return NextResponse.redirect(new URL("/min-side?error=invalid_nonce", url.origin));
    }

    const response = NextResponse.redirect(new URL("/min-side", url.origin));
    const session = await getIronSession<CustomerSession>(request, response, sessionOptions);
    session.sub = claims.sub as string;
    session.name = (claims.name ?? `${claims.given_name ?? ""} ${claims.family_name ?? ""}`.trim()) as string;
    session.email = claims.email as string | undefined;
    session.isLoggedIn = true;
    await session.save();

    response.cookies.delete("oidc_state");
    response.cookies.delete("oidc_nonce");
    return response;
  } catch (err) {
    console.error("OIDC callback error:", err instanceof Error ? err.message : String(err));
    return NextResponse.redirect(new URL("/min-side?error=innlogging_feilet", url.origin));
  }
}
