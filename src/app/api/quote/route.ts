import { NextResponse } from "next/server";
import { Resend } from "resend";
import type { QuoteRequest, QuoteResponse } from "@/types/quote";
import { GARAGE_PARAMETERS } from "@/lib/parameters";
import { calculatePrice, formatPrice } from "@/lib/pricing";

const RECIPIENT = "post@garasjeproffen.no";

const SIDE_LABELS: Record<string, string> = {
  front: "Frontvegg",
  back: "Bakvegg",
  left: "Venstre vegg",
  right: "Høyre vegg",
};
const CATEGORY_LABELS: Record<string, string> = {
  door: "Dør 90×210",
  window1: "Vindu 100×50",
  window2: "Vindu 100×60",
  window3: "Vindu 100×100",
};
const PLACEMENT_LABELS: Record<string, string> = {
  left: "Venstre",
  right: "Høyre",
  both: "Begge sider",
};

export async function POST(request: Request) {
  try {
    const body: QuoteRequest & { packageType?: string; addedElements?: { side: string; category: string; placement: string }[] } = await request.json();

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
    const elements = body.addedElements ?? [];

    const quoteId = `Q-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Build elements HTML
    const elementsHtml = elements.length > 0
      ? `<h3>Dør og vindu</h3><table>${elements.map((el) =>
          `<tr><td>${CATEGORY_LABELS[el.category] ?? el.category}</td><td>${SIDE_LABELS[el.side] ?? el.side}</td><td>${PLACEMENT_LABELS[el.placement] ?? el.placement}</td></tr>`
        ).join("")}</table>`
      : "";

    // Send email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    console.log("RESEND_API_KEY present:", !!resendKey);

    if (resendKey) {
      const resend = new Resend(resendKey);
      const emailResult = await resend.emails.send({
        from: "GarasjeProffen <onboarding@resend.dev>",
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
            <tr><td><strong>Pakke:</strong></td><td>${body.packageType === "prefab" ? "Prefabrikert løsning" : "Materialpakke"}</td></tr>
            <tr><td><strong>Lengde:</strong></td><td>${(p.length ?? 6000) / 1000} m</td></tr>
            <tr><td><strong>Bredde:</strong></td><td>${(p.width ?? 8400) / 1000} m</td></tr>
            <tr><td><strong>Portbredde:</strong></td><td>${p.doorWidth ?? 2500} mm</td></tr>
            <tr><td><strong>Porthøyde:</strong></td><td>${p.doorHeight ?? 2125} mm</td></tr>
          </table>

          ${elementsHtml}

          <h3>Prisestimat</h3>
          <table>
            <tr><td><strong>Grunnpris (bygg):</strong></td><td>${formatPrice(pricing.basePrice, pricing.currency)}</td></tr>
            <tr><td><strong>Garasjeport:</strong></td><td>${formatPrice(pricing.adjustments[0]?.amount ?? 0, pricing.currency)}</td></tr>
            <tr><td><strong>Totalt:</strong></td><td><strong>${formatPrice(pricing.totalPrice, pricing.currency)}</strong></td></tr>
          </table>
        `,
      });
      if (emailResult.error) {
        console.error("Resend error:", JSON.stringify(emailResult.error));
        return NextResponse.json<QuoteResponse>(
          { success: false, error: "Klarte ikke sende e-post. Prøv igjen eller kontakt oss direkte." },
          { status: 500 }
        );
      }
      console.log("Resend ok:", emailResult.data?.id);
    } else {
      console.error("RESEND_API_KEY is not set – email not sent");
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
