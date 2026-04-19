import crypto from "crypto";

const ISSUER = process.env.SIGNICAT_ISSUER_URL!;
const CLIENT_ID = process.env.SIGNICAT_CLIENT_ID!;
const CLIENT_SECRET = process.env.SIGNICAT_CLIENT_SECRET!;
const ACR_VALUES = process.env.SIGNICAT_ACR_VALUES ?? "urn:signicat:oidc:method:nbid";

export function getRedirectUri(origin: string) {
  return `${origin}/api/auth/callback`;
}

export function buildAuthUrl(state: string, nonce: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "openid profile email",
    state,
    nonce,
    acr_values: ACR_VALUES,
  });
  return `${ISSUER}/authorize?${params.toString()}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<{ id_token: string; access_token: string }> {
  const res = await fetch(`${ISSUER}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }
  return res.json();
}

export function decodeIdToken(idToken: string): Record<string, unknown> {
  const payload = idToken.split(".")[1];
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

export function randomString(): string {
  return crypto.randomBytes(32).toString("hex");
}
