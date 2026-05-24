import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
    }

    const { name, email, phone, address, dibk, dibkComments, garageConfig, permitResult, permit, total, drawingCost, drawingSelections } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Navn er påkrevd." }, { status: 400 });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Gyldig e-post er påkrevd." }, { status: 400 });
    }

    function esc(s: unknown): string {
      return String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
    }

    const resendKey = process.env.RESEND_API_KEY;

    if (resendKey) {
      const resend = new Resend(resendKey);

      const dibkRows = dibk
        ? Object.entries(dibk as Record<string, string>)
            .filter(([k]) => !k.endsWith("~"))
            .map(([k, v]) => `<tr><td><strong>${esc(k)}:</strong></td><td>${esc(v) || "–"}</td></tr>`)
            .join("")
        : "";

      const garageRows = garageConfig
        ? `
          <tr><td><strong>Lengde:</strong></td><td>${Number(garageConfig.lengthMm) / 1000} m</td></tr>
          <tr><td><strong>Bredde:</strong></td><td>${Number(garageConfig.widthMm) / 1000} m</td></tr>
          <tr><td><strong>Portbredde:</strong></td><td>${Number(garageConfig.doorWidthMm)} mm</td></tr>
          <tr><td><strong>Porthøyde:</strong></td><td>${Number(garageConfig.doorHeightMm)} mm</td></tr>
        `
        : "<tr><td colspan='2'>Ikke spesifisert</td></tr>";

      await resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: "post@garasjeproffen.no",
        replyTo: email,
        subject: `Søknadshjelp-forespørsel – ${esc(name)}`,
        html: `
          <h2>Ny forespørsel via Søknadshjelp</h2>

          <h3>Kunde</h3>
          <table>
            <tr><td><strong>Navn:</strong></td><td>${esc(name)}</td></tr>
            <tr><td><strong>E-post:</strong></td><td>${esc(email)}</td></tr>
            <tr><td><strong>Telefon:</strong></td><td>${esc(phone) || "–"}</td></tr>
            <tr><td><strong>Adresse/tomt:</strong></td><td>${esc(address) || "–"}</td></tr>
          </table>

          <h3>Garasjekonfigurasjon</h3>
          <table>${garageRows}</table>

          <h3>DIBK-svar</h3>
          <table>${dibkRows}</table>

          <h3>Tegninger</h3>
          <table>
            ${drawingSelections?.choice === "have-drawings"
              ? `<tr><td>Har tegninger fra før</td></tr>`
              : drawingSelections?.choice === "need-help"
                ? `
                  <tr><td><strong>Bestilt:</strong></td><td>${
                    drawingSelections.hasExistingDrawings === true ? "Kun garasjen (har eksisterende tegninger)" :
                    drawingSelections.hasExistingDrawings === false ? "Garasje + eksisterende bebyggelse" :
                    drawingSelections.garasjeType === "kun-garasje" ? "Kun garasjen" :
                    drawingSelections.garasjeType === "garasje-eksisterende" ? "Garasje + eksisterende bebyggelse" : "–"
                  }</td></tr>
                  <tr><td><strong>Situasjonsplan:</strong></td><td>${drawingSelections.withSituasjonsplan ? "Ja" : "Nei"}</td></tr>
                  <tr><td><strong>Pris tegninger:</strong></td><td>${(drawingCost ?? 0).toLocaleString("nb-NO")} kr</td></tr>
                `
                : `<tr><td>Ingen tegningsvalg registrert</td></tr>`
            }
          </table>

          <h3>Søknadsresultat</h3>
          <p><strong>${esc(permitResult) || "–"}</strong></p>

          <h3>Prisestimat</h3>
          <table>
            <tr><td><strong>Søknadshjelp:</strong></td><td>${(permit ?? 0).toLocaleString("nb-NO")} kr</td></tr>
            <tr><td><strong>Totalt:</strong></td><td><strong>${(total ?? 0).toLocaleString("nb-NO")} kr</strong></td></tr>
          </table>
        `,
      });
    } else {
      console.error("RESEND_API_KEY is not set – soknadshjelp email not sent");
    }

    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (sbUrl && sbKey) {
      const sb = createClient(sbUrl, sbKey);

      // Fetch drawing prices to pre-populate extra_costs for admin tilbudsbygger
      const { data: priserData } = await sb.from("soknadshjelp_priser").select("key, price");
      const priser: Record<string, number> = {};
      for (const p of (priserData ?? [])) priser[p.key] = p.price;
      const pKunGarasje      = priser["tegning_kun_garasje"]      ?? 5000;
      const pMedEksisterende = priser["tegning_med_eksisterende"]  ?? 10000;
      const pSituasjonsplan  = priser["tegning_situasjonsplan"]    ?? 1500;

      const drawingExtraCosts: { description: string; amount: number }[] = [];
      if (drawingSelections?.choice === "need-help") {
        if (drawingSelections.garasjeType === "kun-garasje" || drawingSelections.hasExistingDrawings === true) {
          drawingExtraCosts.push({ description: "Kun garasjen", amount: pKunGarasje });
        } else if (drawingSelections.garasjeType === "garasje-eksisterende" || drawingSelections.hasExistingDrawings === false) {
          drawingExtraCosts.push({ description: "Garasje + eksisterende bebyggelse", amount: pMedEksisterende });
        }
        if (drawingSelections.withSituasjonsplan) {
          drawingExtraCosts.push({ description: "Situasjonsplan", amount: pSituasjonsplan });
        }
      }

      const { data: ticketData } = await sb.rpc("next_ticket_number");
      const ticketNumber = (ticketData as string) ?? `Q-${Date.now()}`;
      await sb.from("soknadshjelp").insert({
        ticket_number: ticketNumber,
        customer_name: name.trim(),
        customer_email: email.trim(),
        customer_phone: phone || null,
        address: address || null,
        dibk: dibk || null,
        dibk_comments: dibkComments && Object.keys(dibkComments).length > 0 ? dibkComments : null,
        garage_config: garageConfig || null,
        permit_result: permitResult || null,
        permit_price: permit ?? null,
        total_price: total ?? null,
        extra_costs: drawingExtraCosts.length > 0 ? drawingExtraCosts : null,
        status: "new",
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Soknadshjelp API error:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
