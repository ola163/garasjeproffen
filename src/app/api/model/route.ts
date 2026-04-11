import { NextResponse } from "next/server";
import {
  isConfigured,
  updateConfiguration,
  exportGltf,
  downloadGltf,
} from "@/lib/onshape";

/**
 * POST /api/model
 * Accepts { parameters: { length: 6000 } }
 * Updates the Onshape model, exports GLTF, and returns the binary file.
 */
export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Onshape API er ikke konfigurert. Sjekk .env.local." },
      { status: 503 }
    );
  }

  try {
    const { parameters } = await request.json();

    // Update parameters in Onshape
    await updateConfiguration(parameters);

    // Export as GLTF
    const gltfUrl = await exportGltf();

    // Download the GLTF file
    const gltfData = await downloadGltf(gltfUrl);

    // Return the GLTF binary
    return new NextResponse(gltfData, {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Model export error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ukjent feil" },
      { status: 500 }
    );
  }
}
