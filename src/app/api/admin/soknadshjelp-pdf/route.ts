import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateSoknadshjelPdf } from "@/lib/pdf/soknadshjelp-pdf";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

export async function POST(request: Request) {
  try {
    const { adminEmail, soknadshjelId } = await request.json() as {
      adminEmail: string;
      soknadshjelId: string;
    };

    if (!ALLOWED_ADMINS.includes((adminEmail ?? "").toLowerCase())) {
      return NextResponse.json({ error: "Ikke tilgang" }, { status: 403 });
    }

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sbUrl || !sbKey) return NextResponse.json({ error: "Konfig mangler" }, { status: 500 });

    const sb = createClient(sbUrl, sbKey);
    const { data: row } = await sb
      .from("soknadshjelp")
      .select("ticket_number,customer_name,address,tilbudsbeskrivelse,permit_price,extra_costs,manual_dispensasjoner")
      .eq("id", soknadshjelId)
      .single();

    if (!row) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });

    const extraCosts = (row.extra_costs as { description: string; amount: number }[]) ?? [];
    const manualDisps = (row.manual_dispensasjoner as { description: string; amount: number }[]) ?? [];

    const pdfBuffer = await generateSoknadshjelPdf({
      ticketNumber: row.ticket_number,
      customerName: row.customer_name,
      address: row.address,
      tilbudsbeskrivelse: row.tilbudsbeskrivelse,
      permitPrice: row.permit_price ?? 0,
      extraCosts,
      manualDisps,
    });

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tilbud-${row.ticket_number}.pdf"`,
      },
    });
  } catch (err) {
    console.error("soknadshjelp-pdf error:", err);
    return NextResponse.json({ error: "Noe gikk galt" }, { status: 500 });
  }
}
