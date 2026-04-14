import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, address, answers, price } = body;

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: "post@garasjeproffen.no",
        replyTo: email,
        subject: `Søknadshjelp-forespørsel – ${name}`,
        html: `
          <h2>Ny forespørsel via Søknadshjelp</h2>

          <h3>Kunde</h3>
          <table>
            <tr><td><strong>Navn:</strong></td><td>${name}</td></tr>
            <tr><td><strong>E-post:</strong></td><td>${email}</td></tr>
            <tr><td><strong>Telefon:</strong></td><td>${phone || "–"}</td></tr>
            <tr><td><strong>Adresse/tomt:</strong></td><td>${address || "–"}</td></tr>
          </table>

          <h3>Prosjektdetaljer</h3>
          <table>
            <tr><td><strong>Bruksområde:</strong></td><td>${answers.usage}</td></tr>
            <tr><td><strong>Antall biler:</strong></td><td>${answers.cars}</td></tr>
            <tr><td><strong>Størrelse:</strong></td><td>${answers.widthM} × ${answers.lengthM} m (${answers.widthM * answers.lengthM} m²)</td></tr>
            <tr><td><strong>Flat tomt:</strong></td><td>${answers.flatLot}</td></tr>
            <tr><td><strong>Søknadshjelp:</strong></td><td>${answers.needPermit}</td></tr>
          </table>

          <h3>Prisestimat</h3>
          <table>
            <tr><td><strong>Bygg:</strong></td><td>${price.build.toLocaleString("nb-NO")} kr</td></tr>
            <tr><td><strong>Port:</strong></td><td>${price.door.toLocaleString("nb-NO")} kr</td></tr>
            ${price.permit ? `<tr><td><strong>Søknadshjelp:</strong></td><td>${price.permit.toLocaleString("nb-NO")} kr</td></tr>` : ""}
            <tr><td><strong>Totalt:</strong></td><td><strong>${price.total.toLocaleString("nb-NO")} kr</strong></td></tr>
          </table>
        `,
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
