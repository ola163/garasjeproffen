import { createClient } from "@supabase/supabase-js";

type SecurityEvent = {
  type: "contact_honeypot" | "contact_spam" | "contact_validation" | "contact_ok" | "file_rejected" | "rate_limited";
  result: "ok" | "blocked";
  form?: string;
  reason?: string;
  ip?: string;
};

function anonymizeIp(ip: string): string {
  if (ip.includes(".")) return ip.replace(/\.\d+$/, ".0");
  if (ip.includes(":")) return ip.replace(/:[0-9a-fA-F]+$/, ":0");
  return ip;
}

export function logSecurityEvent(event: SecurityEvent): void {
  const entry = {
    logged_at: new Date().toISOString(),
    ...event,
    ip: event.ip ? anonymizeIp(event.ip) : undefined,
  };
  console.log("[security]", JSON.stringify(entry));

  // Persist to Supabase (fire-and-forget, non-fatal)
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (sbUrl && sbKey) {
    createClient(sbUrl, sbKey)
      .from("security_events")
      .insert(entry)
      .then(() => {})
      .catch((err: unknown) => console.error("[security] DB log failed:", err));
  }
}
