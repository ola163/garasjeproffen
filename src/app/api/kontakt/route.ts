import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const { name, email, phone, address, message } = await request.json();

    if (!name || !email || !address) {
      return NextResponse.json({ success: false, error: "Navn, e-post og adresse er påkrevd." }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);
      const result = await resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: "post@garasjeproffen.no",
        subject: `Kontakthenvendelse – ${name}`,
        html: `
          <h2>Ny kontakthenvendelse</h2>
          <table>
            <tr><td><strong>Navn:</strong></td><td>${name}</td></tr>
            <tr><td><strong>E-post:</strong></td><td>${email}</td></tr>
            <tr><td><strong>Telefon:</strong></td><td>${phone || "–"}</td></tr>
            <tr><td><strong>Adresse:</strong></td><td>${address}</td></tr>
          </table>
          <h3>Melding</h3>
          <p>${(message || "–").replace(/\n/g, "<br>")}</p>
        `,
      });
      console.log("Kontakt Resend result:", JSON.stringify(result));
    } else {
      console.error("RESEND_API_KEY not set – kontakt email not sent");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Kontakt API error:", err);
    return NextResponse.json({ success: false, error: "Noe gikk galt. Prøv igjen." }, { status: 500 });
  }
}
