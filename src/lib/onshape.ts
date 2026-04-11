/**
 * Onshape REST API helper.
 * Runs server-side only (API routes) — never expose keys to the browser.
 */

const ACCESS_KEY          = process.env.ONSHAPE_ACCESS_KEY          ?? "";
const SECRET_KEY          = process.env.ONSHAPE_SECRET_KEY          ?? "";
const DOCUMENT_ID         = process.env.ONSHAPE_DOCUMENT_ID         ?? "";
const WORKSPACE_ID        = process.env.ONSHAPE_WORKSPACE_ID        ?? "";
const ELEMENT_ID          = process.env.ONSHAPE_ELEMENT_ID          ?? ""; // Assembly
const VARIABLE_STUDIO_ID  = process.env.ONSHAPE_VARIABLE_STUDIO_ID  ?? "";
const FEATURE_ID_VEGG_A   = process.env.ONSHAPE_FEATURE_ID_VEGG_A   ?? "";
const FEATURE_ID_VEGG_B   = process.env.ONSHAPE_FEATURE_ID_VEGG_B   ?? "";
const FEATURE_ID_VEGG_C   = process.env.ONSHAPE_FEATURE_ID_VEGG_C   ?? "";
const FEATURE_ID_PORT_B   = process.env.ONSHAPE_FEATURE_ID_PORT_B   ?? "";
const FEATURE_ID_PORT_H   = process.env.ONSHAPE_FEATURE_ID_PORT_H   ?? "";

const BASE_URL = "https://cad.onshape.com/api/v6";

function authHeaders(): HeadersInit {
  const credentials = Buffer.from(`${ACCESS_KEY}:${SECRET_KEY}`).toString("base64");
  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Update VeggA and VeggB assignVariable features in Variable Studio 1.
 * GET all features → find VeggA/VeggB → POST each updated feature back.
 */
async function updateVariableFeatures(lengthM: number, widthM: number, veggCM: number, portBM: number, portHM: number): Promise<void> {
  const featuresUrl = `${BASE_URL}/partstudios/d/${DOCUMENT_ID}/w/${WORKSPACE_ID}/e/${VARIABLE_STUDIO_ID}/features`;

  // GET all features (the list endpoint supports GET)
  const getRes = await fetch(featuresUrl, { headers: authHeaders() });
  if (!getRes.ok) throw new Error(`Get features failed: ${getRes.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const featureList: any = await getRes.json();

  const updates: [string, number][] = [
    [FEATURE_ID_VEGG_A, lengthM],
    [FEATURE_ID_VEGG_B, widthM],
    ...(FEATURE_ID_VEGG_C ? [[FEATURE_ID_VEGG_C, veggCM] as [string, number]] : []),
    ...(FEATURE_ID_PORT_B ? [[FEATURE_ID_PORT_B, portBM] as [string, number]] : []),
    ...(FEATURE_ID_PORT_H ? [[FEATURE_ID_PORT_H, portHM] as [string, number]] : []),
  ];

  for (const [featureId, newValueM] of updates) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const feature = featureList.features?.find((f: any) => f.featureId === featureId);
    if (!feature) throw new Error(`Feature ${featureId} not found in Variable Studio`);

    // Update the lengthValue and value parameter expressions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedParams = feature.parameters.map((p: any) => {
      if (p.parameterId === "lengthValue" || p.parameterId === "value") {
        return { ...p, expression: `${newValueM} m` };
      }
      return p;
    });

    const postUrl = `${featuresUrl}/featureid/${featureId}`;
    const postRes = await fetch(postUrl, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        btType: "BTFeatureDefinitionCall-1406",
        feature: { ...feature, parameters: updatedParams },
        serializationVersion: featureList.serializationVersion,
        sourceMicroversion: featureList.sourceMicroversion,
      }),
    });

    if (!postRes.ok) {
      const errText = await postRes.text().catch(() => "");
      throw new Error(`Update feature ${featureId} failed: ${postRes.status} — ${errText.substring(0, 400)}`);
    }

    console.log(`Feature ${featureId} (${newValueM} m) updated`);
  }
}

/**
 * Update VeggA and VeggB, then export the Assembly GLTF.
 */
export async function getGltfDirect(
  lengthMm?: number,
  widthMm?: number,
  doorWidthMm?: number,
  doorHeightMm?: number
): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  if (lengthMm !== undefined && widthMm !== undefined && VARIABLE_STUDIO_ID) {
    const dw = doorWidthMm ?? 2500;
    const dh = doorHeightMm ?? 2125;
    const veggCM = (widthMm - dw) / 2 / 1000;
    const portBM = dw / 1000;
    const portHM = dh / 1000;
    console.log(`Updating variables: VeggA=${lengthMm / 1000}m, VeggB=${widthMm / 1000}m, VeggC=${veggCM}m, PortB=${portBM}m, PortH=${portHM}m`);
    await updateVariableFeatures(lengthMm / 1000, widthMm / 1000, veggCM, portBM, portHM);
    console.log("Variables updated successfully");
  }

  // Export Assembly GLTF
  const url = `${BASE_URL}/assemblies/d/${DOCUMENT_ID}/w/${WORKSPACE_ID}/e/${ELEMENT_ID}/gltf`;

  const res = await fetch(url, {
    headers: {
      ...authHeaders(),
      Accept: "model/gltf-binary, application/octet-stream, */*",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Onshape GLTF ${res.status}: ${text.substring(0, 300)}`);
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = await res.arrayBuffer();
  return { buffer, contentType };
}

export function isConfigured(): boolean {
  return !!(ACCESS_KEY && SECRET_KEY && DOCUMENT_ID && WORKSPACE_ID && ELEMENT_ID && VARIABLE_STUDIO_ID);
}
