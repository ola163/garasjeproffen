import { NextResponse } from "next/server";
import { getGltfDirect, isConfigured } from "@/lib/onshape";
import JSZip from "jszip";

/**
 * GET /api/onshape/model?length=6000
 * Downloads the GLTF model from Onshape. Handles both direct GLB and ZIP responses.
 */
export async function GET(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Onshape ikke konfigurert. Sjekk .env.local." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const lengthMm     = searchParams.get("length")     ? Number(searchParams.get("length"))     : undefined;
  const widthMm      = searchParams.get("width")      ? Number(searchParams.get("width"))      : undefined;
  const doorWidthMm  = searchParams.get("doorWidth")  ? Number(searchParams.get("doorWidth"))  : undefined;
  const doorHeightMm = searchParams.get("doorHeight") ? Number(searchParams.get("doorHeight")) : undefined;

  try {
    const { buffer, contentType } = await getGltfDirect(lengthMm, widthMm, doorWidthMm, doorHeightMm);

    console.log(`Onshape response: ${contentType}, ${buffer.byteLength} bytes`);

    // Check if Onshape returned a ZIP (common for assembly GLTF exports)
    const isZip =
      contentType.includes("zip") ||
      isZipBuffer(buffer);

    if (isZip) {
      // Extract the GLB or GLTF file from the ZIP
      const zip = await JSZip.loadAsync(buffer);

      // Find the GLB file first, then GLTF
      const glbFile = zip.file(/\.glb$/i)[0];
      const gltfFile = zip.file(/\.gltf$/i)[0];
      const modelFile = glbFile ?? gltfFile;

      if (!modelFile) {
        const files = Object.keys(zip.files).join(", ");
        return NextResponse.json(
          { error: `ZIP inneholder ingen GLTF-fil. Filer: ${files}` },
          { status: 500 }
        );
      }

      const modelBuffer = await modelFile.async("arraybuffer");
      const modelContentType = modelFile.name.endsWith(".glb")
        ? "model/gltf-binary"
        : "model/gltf+json";

      console.log(`Extracted ${modelFile.name} (${modelBuffer.byteLength} bytes) from ZIP`);

      return new NextResponse(modelBuffer, {
        headers: {
          "Content-Type": modelContentType,
          "Cache-Control": "no-cache",
        },
      });
    }

    // Direct GLB/GLTF response
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Onshape model error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ukjent feil" },
      { status: 500 }
    );
  }
}

/** Check ZIP magic bytes: PK\x03\x04 */
function isZipBuffer(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}
