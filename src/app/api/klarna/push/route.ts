import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("sid");
    if (!orderId) return NextResponse.json({ ok: false }, { status: 400 });

    const klarnaUser = process.env.KLARNA_API_USERNAME;
    const klarnaPass = process.env.KLARNA_API_PASSWORD;
    const klarnaBase = process.env.KLARNA_API_URL ?? "https://api.playground.klarna.com";

    if (!klarnaUser || !klarnaPass) {
      return NextResponse.json({ ok: false, error: "Klarna ikke konfigurert" }, { status: 500 });
    }

    // Acknowledge the push by reading the order
    const auth = Buffer.from(`${klarnaUser}:${klarnaPass}`).toString("base64");
    const res = await fetch(`${klarnaBase}/checkout/v3/orders/${orderId}`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const order = await res.json();

    if (order.status === "checkout_complete") {
      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (sbUrl && sbKey) {
        const sb = createClient(sbUrl, sbKey);
        await sb
          .from("quotes")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("klarna_order_id", orderId);
      }
    }

    // Klarna requires a 200 response to acknowledge
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Klarna push error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
