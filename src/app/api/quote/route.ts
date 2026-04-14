import { NextResponse } from "next/server";
import { Resend } from "resend";
import type { QuoteRequest, QuoteResponse } from "@/types/quote";
import { GARAGE_PARAMETERS } from "@/lib/parameters";
import { calculatePrice, formatPrice } from "@/lib/pricing";

const RECIPIENT = "post@garasjeporten.no";

export async function POST(request: Request) {
  try {
    const body: QuoteRequest = await request.json();

    // Validate customer info
    if (!body.customer?.name || !body.customer?.email) {
      return NextResponse.json<QuoteResponse>(
        { success: false, error: "Navn og e-post er påkrevd." },
        { status: 400 }
      );
    }

    // Validate parameters are within bounds
    for (const param of GARAGE_PARAMETERS) {
      const value = body.configuration?.parameters?.[param.id];
      if (
        value !== undefined &&
        param.min !== undefined &&
        param.max !== undefined &&
        (value < param.min || value > param.max)
      ) {
        return NextResponse.json<QuoteResponse>(
          { success: false, error: `${param.label} er utenfor tillatt område.` },
          { status: 400 }
        );
      }
    }

    // Recalculate price server-side
    const pricing = calculatePrice(body.configuration);
    const p = body.configuration.parameters;

    const quoteId = `Q-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Send email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: RECIPIENT,
        replyTo: body.customer.email,
        subject: `Ny tilbudsforespørsel – ${body.customer.name} (${quoteId})`,
        html: `
          <h2>Ny tilbudsforespørsel</h2>
          <p><strong>Tilbuds-ID:</strong> ${quoteId}</p>

          <h3>Kunde</h3>
          <table>
            <tr><td><strong>Navn:</strong></td><td>${body.customer.name}</td></tr>
            <tr><td><strong>E-post:</strong></td><td>${body.customer.email}</td></tr>
            <tr><td><strong>Telefon:</strong></td><td>${body.customer.phone || "–"}</td></tr>
            <tr><td><strong>Melding:</strong></td><td>${body.customer.message || "–"}</td></tr>
          </table>

          <h3>Konfigurasjon</h3>
          <table>
            <tr><td><strong>Lengde:</strong></td><td>${(p.length ?? 6000) / 1000} m</td></tr>
            <tr><td><strong>Bredde:</strong></td><td>${(p.width ?? 8400) / 1000} m</td></tr>
            <tr><td><strong>Portbredde:</strong></td><td>${p.doorWidth ?? 2500} mm</td></tr>
            <tr><td><strong>Porthøyde:</strong></td><td>${p.doorHeight ?? 2125} mm</td></tr>
          </table>

          <h3>Prisestimat</h3>
          <table>
            <tr><td><strong>Grunnpris (bygg):</strong></td><td>${formatPrice(pricing.basePrice, pricing.currency)}</td></tr>
            <tr><td><strong>Garasjeport:</strong></td><td>${formatPrice(pricing.adjustments[0]?.amount ?? 0, pricing.currency)}</td></tr>
            <tr><td><strong>Totalt:</strong></td><td><strong>${formatPrice(pricing.totalPrice, pricing.currency)}</strong></td></tr>
          </table>
        `,
      });
    }

    console.log("Quote submitted:", quoteId, body.customer);

    return NextResponse.json<QuoteResponse>({ success: true, quoteId });
  } catch {
    return NextResponse.json<QuoteResponse>(
      { success: false, error: "Noe gikk galt. Prøv igjen." },
      { status: 400 }
    );
  }
}
