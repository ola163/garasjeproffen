import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, address, dibk, garageConfig, permitResult, permit, total } = body;

    const resendKey = process.env.RESEND_API_KEY;
    console.log("Soknadshjelp RESEND_API_KEY present:", !!resendKey);

    if (resendKey) {
      const resend = new Resend(resendKey);

      const dibkRows = dibk
        ? Object.entries(dibk as Record<string, string>)
            .map(([k, v]) => `<tr><td><strong>${k}:</strong></td><td>${v || "–"}</td></tr>`)
            .join("")
        : "";

      const garageRows = garageConfig
        ? `
          <tr><td><strong>Lengde:</strong></td><td>${garageConfig.lengthMm / 1000} m</td></tr>
          <tr><td><strong>Bredde:</strong></td><td>${garageConfig.widthMm / 1000} m</td></tr>
          <tr><td><strong>Portbredde:</strong></td><td>${garageConfig.doorWidthMm} mm</td></tr>
          <tr><td><strong>Porthøyde:</strong></td><td>${garageConfig.doorHeightMm} mm</td></tr>
        `
        : "<tr><td colspan='2'>Ikke spesifisert</td></tr>";

      const emailResult = await resend.emails.send({
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

          <h3>Garasjekonfigurasjon</h3>
          <table>${garageRows}</table>

          <h3>DIBK-svar</h3>
          <table>${dibkRows}</table>

          <h3>Søknadsresultat</h3>
          <p><strong>${permitResult ?? "–"}</strong></p>

          <h3>Prisestimat</h3>
          <table>
            <tr><td><strong>Søknadshjelp:</strong></td><td>${(permit ?? 0).toLocaleString("nb-NO")} kr</td></tr>
            <tr><td><strong>Totalt:</strong></td><td><strong>${(total ?? 0).toLocaleString("nb-NO")} kr</strong></td></tr>
          </table>
        `,
      });
      console.log("Soknadshjelp Resend result:", JSON.stringify(emailResult));
    } else {
      console.error("RESEND_API_KEY is not set – soknadshjelp email not sent");
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Soknadshjelp API error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
