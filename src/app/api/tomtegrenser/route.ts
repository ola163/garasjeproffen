export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) return new Response("Missing lat/lng", { status: 400 });

  try {
    const res = await fetch(
      `https://ws.geonorge.no/eiendomsopplysninger/v1/punkt?nord=${lat}&ost=${lng}&koordsys=4258`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return new Response("Kartverket error", { status: 502 });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return new Response("Kartverket timeout", { status: 504 });
  }
}
