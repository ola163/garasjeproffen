import { NextResponse } from "next/server";
import { Resend } from "resend";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

export async function POST(request: Request) {
  try {
    const { approverEmail, approverName, requesterName, ticketNumber, customerName, offerTotal, quoteId } =
      await request.json() as {
        approverEmail: string;
        approverName: string;
        requesterName: string;
        ticketNumber: string;
        customerName: string;
        offerTotal: number;
        quoteId: string;
      };

    if (!ALLOWED_ADMINS.includes((approverEmail ?? "").toLowerCase())) {
      return NextResponse.json({ success: false, error: "Ugyldig godkjenner" }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ success: false, error: "RESEND_API_KEY mangler" }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.garasjeproffen.no";
    const quoteUrl = `${siteUrl}/admin/quotes/${quoteId}`;

    const totalFormatted = new Intl.NumberFormat("nb-NO", {
      style: "currency", currency: "NOK", maximumFractionDigits: 0,
    }).format(offerTotal);

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "GarasjeProffen <noreply@garasjeproffen.no>",
      to: approverEmail,
      subject: `Godkjenning forespurt – ${ticketNumber}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#e2520a">Godkjenning av tilbud forespurt</h2>
          <p>Hei ${approverName},</p>
          <p><strong>${requesterName}</strong> ber deg godkjenne et tilbud før det sendes til kunden.</p>

          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:20px 0">
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              <tr>
                <td style="padding:4px 0;color:#6b7280">Referanse</td>
                <td style="padding:4px 0;font-family:monospace;font-weight:600">${ticketNumber}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;color:#6b7280">Kunde</td>
                <td style="padding:4px 0;font-weight:500">${customerName}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;color:#6b7280">Tilbudssum</td>
                <td style="padding:4px 0;font-weight:700;font-size:16px">${totalFormatted}</td>
              </tr>
              <tr>
                <td style="padding:4px 0;color:#6b7280">Behandler</td>
                <td style="padding:4px 0">${requesterName}</td>
              </tr>
            </table>
          </div>

          <p style="margin-top:24px">
            <a href="${quoteUrl}"
              style="display:inline-block;background:#e2520a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
              Åpne og godkjenn tilbud
            </a>
          </p>
          <p style="color:#6b7280;font-size:12px;margin-top:16px">
            Logg inn på admin-panelet for å se tilbudsdetaljene og godkjenne.
          </p>
          <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
          <p style="color:#6b7280;font-size:12px">GarasjeProffen AS · post@garasjeproffen.no</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("request-approval error:", err);
    return NextResponse.json({ success: false, error: "Noe gikk galt" }, { status: 500 });
  }
}
