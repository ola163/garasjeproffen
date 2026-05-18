/**
 * Altinn 3 Correspondence API — Digital nabovarsel
 *
 * DiBK Fellestjenester BYGG: nabovarsel sent as Altinn correspondence.
 * Recipients identified by Norwegian personal ID or org number (0192:<orgnr>).
 *
 * Required env vars:
 *   MASKINPORTEN_CLIENT_ID, MASKINPORTEN_PRIVATE_KEY   (via maskinporten.ts)
 *   ALTINN_RESOURCE_ID      — DiBK nabovarsel resource URN, e.g.
 *                             "urn:altinn:resource:dibk-nabovarsel" (confirm with DiBK)
 *   ALTINN_SENDER_ORG       — "0192:<org_number>" e.g. "0192:974760673"
 *   ALTINN_ENV              — "production" | "tt02" (test) — default: "production"
 */

import { getMaskinportenToken } from "./maskinporten";

const ALTINN_BASEURL = {
  production: "https://platform.altinn.no",
  tt02:       "https://platform.tt02.altinn.no",
};

export interface NabovarselRecipient {
  /** Norwegian personal ID (personnummer, 11 digits) */
  personnummer?: string;
  /** Norwegian org number with prefix: "0192:974760673" */
  orgnr?: string;
  /** Display name (for logging only, not sent to Altinn) */
  navn?: string;
}

export interface NabovarselPayload {
  /** Internal reference (ticket number or nabovarsel ID) */
  sendersReference: string;
  recipient: NabovarselRecipient;
  /** The property where the building measure takes place */
  eiendomAdresse: string;
  gnr: number | null;
  bnr: number | null;
  kommunenr: string | null;
  /** Description of the building measure */
  tiltaket: string;
  /** Applicant / builder name */
  sokerNavn: string;
  /** Deadline for submitting objections (14 days from sending) */
  merknadsfrist: Date;
  /** HTML content of the nabovarsel message body */
  messageHtml: string;
  /** Attachment URLs already uploaded to Altinn (see uploadAttachment) */
  attachmentRefs?: string[];
}

export interface AltinnSendResult {
  success: boolean;
  correspondenceId?: string;
  error?: string;
}

function altinnBase(): string {
  const env = (process.env.ALTINN_ENV ?? "production") as "production" | "tt02";
  return ALTINN_BASE_URL[env] ?? ALTINN_BASEURL.production;
}

// Workaround for TS const before use
const ALTINN_BASE_URL = ALTINN_BASEURL;

function recipientUrn(r: NabovarselRecipient): string {
  if (r.personnummer) return `urn:altinn:person:identifier-no:${r.personnummer}`;
  if (r.orgnr)        return r.orgnr.startsWith("0192:") ? r.orgnr : `0192:${r.orgnr}`;
  throw new Error("Recipient must have personnummer or orgnr");
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "long", year: "numeric" });
}

export async function sendNabovarselAltinn(
  payload: NabovarselPayload,
): Promise<AltinnSendResult> {
  const resourceId  = process.env.ALTINN_RESOURCE_ID;
  const senderOrg   = process.env.ALTINN_SENDER_ORG;
  if (!resourceId || !senderOrg) {
    return { success: false, error: "ALTINN_RESOURCE_ID or ALTINN_SENDER_ORG not configured" };
  }

  const token = await getMaskinportenToken(
    "altinn:serviceowner altinn:correspondence.write",
  );

  const fristStr = fmtDate(payload.merknadsfrist);
  const matrikkel = payload.gnr && payload.bnr
    ? `gnr. ${payload.gnr} bnr. ${payload.bnr}${payload.kommunenr ? ` i kommune ${payload.kommunenr}` : ""}`
    : payload.eiendomAdresse;

  const body = {
    resourceId,
    sender:           senderOrg,
    sendersReference: payload.sendersReference,
    recipients:       [recipientUrn(payload.recipient)],
    allowSystemDeleteAfter: null,
    dueDateTime: payload.merknadsfrist.toISOString(),
    content: {
      language:       "nb",
      messageTitle:   `Nabovarsel – ${payload.eiendomAdresse}`,
      messageSummary: `Du varsles som nabo til byggetiltak på ${payload.eiendomAdresse} (${matrikkel}). Merknadsfrist: ${fristStr}.`,
      messageBody:    payload.messageHtml,
    },
    notification: {
      sendReminder: true,
      email: {
        subject:     `Nabovarsel – ${payload.eiendomAdresse}`,
        body:        `Du har mottatt et nabovarsel i din Altinn-innboks. Merknadsfrist: ${fristStr}.`,
        contentType: "Plain",
      },
      sms: {
        body: `Nabovarsel mottatt i Altinn. Gjelder ${payload.eiendomAdresse}. Frist: ${fristStr}. Logg inn på altinn.no.`,
      },
      notificationChannel: "EmailPreferred",
    },
    attachments: (payload.attachmentRefs ?? []).map((ref, i) => ({
      dataLocationUrl: ref,
      dataType:        "application/pdf",
      name:            `Vedlegg ${i + 1}`,
      sendersReference: `att-${i + 1}`,
      isEncrypted:     false,
    })),
  };

  const res = await fetch(`${altinnBase()}/correspondence/api/v1/correspondence`, {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept:         "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text();
    return { success: false, error: `Altinn error ${res.status}: ${text}` };
  }

  const data = await res.json() as { correspondenceId?: string; id?: string };
  return {
    success: true,
    correspondenceId: data.correspondenceId ?? data.id,
  };
}

/**
 * Look up correspondence status (to check if recipient has read/confirmed).
 * Useful for polling after sending.
 */
export async function getCorrespondenceStatus(correspondenceId: string): Promise<string | null> {
  const token = await getMaskinportenToken("altinn:serviceowner altinn:correspondence.read");
  const res = await fetch(
    `${altinnBase()}/correspondence/api/v1/correspondence/${correspondenceId}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) return null;
  const data = await res.json() as { status?: string };
  return data.status ?? null;
}
