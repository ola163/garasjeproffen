export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const radiusRaw = searchParams.get("radius") ?? "300";

  if (!latRaw || !lngRaw) return new Response("Missing lat/lng", { status: 400 });

  const lat = parseFloat(latRaw);
  const lng = parseFloat(lngRaw);
  const radius = Math.min(Math.max(parseInt(radiusRaw, 10) || 300, 10), 2000);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return new Response("Invalid lat/lng", { status: 400 });
  }

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
