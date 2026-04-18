import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("id");
  if (!orderId) return NextResponse.json({ error: "Mangler ordre-ID" }, { status: 400 });

  const klarnaUser = process.env.KLARNA_API_USERNAME;
  const klarnaPass = process.env.KLARNA_API_PASSWORD;
  const klarnaBase = process.env.KLARNA_API_URL ?? "https://api.playground.klarna.com";

  if (!klarnaUser || !klarnaPass) {
    return NextResponse.json({ error: "Betalingsintegrasjon ikke konfigurert" }, { status: 503 });
  }

  const auth = Buffer.from(`${klarnaUser}:${klarnaPass}`).toString("base64");
  const res = await fetch(`${klarnaBase}/checkout/v3/orders/${orderId}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Fant ikke ordre" }, { status: 404 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
