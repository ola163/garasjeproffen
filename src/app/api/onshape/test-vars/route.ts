import { NextResponse } from "next/server";

const ACCESS_KEY         = process.env.ONSHAPE_ACCESS_KEY         ?? "";
const SECRET_KEY         = process.env.ONSHAPE_SECRET_KEY         ?? "";
const DOCUMENT_ID        = process.env.ONSHAPE_DOCUMENT_ID        ?? "";
const WORKSPACE_ID       = process.env.ONSHAPE_WORKSPACE_ID       ?? "";
const VARIABLE_STUDIO_ID = process.env.ONSHAPE_VARIABLE_STUDIO_ID ?? "";
const FEATURE_ID_VEGG_A  = process.env.ONSHAPE_FEATURE_ID_VEGG_A  ?? "";
const BASE_URL = "https://cad.onshape.com/api/v6";

function authHeaders(): HeadersInit {
  const credentials = Buffer.from(`${ACCESS_KEY}:${SECRET_KEY}`).toString("base64");
  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function safeRequest(url: string, init?: RequestInit) {
  try {
    const res = await fetch(url, init);
    const text = await res.text();
    let body: unknown;
    try { body = JSON.parse(text); } catch { body = text.substring(0, 600); }
    return { status: res.status, ok: res.ok, body };
  } catch (e) {
    return { status: 0, ok: false, body: String(e) };
  }
}

/**
 * GET /api/onshape/test-vars
 *
 * Tests two approaches to writing variables into the Variable Studio:
 *
 * Approach A: Variables API  — POST /partstudios/…/variables
 * Approach B: Feature update — POST /partstudios/…/features/featureid/{fid}
 *
 * Both target VeggA = 6 m (no real change, just a round-trip test).
 */
export async function GET() {
  const vsBase = `${BASE_URL}/partstudios/d/${DOCUMENT_ID}/w/${WORKSPACE_ID}/e/${VARIABLE_STUDIO_ID}`;

  // ── Step 1: GET features (needed for approach B) ──────────────────────────
  const featuresResult = await safeRequest(`${vsBase}/features`, {
    headers: authHeaders(),
  });

  // ── Step 2: GET variables (approach A – read first) ───────────────────────
  const varsGetResult = await safeRequest(`${vsBase}/variables`, {
    headers: authHeaders(),
  });

  // ── Step 3A: POST variables API ───────────────────────────────────────────
  const varsPostBody = {
    variables: [
      {
        name: "VeggA",
        type: "UNIT_TYPE",
        value: { expression: "6 m" },
        description: "",
      },
    ],
  };
  const varsPostResult = await safeRequest(`${vsBase}/variables`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(varsPostBody),
  });

  // ── Step 3B: POST feature update (existing approach) ─────────────────────
  let featurePostResult: ReturnType<typeof safeRequest> extends Promise<infer T> ? T : never =
    { status: 0, ok: false, body: "Skipped — features GET failed or feature not found" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const featureList: any = featuresResult.body;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const feature = Array.isArray(featureList?.features)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? featureList.features.find((f: any) => f.featureId === FEATURE_ID_VEGG_A)
    : null;

  if (feature) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedParams = feature.parameters.map((p: any) =>
      p.parameterId === "lengthValue" || p.parameterId === "value"
        ? { ...p, expression: "6 m" }
        : p,
    );
    const postBody = {
      btType: "BTFeatureDefinitionCall-1406",
      feature: { ...feature, parameters: updatedParams },
      serializationVersion: featureList.serializationVersion,
      sourceMicroversion: featureList.sourceMicroversion,
    };
    featurePostResult = await safeRequest(
      `${vsBase}/features/featureid/${FEATURE_ID_VEGG_A}`,
      { method: "POST", headers: authHeaders(), body: JSON.stringify(postBody) },
    );
  }

  return NextResponse.json({
    config: {
      hasAccessKey: !!ACCESS_KEY,
      hasSecretKey: !!SECRET_KEY,
      DOCUMENT_ID,
      WORKSPACE_ID,
      VARIABLE_STUDIO_ID,
      FEATURE_ID_VEGG_A,
    },
    step1_features_GET:    { status: featuresResult.status, ok: featuresResult.ok, featureCount: Array.isArray(featureList?.features) ? featureList.features.length : "n/a" },
    step2_variables_GET:   { status: varsGetResult.status,  ok: varsGetResult.ok,  body: varsGetResult.body },
    step3A_variables_POST: { status: varsPostResult.status, ok: varsPostResult.ok, requestBody: varsPostBody, responseBody: varsPostResult.body },
    step3B_feature_POST:   { status: featurePostResult.status, ok: featurePostResult.ok, featureFound: !!feature, responseBody: featurePostResult.body },
  });
}
