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

  // DWG: magic bytes start with "AC" (AutoCAD format marker)
  if (ext === "dwg") {
    if (buffer[0] !== 0x41 || buffer[1] !== 0x43) {
      return { valid: false, reason: `Filen "${filename}" ser ikke ut som en gyldig DWG-fil.` };
    }
    return { valid: true };
  }

  // DXF: ASCII/UTF-8 text format — reject if null bytes found in first 512 bytes
  if (ext === "dxf") {
    const sample = buffer.slice(0, Math.min(512, buffer.length));
    if (sample.includes(0x00)) {
      return { valid: false, reason: `Filen "${filename}" ser ikke ut som en gyldig DXF-fil.` };
    }
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
