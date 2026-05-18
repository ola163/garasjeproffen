/**
 * Maskinporten machine-to-machine authentication (RFC 7523 JWT bearer grant).
 *
 * Required env vars:
 *   MASKINPORTEN_CLIENT_ID    — client_id from Digdir selvbetjening
 *   MASKINPORTEN_PRIVATE_KEY  — RSA private key PEM (newlines as \n in env)
 *   MASKINPORTEN_KEY_ID       — kid matching the JWK registered in Digdir (optional)
 *   MASKINPORTEN_ENV          — "production" | "test" (default: "production")
 */

import { createSign, randomUUID } from "crypto";

const ENDPOINTS = {
  production: "https://maskinporten.no/token",
  test:       "https://test.maskinporten.no/token",
};

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function buildJwt(scopes: string): string {
  const clientId  = process.env.MASKINPORTEN_CLIENT_ID;
  const privateKey = process.env.MASKINPORTEN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const kid       = process.env.MASKINPORTEN_KEY_ID;
  const env       = (process.env.MASKINPORTEN_ENV ?? "production") as "production" | "test";

  if (!clientId || !privateKey) {
    throw new Error("MASKINPORTEN_CLIENT_ID and MASKINPORTEN_PRIVATE_KEY must be set");
  }

  const now = Math.floor(Date.now() / 1000);
  const aud = env === "test" ? "https://test.maskinporten.no/" : "https://maskinporten.no/";

  const header  = JSON.stringify({ alg: "RS256", ...(kid ? { kid } : {}) });
  const payload = JSON.stringify({
    aud,
    iss:   clientId,
    scope: scopes,
    iat:   now,
    exp:   now + 120,
    jti:   randomUUID(),
  });

  const signingInput = `${base64url(header)}.${base64url(payload)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  const signature = base64url(signer.sign(privateKey));

  return `${signingInput}.${signature}`;
}

// Simple in-process token cache (per-scope, expires 30s before actual expiry)
const cache = new Map<string, { token: string; expiresAt: number }>();

export async function getMaskinportenToken(scopes: string): Promise<string> {
  const cached = cache.get(scopes);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const env      = (process.env.MASKINPORTEN_ENV ?? "production") as "production" | "test";
  const endpoint = ENDPOINTS[env];
  const jwt      = buildJwt(scopes);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Maskinporten token error ${res.status}: ${text}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  const expiresAt = Date.now() + (data.expires_in - 30) * 1000;
  cache.set(scopes, { token: data.access_token, expiresAt });
  return data.access_token;
}
