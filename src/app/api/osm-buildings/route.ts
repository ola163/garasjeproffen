export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") ?? "300";

  if (!lat || !lng) return new Response("Missing lat/lng", { status: 400 });

  const query = `[out:json][timeout:25];(way["building"](around:${radius},${lat},${lng}););out body;>;out skel qt;`;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      headers: { "Content-Type": "text/plain" },
      signal: AbortSignal.timeout(28000),
    });
    if (!res.ok) return new Response("Overpass error", { status: 502 });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return new Response("Overpass timeout", { status: 504 });
  }
}
