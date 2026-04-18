import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import type { LineItem } from "@/types/quote-admin";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

function toOre(nok: number) {
  return Math.round(nok * 100);
}

function taxAmount(nok: number) {
  // Norwegian 25% VAT: tax = total * 25/125 = total * 0.2
  return Math.round(toOre(nok) * 0.2);
}

export async function POST(request: Request) {
  try {
    const { quoteId, lineItems, notes, adminEmail } = await request.json() as {
      quoteId: string;
      lineItems: LineItem[];
      notes: string;
      adminEmail: string;
    };

    if (!ALLOWED_ADMINS.includes((adminEmail ?? "").toLowerCase())) {
      return NextResponse.json({ success: false, error: "Ikke tilgang" }, { status: 403 });
    }

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!sbUrl || !sbKey) {
      return NextResponse.json({ success: false, error: "Supabase ikke konfigurert" }, { status: 500 });
    }

    // Fetch quote (using service role if available, otherwise anon — admin must be authenticated)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const sb = createClient(sbUrl, serviceKey ?? sbKey);
    const { data: quote, error: fetchErr } = await sb
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (fetchErr || !quote) {
      return NextResponse.json({ success: false, error: "Fant ikke tilbudsforespørsel" }, { status: 404 });
    }

    const offerTotal = lineItems.reduce((s, item) => s + item.amount * item.quantity, 0);

    // ── Klarna Checkout ──
    const klarnaUser = process.env.KLARNA_API_USERNAME;
    const klarnaPass = process.env.KLARNA_API_PASSWORD;
    const klarnaBase = process.env.KLARNA_API_URL ?? "https://api.playground.klarna.com";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.garasjeproffen.no";

    let klarnaOrderId: string | null = null;
    let paymentUrl: string | null = null;

    if (klarnaUser && klarnaPass) {
      const auth = Buffer.from(`${klarnaUser}:${klarnaPass}`).toString("base64");
      const orderLines = lineItems.map((item) => ({
        type: "physical",
        name: item.description,
        quantity: item.quantity,
        unit_price: toOre(item.amount),
        tax_rate: 2500,
        total_amount: toOre(item.amount * item.quantity),
        total_tax_amount: taxAmount(item.amount * item.quantity),
      }));
      const totalOre = toOre(offerTotal);
      const totalTaxOre = orderLines.reduce((s, l) => s + l.total_tax_amount, 0);

      const klarnaRes = await fetch(`${klarnaBase}/checkout/v3/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify({
          purchase_country: "NO",
          purchase_currency: "NOK",
          locale: "nb-NO",
          order_amount: totalOre,
          order_tax_amount: totalTaxOre,
          order_lines: orderLines,
          merchant_urls: {
            terms: `${siteUrl}/vilkar`,
            checkout: `${siteUrl}/betaling/{checkout.order.id}`,
            confirmation: `${siteUrl}/betaling/{checkout.order.id}/bekreftelse`,
            push: `${siteUrl}/api/klarna/push?sid={checkout.order.id}`,
          },
          billing_address: { email: quote.customer_email },
          merchant_reference1: quote.ticket_number,
        }),
      });

      const klarnaData = await klarnaRes.json();
      if (klarnaData.order_id) {
        klarnaOrderId = klarnaData.order_id;
        paymentUrl = `${siteUrl}/betaling/${klarnaData.order_id}`;
      } else {
        console.error("Klarna error:", JSON.stringify(klarnaData));
      }
    }

    // ── Send email to customer ──
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const lineItemsHtml = lineItems
        .map(
          (item) => `
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb">${item.description}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right">
              ${new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(item.amount * item.quantity)}
            </td>
          </tr>`
        )
        .join("");

      const totalFormatted = new Intl.NumberFormat("nb-NO", {
        style: "currency", currency: "NOK", maximumFractionDigits: 0,
      }).format(offerTotal);

      const paymentSection = paymentUrl
        ? `<p style="margin-top:24px">
            <a href="${paymentUrl}"
              style="display:inline-block;background:#e2520a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">
              Betal med Klarna
            </a>
           </p>
           <p style="color:#6b7280;font-size:13px;margin-top:8px">Lenken er gyldig i 14 dager.</p>`
        : `<p style="margin-top:16px;color:#374151">Ta kontakt med oss for å gjennomføre betalingen: <a href="mailto:post@garasjeproffen.no">post@garasjeproffen.no</a></p>`;

      await resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: quote.customer_email,
        subject: `Tilbud fra GarasjeProffen – ${quote.ticket_number}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#e2520a">Tilbud fra GarasjeProffen</h2>
            <p>Hei ${quote.customer_name},</p>
            <p>Takk for din henvendelse. Her er tilbudet ditt (${quote.ticket_number}):</p>

            <table style="border-collapse:collapse;width:100%;margin-top:16px">
              <thead>
                <tr style="background:#f3f4f6">
                  <th style="text-align:left;padding:8px 12px;border:1px solid #e5e7eb">Beskrivelse</th>
                  <th style="text-align:center;padding:8px 12px;border:1px solid #e5e7eb">Antall</th>
                  <th style="text-align:right;padding:8px 12px;border:1px solid #e5e7eb">Beløp</th>
                </tr>
              </thead>
              <tbody>${lineItemsHtml}</tbody>
              <tfoot>
                <tr style="background:#f9fafb">
                  <td colspan="2" style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600">Totalt inkl. MVA</td>
                  <td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-weight:700;font-size:16px">${totalFormatted}</td>
                </tr>
              </tfoot>
            </table>

            ${notes ? `<div style="margin-top:20px;padding:16px;background:#f9fafb;border-radius:8px;border-left:4px solid #e2520a"><p style="margin:0;color:#374151">${notes.replace(/\n/g, "<br>")}</p></div>` : ""}

            ${paymentSection}

            <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
            <p style="color:#6b7280;font-size:13px">GarasjeProffen AS · post@garasjeproffen.no · garasjeproffen.no</p>
          </div>
        `,
      });
    }

    // ── Update quote in DB ──
    await sb.from("quotes").update({
      offer_line_items: lineItems,
      offer_total: offerTotal,
      offer_notes: notes || null,
      klarna_order_id: klarnaOrderId,
      status: "offer_sent",
      offer_sent_at: new Date().toISOString(),
    }).eq("id", quoteId);

    return NextResponse.json({ success: true, klarnaOrderId, paymentUrl, offerTotal });
  } catch (err) {
    console.error("send-offer error:", err);
    return NextResponse.json({ success: false, error: "Noe gikk galt" }, { status: 500 });
  }
}
