import { NextResponse } from "next/server";
import { Resend } from "resend";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

function formatNOK(n: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}

export async function POST(request: Request) {
  try {
    const {
      adminEmail,
      customerEmail,
      customerName,
      ticketNumber,
      address,
      totalPrice,
      soknadshjelId,
    } = await request.json() as {
      adminEmail: string;
      customerEmail: string;
      customerName: string;
      ticketNumber: string;
      address: string | null;
      totalPrice: number;
      soknadshjelId: string;
    };

    if (!ALLOWED_ADMINS.includes((adminEmail ?? "").toLowerCase())) {
      return NextResponse.json({ success: false, error: "Ikke tilgang" }, { status: 403 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ success: false, error: "RESEND_API_KEY mangler" }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.garasjeproffen.no";
    const totalFormatted = totalPrice
      ? formatNOK(totalPrice)
      : null;

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "GarasjeProffen <noreply@garasjeproffen.no>",
      to: customerEmail,
      subject: `Søknadshjelp gjennomgått – ${ticketNumber}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#e2520a;padding:24px 28px;border-radius:12px 12px 0 0">
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">GarasjeProffen</h1>
            <p style="color:#ffedd5;margin:4px 0 0;font-size:13px">Søknadshjelp</p>
          </div>
          <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:28px">
            <h2 style="color:#111827;font-size:18px;margin:0 0 8px">Søknadshjelp gjennomgått</h2>
            <p style="color:#374151;margin:0 0 20px">Hei ${customerName},</p>
            <p style="color:#374151;margin:0 0 20px">
              Vi har gjennomgått din søknadshjelp-forespørsel og er klare til å hjelpe deg videre.
              En av våre saksbehandlere tar snart kontakt for å avtale neste steg.
            </p>

            <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 20px">
              <table style="width:100%;font-size:14px;border-collapse:collapse">
                <tr>
                  <td style="padding:4px 0;color:#6b7280">Referanse</td>
                  <td style="padding:4px 0;font-family:monospace;font-weight:600">${ticketNumber}</td>
                </tr>
                ${address ? `
                <tr>
                  <td style="padding:4px 0;color:#6b7280">Adresse</td>
                  <td style="padding:4px 0">${address}</td>
                </tr>` : ""}
                ${totalFormatted ? `
                <tr>
                  <td style="padding:4px 0;color:#6b7280;padding-top:10px;border-top:1px solid #e5e7eb">Estimert pris</td>
                  <td style="padding:4px 0;font-weight:700;font-size:16px;color:#e2520a;padding-top:10px;border-top:1px solid #e5e7eb">${totalFormatted}</td>
                </tr>` : ""}
              </table>
            </div>

            <p style="color:#6b7280;font-size:13px;margin:0 0 20px">
              Prisen er et estimat og kan justeres etter videre befaring og dialog.
            </p>

            <p style="color:#374151;margin:0 0 4px">Har du spørsmål? Ta gjerne kontakt:</p>
            <p style="color:#374151;margin:0">
              📞 <a href="tel:+4747617563" style="color:#e2520a">Christian: +47 476 17 563</a><br>
              📞 <a href="tel:+4791344486" style="color:#e2520a">Ola: +47 913 44 486</a><br>
              ✉️ <a href="mailto:post@garasjeproffen.no" style="color:#e2520a">post@garasjeproffen.no</a>
            </p>

            <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb">
            <p style="color:#9ca3af;font-size:12px;margin:0">GarasjeProffen AS · Gangstøvegen 9, 4344 Bryne</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("soknadshjelp-approved error:", err);
    return NextResponse.json({ success: false, error: "Noe gikk galt" }, { status: 500 });
  }
}
