import { NextResponse } from "next/server";

const ACCESS_KEY = process.env.ONSHAPE_ACCESS_KEY ?? "";
const SECRET_KEY = process.env.ONSHAPE_SECRET_KEY ?? "";
const DOCUMENT_ID = process.env.ONSHAPE_DOCUMENT_ID ?? "";
const WORKSPACE_ID = process.env.ONSHAPE_WORKSPACE_ID ?? "";
const ELEMENT_ID = process.env.ONSHAPE_ELEMENT_ID ?? "";
const ELEMENT_ID_VEGG_A = process.env.ONSHAPE_ELEMENT_ID_VEGG_A ?? "";
const ELEMENT_ID_VEGG_B = process.env.ONSHAPE_ELEMENT_ID_VEGG_B ?? "";
const BASE_URL = "https://cad.onshape.com/api/v6";

function authHeaders(): HeadersInit {
  const credentials = Buffer.from(`${ACCESS_KEY}:${SECRET_KEY}`).toString("base64");
  return { Authorization: `Basic ${credentials}`, Accept: "application/json" };
}

async function safeGet(url: string) {
  try {
    const res = await fetch(url, { headers: authHeaders() });
    const text = await res.text();
    try { return { status: res.status, data: JSON.parse(text) }; }
    catch { return { status: res.status, data: text.substring(0, 500) }; }
  } catch (e) {
    return { status: 0, data: String(e) };
  }
}

const VARIABLE_STUDIO_ID = "aa486e157014c4927041dfdf";

/** GET /api/onshape/debug — shows features of Variable Studio 1 (via Part Studio API) */
export async function GET() {
  const features = await safeGet(
    `${BASE_URL}/partstudios/d/${DOCUMENT_ID}/w/${WORKSPACE_ID}/e/${VARIABLE_STUDIO_ID}/features`
  );
  // Only return featureType and parameters (not the huge entity/constraint lists)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const simplified = (features.data?.features ?? []).map((f: any) => ({
    featureId: f.featureId,
    featureType: f.featureType,
    name: f.name,
    parameters: f.parameters,
  }));
  return NextResponse.json({ status: features.status, features: simplified });
}
