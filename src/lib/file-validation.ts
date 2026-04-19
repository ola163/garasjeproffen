import { fileTypeFromBuffer } from "file-type";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "application/pdf",
]);

// DWG/DXF don't have reliable magic bytes — allow by extension only
const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "heic",
  "pdf", "dwg", "dxf",
]);

export type ValidationResult = { valid: true } | { valid: false; reason: string };

export async function validateFile(buffer: Buffer, filename: string, claimedType: string): Promise<ValidationResult> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `Filtypen ".${ext}" er ikke tillatt.` };
  }

  // DWG/DXF — skip magic byte check, trust extension
  if (ext === "dwg" || ext === "dxf") {
    return { valid: true };
  }

  const detected = await fileTypeFromBuffer(buffer);

  if (!detected) {
    return { valid: false, reason: `Kunne ikke verifisere filtype for "${filename}".` };
  }

  if (!ALLOWED_MIME_TYPES.has(detected.mime)) {
    return { valid: false, reason: `Filen "${filename}" ser ut til å være en ${detected.mime}-fil, som ikke er tillatt.` };
  }

  // Ensure claimed content-type matches actual content
  if (claimedType && claimedType !== "application/octet-stream" && claimedType !== detected.mime) {
    return { valid: false, reason: `Filen "${filename}" samsvarer ikke med oppgitt filtype.` };
  }

  return { valid: true };
}
