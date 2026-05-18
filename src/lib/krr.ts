/**
 * KRR — Kontakt- og reservasjonsregisteret (Digdir)
 *
 * Looks up digital contact info and reservation status for Norwegian persons.
 * If a person has reserved (reservasjon = true) → must send physical letter instead.
 *
 * Required env vars (via maskinporten.ts):
 *   MASKINPORTEN_CLIENT_ID, MASKINPORTEN_PRIVATE_KEY
 * Scope needed: krr:global/kontaktinformasjon.read
 */

import { getMaskinportenToken } from "./maskinporten";

const KRR_ENV = {
  production: "https://kontaktregisteret.no/rest/v2/personer",
  test:       "https://test.kontaktregisteret.no/rest/v2/personer",
};

export interface KRRPerson {
  personidentifikator: string;
  reservasjon: boolean;        // true = reserved against digital communication
  status: string;              // "AKTIV" | "SLETTET" | "IKKE_REGISTRERT"
  kontaktinformasjon?: {
    epostadresse?: string;
    epostadresse_oppdatert?: string;
    mobiltelefonnummer?: string;
    mobiltelefonnummer_oppdatert?: string;
  };
  digital_postkasse?: {
    postkasseadresse: string;
    leverandoeridentifikator: string;
  } | null;
  sikkerdigitalpost?: unknown;
}

export interface KRRResult {
  person: KRRPerson | null;
  canSendDigitally: boolean;
  email: string | null;
  mobile: string | null;
}

export async function krrLookup(personnummere: string[]): Promise<Map<string, KRRResult>> {
  if (personnummere.length === 0) return new Map();

  const env      = (process.env.MASKINPORTEN_ENV ?? "production") as "production" | "test";
  const endpoint = KRR_ENV[env];
  const token    = await getMaskinportenToken("krr:global/kontaktinformasjon.read");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept:         "application/json",
    },
    body: JSON.stringify({ personidentifikatorer: personnummere }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`KRR error ${res.status}: ${text}`);
  }

  const data = await res.json() as { personer: KRRPerson[] };
  const result = new Map<string, KRRResult>();

  for (const person of data.personer ?? []) {
    const canSendDigitally =
      !person.reservasjon && person.status === "AKTIV";
    result.set(person.personidentifikator, {
      person,
      canSendDigitally,
      email:  person.kontaktinformasjon?.epostadresse ?? null,
      mobile: person.kontaktinformasjon?.mobiltelefonnummer ?? null,
    });
  }

  // Persons not in response = not registered in KRR → cannot send digitally
  for (const pnr of personnummere) {
    if (!result.has(pnr)) {
      result.set(pnr, { person: null, canSendDigitally: false, email: null, mobile: null });
    }
  }

  return result;
}

/** Single person convenience wrapper */
export async function krrLookupOne(personnummer: string): Promise<KRRResult> {
  const map = await krrLookup([personnummer]);
  return map.get(personnummer) ?? { person: null, canSendDigitally: false, email: null, mobile: null };
}
