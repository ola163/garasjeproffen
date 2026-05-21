import { NextResponse } from "next/server";
import { Resend } from "resend";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

const DIBK_LABELS: Record<string, string> = {
  frittstående: "Frittstående bygg",
  bya50: "BYA under 50 m²",
  enEtasje: "Én etasje",
  monehoyde: "Mønehøyde OK",
  nabogrense: "Nabogrense OK",
  avstandBygg: "Avstand til bygg OK",
  ikkeVernet: "Ikke vernede omgivelser",
  ikkeFlom: "Ikke flomutsatt",
  lnf: "LNF-område",
  kjeller: "Kjeller",
};

function isDisp(key: string, value: string) {
  if (key === "lnf") return value === "Ja";
  return ["frittstående","bya50","enEtasje","monehoyde","nabogrense","avstandBygg","ikkeVernet","ikkeFlom"].includes(key) && value === "Nei";
}

function fmt(n: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      approverEmail: string;
      approverName: string;
      requesterName: string;
      ticketNumber: string;
      customerName: string;
      customerEmail?: string;
      customerPhone?: string;
      address?: string;
      totalPrice: number;
      permitPrice?: number;
      permitResult?: string;
      extraCosts?: { description: string; amount: number }[];
      manualDisps?: { description: string; amount: number }[];
      dibk?: Record<string, string>;
      dibkAdminComments?: Record<string, string>;
      customerNotes?: string;
      soknadshjelId: string;
    };

    const { approverEmail, approverName, requesterName, ticketNumber, customerName,
      customerEmail, customerPhone, address, totalPrice, permitPrice, permitResult,
      extraCosts, manualDisps, dibk, dibkAdminComments, customerNotes, soknadshjelId } = body;

    if (!ALLOWED_ADMINS.includes((approverEmail ?? "").toLowerCase())) {
      return NextResponse.json({ success: false, error: "Ugyldig godkjenner" }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ success: false, error: "RESEND_API_KEY mangler" }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.garasjeproffen.no";
    const caseUrl = `${siteUrl}/admin/soknadshjelp/${soknadshjelId}`;

    const dibkRows = dibk
      ? Object.entries(dibk)
          .filter(([k]) => !k.endsWith("~"))
          .map(([k, v]) => {
            const disp = isDisp(k, v);
            const color = disp ? "#dc2626" : v === "Ja" ? "#16a34a" : "#6b7280";
            const bg = disp ? "#fef2f2" : "transparent";
            return `<tr style="background:${bg}">
              <td style="padding:3px 0;color:#374151">${esc(DIBK_LABELS[k] ?? k)}</td>
              <td style="padding:3px 0;font-weight:600;color:${color}">${esc(v)}${disp ? " <span style=\"font-size:10px;color:#dc2626\">(disp.)</span>" : ""}</td>
              ${dibkAdminComments?.[k] ? `<td style="padding:3px 0;font-size:12px;color:#9a3412">${esc(dibkAdminComments[k])}</td>` : "<td></td>"}
            </tr>`;
          }).join("")
      : "";

    const dispRows = (manualDisps ?? []).map(d =>
      `<tr><td style="padding:3px 0;color:#374151"><span style="background:#fee2e2;color:#dc2626;font-size:11px;padding:1px 4px;border-radius:3px;margin-right:4px">Disp.</span>${esc(d.description)}</td><td style="padding:3px 0;text-align:right;font-weight:600">${fmt(d.amount)}</td></tr>`
    ).join("");

    const extraRows = (extraCosts ?? []).map(c =>
      `<tr><td style="padding:3px 0;color:#374151">${esc(c.description)}</td><td style="padding:3px 0;text-align:right;font-weight:600">${fmt(c.amount)}</td></tr>`
    ).join("");

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "GarasjeProffen <noreply@garasjeproffen.no>",
      to: approverEmail,
      subject: `Godkjenning forespurt – søknadshjelp ${ticketNumber}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111827">
          <h2 style="color:#e2520a;margin-bottom:4px">Godkjenning av søknadshjelp forespurt</h2>
          <p style="color:#6b7280;margin-top:0">Hei ${esc(approverName)}, <strong style="color:#111827">${esc(requesterName)}</strong> ber deg gjennomgå og godkjenne denne saken.</p>

          <!-- Kunde -->
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Kunde</p>
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              <tr><td style="padding:2px 0;color:#6b7280;width:120px">Referanse</td><td style="padding:2px 0;font-family:monospace;font-weight:700">${esc(ticketNumber)}</td></tr>
              <tr><td style="padding:2px 0;color:#6b7280">Navn</td><td style="padding:2px 0;font-weight:500">${esc(customerName)}</td></tr>
              ${customerEmail ? `<tr><td style="padding:2px 0;color:#6b7280">E-post</td><td style="padding:2px 0">${esc(customerEmail)}</td></tr>` : ""}
              ${customerPhone ? `<tr><td style="padding:2px 0;color:#6b7280">Telefon</td><td style="padding:2px 0">${esc(customerPhone)}</td></tr>` : ""}
              ${address ? `<tr><td style="padding:2px 0;color:#6b7280">Adresse</td><td style="padding:2px 0">${esc(address)}</td></tr>` : ""}
              ${permitResult ? `<tr><td style="padding:2px 0;color:#6b7280">Søknadsresultat</td><td style="padding:2px 0;font-weight:500">${esc(permitResult)}</td></tr>` : ""}
              <tr><td style="padding:2px 0;color:#6b7280">Behandler</td><td style="padding:2px 0">${esc(requesterName)}</td></tr>
            </table>
          </div>

          <!-- DIBK -->
          ${dibkRows ? `
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">DIBK-svar</p>
            <table style="width:100%;font-size:13px;border-collapse:collapse">${dibkRows}</table>
          </div>` : ""}

          <!-- Pris -->
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
            <p style="margin:0 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#6b7280">Pris</p>
            <table style="width:100%;font-size:14px;border-collapse:collapse">
              ${permitPrice ? `<tr><td style="padding:3px 0;color:#374151">Søknadshjelp</td><td style="padding:3px 0;text-align:right;font-weight:600">${fmt(permitPrice)}</td></tr>` : ""}
              ${dispRows}
              ${extraRows}
              <tr style="border-top:1px solid #e5e7eb">
                <td style="padding:6px 0 2px;font-weight:700;font-size:15px">Totalt</td>
                <td style="padding:6px 0 2px;text-align:right;font-weight:700;font-size:15px">${fmt(totalPrice)}</td>
              </tr>
            </table>
          </div>

          ${customerNotes ? `
          <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:16px 0;font-size:13px;color:#92400e">
            <strong>Notat til kunde:</strong> ${esc(customerNotes)}
          </div>` : ""}

          <p style="margin-top:24px">
            <a href="${caseUrl}" style="display:inline-block;background:#e2520a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
              Åpne og godkjenn søknadshjelp
            </a>
          </p>
          <hr style="margin:32px 0;border:none;border-top:1px solid #e5e7eb">
          <p style="color:#6b7280;font-size:12px">GarasjeProffen AS · post@garasjeproffen.no</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("soknadshjelp-approval error:", err);
    return NextResponse.json({ success: false, error: "Noe gikk galt" }, { status: 500 });
  }
}
