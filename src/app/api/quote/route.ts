import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
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
    const body: QuoteRequest & { packageType?: string; roofType?: string; addedElements?: { side: string; category: string; placement: string }[] } = await request.json();

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

    // Save to Supabase (best-effort – does not block email)
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (sbUrl && sbKey) {
      const sb = createClient(sbUrl, sbKey);
      const { error: dbErr } = await sb.from("quotes").insert({
        customer_name: body.customer.name,
        customer_email: body.customer.email,
        customer_phone: body.customer.phone ?? null,
        customer_message: body.customer.message ?? null,
        package_type: body.packageType ?? null,
        roof_type: body.roofType ?? null,
        configuration: body.configuration ?? null,
        added_elements: elements,
        pricing,
      });
      if (dbErr) console.error("Supabase quote insert error:", dbErr.message);
    }

    console.log("addedElements received:", JSON.stringify(elements));

    // Expand "both" placement into two rows (left + right)
    const expandedElements = elements.flatMap((el) =>
      el.placement === "both"
        ? [{ ...el, placement: "left" }, { ...el, placement: "right" }]
        : [el]
    );
    const totalCount = expandedElements.length;

    // Build elements HTML
    const elementsHtml = expandedElements.length > 0
      ? `<h3 style="margin-top:16px">Dør og vindu (${totalCount} stk)</h3>
         <table style="border-collapse:collapse;width:100%">
           <thead>
             <tr style="background:#f3f4f6">
               <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb">Type</th>
               <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb">Vegg</th>
               <th style="text-align:left;padding:6px 10px;border:1px solid #e5e7eb">Plassering</th>
             </tr>
           </thead>
           <tbody>
             ${expandedElements.map((el) => `
               <tr>
                 <td style="padding:6px 10px;border:1px solid #e5e7eb">${CATEGORY_LABELS[el.category] ?? el.category}</td>
                 <td style="padding:6px 10px;border:1px solid #e5e7eb">${SIDE_LABELS[el.side] ?? el.side}</td>
                 <td style="padding:6px 10px;border:1px solid #e5e7eb">${PLACEMENT_LABELS[el.placement] ?? el.placement}</td>
               </tr>`).join("")}
           </tbody>
         </table>`
      : "<p style='color:#6b7280'><em>Ingen ekstra dører/vinduer lagt til</em></p>";

    // Send email via Resend
    const resendKey = process.env.RESEND_API_KEY;

    if (!resendKey) {
      return NextResponse.json<QuoteResponse>(
        { success: false, error: "Konfigurasjonsfeil: RESEND_API_KEY mangler. Kontakt oss på post@garasjeproffen.no" },
        { status: 500 }
      );
    }

    if (resendKey) {
      const resend = new Resend(resendKey);
      const emailResult = await resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: RECIPIENT,
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
            <tr><td><strong>Taktype:</strong></td><td>${body.roofType === "saltak" ? "Saltak" : "Flattak"}</td></tr>
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
      } else {
        console.log("Resend ok:", emailResult.data?.id);
      }
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
