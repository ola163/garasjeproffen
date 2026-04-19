import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const address = formData.get("address") as string;
    const message = formData.get("message") as string;
    const files = formData.getAll("files") as File[];

    if (!name || !email || !address) {
      return NextResponse.json({ success: false, error: "Navn, e-post og adresse er påkrevd." }, { status: 400 });
    }

    // Upload attachments to Supabase Storage
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const attachmentUrls: string[] = [];
    if (sbUrl && sbKey && files.length > 0) {
      const sb = createClient(sbUrl, sbKey);
      for (const file of files) {
        if (!file.name) continue;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const path = `kontakt/${Date.now()}-${file.name}`;
        const { error } = await sb.storage.from("quote-attachments").upload(path, buffer, { contentType: file.type, upsert: true });
        if (!error) {
          const { data } = sb.storage.from("quote-attachments").getPublicUrl(path);
          attachmentUrls.push(data.publicUrl);
        } else {
          console.error("Attachment upload error:", error.message);
        }
      }
    }

    // Save to Supabase and get reference number back
    let referenceNumber = `KON-${Date.now()}`;
    if (sbUrl && sbKey) {
      const sb = createClient(sbUrl, sbKey);
      const { data, error: dbErr } = await sb.from("contacts").insert({
        name, email,
        phone: phone || null,
        address,
        message: message || null,
        attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
      }).select("reference_number").single();
      if (dbErr) console.error("Supabase contact insert error:", dbErr.message);
      if (data?.reference_number) referenceNumber = data.reference_number;
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);

      // Email to admin
      const adminEmail = resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: "post@garasjeproffen.no",
        subject: `Kontakthenvendelse – ${name} (${referenceNumber})`,
        html: `
          <h2>Ny kontakthenvendelse</h2>
          <p><strong>Referansenummer:</strong> ${referenceNumber}</p>
          <table>
            <tr><td><strong>Navn:</strong></td><td>${name}</td></tr>
            <tr><td><strong>E-post:</strong></td><td>${email}</td></tr>
            <tr><td><strong>Telefon:</strong></td><td>${phone || "–"}</td></tr>
            <tr><td><strong>Adresse:</strong></td><td>${address}</td></tr>
          </table>
          <h3>Melding</h3>
          <p>${(message || "–").replace(/\n/g, "<br>")}</p>
          ${attachmentUrls.length > 0 ? `
          <h3>Vedlegg (${attachmentUrls.length})</h3>
          <ul>
            ${attachmentUrls.map((url) => {
              const name = decodeURIComponent(url.split("/").pop() ?? url);
              return `<li><a href="${url}" style="color:#e2520a">${name}</a></li>`;
            }).join("")}
          </ul>` : ""}
        `,
      });

      // Confirmation to customer
      const customerEmail = resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: email,
        subject: `Bekreftelse på din henvendelse – ${referenceNumber}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#ea580c">Takk for din henvendelse!</h2>
            <p>Hei ${name},</p>
            <p>Vi har mottatt din melding og tar kontakt med deg så snart som mulig.</p>
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:20px 0">
              <p style="margin:0;font-size:13px;color:#9a3412">Ditt referansenummer</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:bold;color:#ea580c;font-family:monospace">${referenceNumber}</p>
            </div>
            ${message ? `<h3 style="color:#374151">Din melding</h3><p style="font-size:14px;color:#374151">${message.replace(/\n/g, "<br>")}</p>` : ""}
            <p style="font-size:13px;color:#6b7280;margin-top:24px">
              Med vennlig hilsen<br><strong>GarasjeProffen</strong><br>
              post@garasjeproffen.no · +47 476 17 563
            </p>
          </div>
        `,
      });

      await Promise.all([adminEmail, customerEmail]);
    } else {
      console.error("RESEND_API_KEY not set – emails not sent");
    }

    return NextResponse.json({ success: true, referenceNumber });
  } catch (err) {
    console.error("Kontakt API error:", err);
    return NextResponse.json({ success: false, error: "Noe gikk galt. Prøv igjen." }, { status: 500 });
  }
}
