import { fileTypeFromBuffer } from "file-type";

export const MAX_FILE_SIZE   = 10 * 1024 * 1024; // 10 MB per file
export const MAX_TOTAL_SIZE  = 25 * 1024 * 1024; // 25 MB total across all files

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

// DWG/DXF don't have reliable magic bytes — allow by extension only
const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "heic", "heif",
  "pdf", "dwg", "dxf",
]);

export type ValidationResult = { valid: true } | { valid: false; reason: string };

export async function validateFile(
  buffer: Buffer,
  filename: string,
  claimedType: string,
): Promise<ValidationResult> {
  if (buffer.length > MAX_FILE_SIZE) {
    return { valid: false, reason: `Filen "${filename}" er for stor (maks 10 MB).` };
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, reason: `Filtypen ".${ext}" er ikke tillatt.` };
  }

  // DWG/DXF — no reliable magic bytes, trust extension
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

  if (claimedType && claimedType !== "application/octet-stream" && claimedType !== detected.mime) {
    return { valid: false, reason: `Filen "${filename}" samsvarer ikke med oppgitt filtype.` };
  }

  return { valid: true };
}
