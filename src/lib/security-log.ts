type SecurityEvent = {
  type: "contact_honeypot" | "contact_spam" | "contact_validation" | "contact_ok" | "file_rejected" | "rate_limited";
  result: "ok" | "blocked";
  form?: string;
  reason?: string;
  ip?: string;
};

function anonymizeIp(ip: string): string {
  // Zero the last octet for IPv4, last group for IPv6
  if (ip.includes(".")) return ip.replace(/\.\d+$/, ".0");
  if (ip.includes(":")) return ip.replace(/:[0-9a-fA-F]+$/, ":0");
  return ip;
}

export function logSecurityEvent(event: SecurityEvent): void {
  const entry = {
    ts: new Date().toISOString(),
    ...event,
    ip: event.ip ? anonymizeIp(event.ip) : undefined,
  };
  console.log("[security]", JSON.stringify(entry));
}
