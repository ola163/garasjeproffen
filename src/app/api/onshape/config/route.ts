import { NextResponse } from "next/server";
import { isConfigured } from "@/lib/onshape";

/**
 * GET /api/onshape/config
 * Note: Onshape's assembly configuration GET endpoint is not available via REST API.
 * Configuration parameters are passed directly to the GLTF endpoint as query params.
 */
export async function GET() {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "Onshape ikke konfigurert. Sjekk .env.local." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    message: "Onshape er konfigurert og klar.",
    note: "Assembly configuration parameters are passed directly to the GLTF endpoint. The VeggA parameter is sent as a query string when fetching the model.",
    configured: true,
  });
}
