import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import type { LineItem, OfferSection } from "@/types/quote-admin";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

const CATEGORY_LABELS: Record<string, string> = {
  søknadshjelp: "Søknadshjelp",
  materialpakke: "Materialpakke",
  prefabelement: "Prefabelement",
};

function toOre(nok: number) {
  return Math.round(nok * 100);
}

function taxAmount(nok: number) {
  return Math.round(toOre(nok) * 0.2);
}

function formatNOK(n: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}

function getEffectiveItems(section: OfferSection, allSections: OfferSection[]): LineItem[] {
  if (section.category !== "prefabelement") return section.line_items;
  const mat = allSections.find((s) => s.category === "materialpakke");
  return [...(mat?.line_items ?? []), ...section.line_items];
}

function sectionTotal(section: OfferSection, allSections: OfferSection[]) {
  return getEffectiveItems(section, allSections).reduce((s, item) => s + item.amount * item.quantity, 0);
}

export async function POST(request: Request) {
  try {
    const { quoteId, offerSections, adminEmail, customerEmail, customerName, ticketNumber } = await request.json() as {
      quoteId: string;
      offerSections: OfferSection[];
      adminEmail: string;
      customerEmail: string;
      customerName: string;
      ticketNumber: string;
    };

    if (!ALLOWED_ADMINS.includes((adminEmail ?? "").toLowerCase())) {
      return NextResponse.json({ success: false, error: "Ikke tilgang" }, { status: 403 });
    }

    if (!customerEmail || !ticketNumber || !offerSections?.length) {
      return NextResponse.json({ success: false, error: "Mangler kundeinformasjon eller tilbudslinjer" }, { status: 400 });
    }

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!sbUrl || !sbKey) {
      return NextResponse.json({ success: false, error: "Supabase ikke konfigurert" }, { status: 500 });
    }

    const sb = createClient(sbUrl, sbKey);
    const hasPrefa = offerSections.some((s) => s.category === "prefabelement");
    const grandTotal = offerSections.reduce((t, s) => {
      if (hasPrefa && s.category === "materialpakke") return t;
      return t + sectionTotal(s, offerSections);
    }, 0);
    // Flatten for Klarna — use effective items but avoid duplicating materialpakke rows
    const allLineItems: LineItem[] = hasPrefa
      ? offerSections.flatMap(s => s.category === "materialpakke" ? [] : getEffectiveItems(s, offerSections))
      : offerSections.flatMap(s => s.line_items);

    // ── Klarna Checkout ──
    const klarnaUser = process.env.KLARNA_API_USERNAME;
    const klarnaPass = process.env.KLARNA_API_PASSWORD;
    const klarnaBase = process.env.KLARNA_API_URL ?? "https://api.playground.klarna.com";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.garasjeproffen.no";

    let klarnaOrderId: string | null = null;
    let paymentUrl: string | null = null;

    if (klarnaUser && klarnaPass) {
      const auth = Buffer.from(`${klarnaUser}:${klarnaPass}`).toString("base64");
      const orderLines = allLineItems.map((item) => ({
        type: "physical",
        name: item.description,
        quantity: item.quantity,
        unit_price: toOre(item.amount),
        tax_rate: 2500,
        total_amount: toOre(item.amount * item.quantity),
        total_tax_amount: taxAmount(item.amount * item.quantity),
      }));
      const totalOre = toOre(grandTotal);
      const totalTaxOre = orderLines.reduce((s, l) => s + l.total_tax_amount, 0);

      const klarnaRes = await fetch(`${klarnaBase}/checkout/v3/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
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
          billing_address: { email: customerEmail },
          merchant_reference1: ticketNumber,
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

    // ── Build email HTML ──
    const sectionsHtml = offerSections.map((section) => {
      const label = CATEGORY_LABELS[section.category] ?? section.category;
      const subTotal = sectionTotal(section, offerSections);
      const effectiveItems = getEffectiveItems(section, offerSections);
      const rowsHtml = effectiveItems.map((item) => `
        <tr>
          <td style="padding:7px 12px;border:1px solid #e5e7eb">${item.description}</td>
          <td style="padding:7px 12px;border:1px solid #e5e7eb;text-align:center">${item.quantity}</td>
          <td style="padding:7px 12px;border:1px solid #e5e7eb;text-align:right">${formatNOK(item.amount * item.quantity)}</td>
        </tr>`).join("");

      return `
        <h3 style="margin:28px 0 8px;color:#374151;font-size:15px">${label}</h3>
        <table style="border-collapse:collapse;width:100%;font-size:14px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="text-align:left;padding:7px 12px;border:1px solid #e5e7eb">Beskrivelse</th>
              <th style="text-align:center;padding:7px 12px;border:1px solid #e5e7eb">Antall</th>
              <th style="text-align:right;padding:7px 12px;border:1px solid #e5e7eb">Beløp</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="background:#f9fafb">
              <td colspan="2" style="padding:7px 12px;border:1px solid #e5e7eb;font-weight:600">Delsum ${label}</td>
              <td style="padding:7px 12px;border:1px solid #e5e7eb;text-align:right;font-weight:700">${formatNOK(subTotal)}</td>
            </tr>
          </tfoot>
        </table>
        ${section.notes ? `<p style="margin:8px 0 0;font-size:13px;color:#6b7280">${section.notes.replace(/\n/g, "<br>")}</p>` : ""}
      `;
    }).join("");

    const paymentSection = paymentUrl
      ? `<p style="margin-top:28px">
          <a href="${paymentUrl}" style="display:inline-block;background:#e2520a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">
            Betal med Klarna
          </a>
         </p>
         <p style="color:#6b7280;font-size:13px;margin-top:8px">Lenken er gyldig i 14 dager.</p>`
      : `<p style="margin-top:20px;color:#374151">Ta kontakt med oss for å gjennomføre betalingen: <a href="mailto:post@garasjeproffen.no">post@garasjeproffen.no</a></p>`;

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#e2520a">Tilbud fra GarasjeProffen</h2>
        <p>Hei ${customerName},</p>
        <p>Takk for din henvendelse. Her er tilbudet ditt (${ticketNumber}):</p>

        ${sectionsHtml}

        ${offerSections.length > 1 ? `
        <div style="margin-top:20px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600;font-size:15px;color:#374151">Totalt inkl. MVA</span>
          <span style="font-weight:700;font-size:18px;color:#ea580c">${formatNOK(grandTotal)}</span>
        </div>` : ""}

        ${paymentSection}

        <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
        <p style="color:#6b7280;font-size:13px">GarasjeProffen AS · post@garasjeproffen.no · garasjeproffen.no</p>
      </div>
    `;

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: customerEmail,
        subject: `Tilbud fra GarasjeProffen – ${ticketNumber}`,
        html: emailHtml,
      });
    }

    // ── Update quote in DB ──
    await sb.from("quotes").update({
      offer_sections: offerSections,
      offer_line_items: allLineItems,
      offer_total: grandTotal,
      offer_notes: offerSections.map(s => s.notes).filter(Boolean).join("\n\n") || null,
      klarna_order_id: klarnaOrderId,
      status: "offer_sent",
      offer_sent_at: new Date().toISOString(),
    }).eq("id", quoteId);

    return NextResponse.json({ success: true, klarnaOrderId, paymentUrl, offerTotal: grandTotal });
  } catch (err) {
    console.error("send-offer error:", err);
    return NextResponse.json({ success: false, error: "Noe gikk galt" }, { status: 500 });
  }
}
