import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { validateFile, MAX_FILE_SIZE, MAX_TOTAL_SIZE } from "@/lib/file-validation";
import { logSecurityEvent } from "@/lib/security-log";

// Minimal HTML-escape to prevent injection in email templates
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const PHONE_RE = /^[\+\d][\d\s\-\(\)]{5,18}$/;

const USER_ERROR = "Vi kunne ikke bekrefte innsendingen. Prøv igjen, eller kontakt oss direkte på post@garasjeproffen.no.";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  try {
    const formData = await request.formData();

    // ── Honeypot ─────────────────────────────────────────────────────────────
    // Hidden field that real users never fill. If it has a value, it's a bot.
    const honeypot = (formData.get("website") as string | null) ?? "";
    if (honeypot) {
      logSecurityEvent({ type: "contact_honeypot", result: "blocked", ip, form: "kontakt" });
      // Return fake success — don't reveal the defence
      return NextResponse.json({ success: true, referenceNumber: "GPK-OK" });
    }

    const name    = ((formData.get("name")    as string | null) ?? "").trim();
    const email   = ((formData.get("email")   as string | null) ?? "").trim();
    const phone   = ((formData.get("phone")   as string | null) ?? "").trim();
    const address = ((formData.get("address") as string | null) ?? "").trim();
    const message = ((formData.get("message") as string | null) ?? "").trim();
    const files   = formData.getAll("files") as File[];

    // ── Server-side field validation ──────────────────────────────────────────
    if (!name || !email) {
      return NextResponse.json({ success: false, error: "Navn og e-post er påkrevd." }, { status: 400 });
    }

    if (name.length > 200) {
      return NextResponse.json({ success: false, error: USER_ERROR }, { status: 400 });
    }

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ success: false, error: "Ugyldig e-postadresse." }, { status: 400 });
    }

    if (phone && !PHONE_RE.test(phone)) {
      return NextResponse.json({ success: false, error: "Ugyldig telefonnummer." }, { status: 400 });
    }

    if (message.length > 3000) {
      return NextResponse.json({ success: false, error: "Meldingen er for lang (maks 3000 tegn)." }, { status: 400 });
    }

    // ── Link-spam detection ───────────────────────────────────────────────────
    const linkCount = (message.match(/https?:\/\//gi) ?? []).length;
    if (linkCount > 3) {
      logSecurityEvent({ type: "contact_spam", result: "blocked", reason: `${linkCount} links`, ip, form: "kontakt" });
      return NextResponse.json({ success: true, referenceNumber: "GPK-OK" });
    }

    // ── File size validation ──────────────────────────────────────────────────
    const realFiles = files.filter((f) => f.name && f.size > 0);
    const totalSize = realFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { success: false, error: `Totalt filstørrelse overstiger grensen (maks ${MAX_TOTAL_SIZE / 1024 / 1024} MB).` },
        { status: 400 },
      );
    }
    for (const f of realFiles) {
      if (f.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: `Filen "${esc(f.name)}" er for stor (maks ${MAX_FILE_SIZE / 1024 / 1024} MB).` },
          { status: 400 },
        );
      }
    }

    // ── Upload attachments to Supabase Storage ────────────────────────────────
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const attachmentUrls: string[] = [];
    if (sbUrl && sbKey && realFiles.length > 0) {
      const sb = createClient(sbUrl, sbKey);
      for (const file of realFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const validation = await validateFile(buffer, file.name, file.type);
        if (!validation.valid) {
          logSecurityEvent({ type: "file_rejected", result: "blocked", reason: validation.reason, ip, form: "kontakt" });
          return NextResponse.json({ success: false, error: validation.reason }, { status: 400 });
        }
        const safeName = file.name
          .normalize("NFD").replace(/[̀-ͯ]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .replace(/-+/g, "-");
        const path = `kontakt/${Date.now()}-${safeName}`;
        const { error } = await sb.storage.from("quote-attachments").upload(path, buffer, { contentType: file.type, upsert: true });
        if (!error) {
          const { data } = sb.storage.from("quote-attachments").getPublicUrl(path);
          attachmentUrls.push(data.publicUrl);
        } else {
          console.error("Attachment upload error:", error.message);
        }
      }
    }

    // ── Save to Supabase ──────────────────────────────────────────────────────
    let referenceNumber = `GPK-${Date.now()}`;
    if (sbUrl && sbKey) {
      const sb = createClient(sbUrl, sbKey);
      const { data: ticketData } = await sb.rpc("next_contact_ticket_number");
      if (ticketData) referenceNumber = ticketData as string;
      const { data, error: dbErr } = await sb.from("contacts").insert({
        name, email,
        phone: phone || null,
        address: address || null,
        message: message || null,
        attachments: attachmentUrls.length > 0 ? attachmentUrls : null,
        reference_number: referenceNumber,
      }).select("reference_number").single();
      if (dbErr) {
        console.error("Supabase contact insert error:", dbErr.message);
        return NextResponse.json({ success: false, error: USER_ERROR }, { status: 500 });
      }
      if (data?.reference_number) referenceNumber = data.reference_number;
    }

    // ── Send emails ───────────────────────────────────────────────────────────
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const resend = new Resend(resendKey);

      const adminEmail = resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: "post@garasjeproffen.no",
        subject: `Kontakthenvendelse – ${esc(name)} (${referenceNumber})`,
        html: `
          <h2>Ny kontakthenvendelse</h2>
          <p><strong>Referansenummer:</strong> ${referenceNumber}</p>
          <table>
            <tr><td><strong>Navn:</strong></td><td>${esc(name)}</td></tr>
            <tr><td><strong>E-post:</strong></td><td>${esc(email)}</td></tr>
            <tr><td><strong>Telefon:</strong></td><td>${esc(phone || "–")}</td></tr>
            <tr><td><strong>Adresse:</strong></td><td>${esc(address || "–")}</td></tr>
          </table>
          <h3>Melding</h3>
          <p>${esc(message || "–").replace(/\n/g, "<br>")}</p>
          ${attachmentUrls.length > 0 ? `
          <h3>Vedlegg (${attachmentUrls.length})</h3>
          <ul>
            ${attachmentUrls.map((url) => {
              const fname = decodeURIComponent(url.split("/").pop() ?? url);
              return `<li><a href="${esc(url)}" style="color:#e2520a">${esc(fname)}</a></li>`;
            }).join("")}
          </ul>` : ""}
        `,
      });

      const customerEmail = resend.emails.send({
        from: "GarasjeProffen <noreply@garasjeproffen.no>",
        to: email,
        subject: `Bekreftelse på din henvendelse – ${referenceNumber}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#ea580c">Takk for din henvendelse!</h2>
            <p>Hei ${esc(name)},</p>
            <p>Vi har mottatt din melding og tar kontakt med deg så snart som mulig.</p>
            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:20px 0">
              <p style="margin:0;font-size:13px;color:#9a3412">Ditt referansenummer</p>
              <p style="margin:4px 0 0;font-size:24px;font-weight:bold;color:#ea580c;font-family:monospace">${referenceNumber}</p>
            </div>
            ${message ? `<h3 style="color:#374151">Din melding</h3><p style="font-size:14px;color:#374151">${esc(message).replace(/\n/g, "<br>")}</p>` : ""}
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

    logSecurityEvent({ type: "contact_ok", result: "ok", ip, form: "kontakt" });
    return NextResponse.json({ success: true, referenceNumber });
  } catch (err) {
    console.error("Kontakt API error:", err);
    return NextResponse.json({ success: false, error: USER_ERROR }, { status: 500 });
  }
}
