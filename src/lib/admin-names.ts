export const ADMIN_NAMES: Record<string, string> = {
  "ola@garasjeproffen.no": "Ola Undheim",
  "christian@garasjeproffen.no": "Christian Undheim",
};

export function adminName(email: string | null | undefined): string {
  if (!email) return "–";
  return ADMIN_NAMES[email.toLowerCase()] ?? email;
}
