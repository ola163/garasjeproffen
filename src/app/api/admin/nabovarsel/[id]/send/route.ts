import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

function esc(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function nabovarselHtml(opts: {
  naboNavn: string;
  sokerNavn: string;
  eiendomAdresse: string;
  tiltaket: string;
  gnr: number | null; bnr: number | null; kommunenr: string | null;
  frist: string;
  attachmentLinks: string[];
}) {
  const { naboNavn, sokerNavn, eiendomAdresse, tiltaket, gnr, bnr, kommunenr, frist, attachmentLinks } = opts;
  const matrikkel = (gnr && bnr) ? `gnr. ${gnr} bnr. ${bnr}${kommunenr ? ` i kommune ${kommunenr}` : ""}` : eiendomAdresse;
  const fristDate = new Date(frist).toLocaleDateString("nb-NO", { day: "2-digit", month: "long", year: "numeric" });

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1f2937">
  <div style="background:#ea580c;padding:24px 32px">
    <h1 style="margin:0;font-size:20px;color:#fff">Nabovarsel</h1>
    <p style="margin:4px 0 0;font-size:13px;color:#fed7aa">i henhold til plan- og bygningsloven § 21-3</p>
  </div>
  <div style="padding:32px;background:#fff;border:1px solid #e5e7eb;border-top:none">
    <p>Hei ${esc(naboNavn)},</p>
    <p>
      Du varsles herved som nabo i henhold til plan- og bygningsloven § 21-3 og SAK10 § 5-2 om følgende byggetiltak:
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600;width:40%">Søker / tiltakshaver</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(sokerNavn)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Eiendom</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(eiendomAdresse)}${matrikkel !== eiendomAdresse ? `<br><span style="color:#6b7280;font-size:12px">${esc(matrikkel)}</span>` : ""}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Tiltak</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb">${esc(tiltaket)}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;font-weight:600">Merknadsfrist</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;color:#ea580c">${fristDate}</td>
      </tr>
    </table>

    <h3 style="margin-top:24px;margin-bottom:8px;font-size:15px">Tegninger og dokumenter</h3>
    ${attachmentLinks.length > 0
      ? `<ul style="margin:0;padding-left:20px">${attachmentLinks.map(url => {
          const name = decodeURIComponent(url.split("/").pop() ?? url).replace(/^\d+-[a-z0-9]+-/, "");
          return `<li style="margin-bottom:4px"><a href="${url}" style="color:#ea580c">${name}</a></li>`;
        }).join("")}</ul>`
      : `<p style="color:#6b7280;font-size:13px">Tegninger ettersendes på forespørsel til post@garasjeproffen.no</p>`
    }

    <div style="margin-top:28px;padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;font-size:13px">
      <strong>Merknad:</strong> Dersom du har merknader til tiltaket, må disse sendes skriftlig til
      <a href="mailto:post@garasjeproffen.no" style="color:#ea580c">post@garasjeproffen.no</a>
      innen <strong>${fristDate}</strong>.
      <br><br>
      Har du ingen merknader er det ikke nødvendig å svare på dette varselet.
      <br><br>
      Manglende svar innen fristen regnes ikke som godkjenning, men søknaden vil bli fremmet uansett.
    </div>

    <p style="margin-top:28px;font-size:13px;color:#6b7280">
      Dette varselet er sendt digitalt av GarasjeProffen AS på vegne av tiltakshaver.<br>
      Spørsmål kan rettes til <a href="mailto:post@garasjeproffen.no" style="color:#ea580c">post@garasjeproffen.no</a>
      eller +47 476 17 563.
    </p>
  </div>
</div>`;
}

// POST /api/admin/nabovarsel/[id]/send
// body: { naboIds?: string[] }  — omit to send to all with epost that haven't been sent
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const jar = await cookies();
  if (jar.get("gp-admin")?.value !== "1")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { naboIds?: string[]; isPurring?: boolean };
  const isPurring = body.isPurring === true;

  const client = sb();

  // Load nabovarsel case
  const { data: nv, error: nvErr } = await client
    .from("nabovarsel")
    .select("*, nabovarsel_naboer(*)")
    .eq("id", id)
    .single();
  if (nvErr || !nv) return NextResponse.json({ error: "Ikke funnet" }, { status: 404 });

  // Load quote for customer name + attachments
  let sokerNavn = "GarasjeProffen-kunde";
  let attachmentLinks: string[] = [];
  if (nv.quote_id) {
    const { data: quote } = await client
      .from("quotes")
      .select("customer_name, attachments")
      .eq("id", nv.quote_id)
      .single();
    if (quote) {
      sokerNavn = quote.customer_name ?? sokerNavn;
      attachmentLinks = (quote.attachments as string[] | null) ?? [];
    }
  }

  type Nabo = {
    id: string; eier_epost: string | null; eier_navn: string | null;
    status: string; sendt_at: string | null; purring_sendt_at: string | null;
  };
  const naboer = (nv.nabovarsel_naboer as Nabo[]) ?? [];

  // Filter to targets
  let targets = naboer.filter(n => n.eier_epost);
  if (body.naboIds?.length) {
    targets = targets.filter(n => body.naboIds!.includes(n.id));
  } else if (isPurring) {
    targets = targets.filter(n => n.status === "sendt" && !n.purring_sendt_at);
  } else {
    targets = targets.filter(n => n.status === "ikke_sendt");
  }

  if (targets.length === 0)
    return NextResponse.json({ sent: 0, message: "Ingen mottakere å sende til" });

  const resend = new Resend(process.env.RESEND_API_KEY!);
  const frist = nv.frist ?? new Date(Date.now() + 14 * 86400_000).toISOString();

  let sent = 0;
  const errors: string[] = [];

  for (const nabo of targets) {
    const html = nabovarselHtml({
      naboNavn: nabo.eier_navn || "Nabo/Nabolagseier",
      sokerNavn,
      eiendomAdresse: nv.adresse ?? "",
      tiltaket: nv.tiltaket ?? "Garasje",
      gnr: nv.gnr, bnr: nv.bnr, kommunenr: nv.kommunenr,
      frist,
      attachmentLinks,
    });

    const subject = isPurring
      ? `Purring: Nabovarsel – ${nv.adresse ?? "garasjeprosjekt"}`
      : `Nabovarsel – ${nv.adresse ?? "garasjeprosjekt"}`;

    const { error: sendErr } = await resend.emails.send({
      from: "GarasjeProffen <noreply@garasjeproffen.no>",
      to: nabo.eier_epost!,
      subject,
      html,
    });

    if (sendErr) {
      errors.push(`${nabo.eier_epost}: ${sendErr.message}`);
    } else {
      sent++;
      const now = new Date().toISOString();
      const update = isPurring
        ? { status: "purring_sendt", purring_sendt_at: now }
        : { status: "sendt", sendt_at: now };
      await client.from("nabovarsel_naboer").update(update).eq("id", nabo.id);
    }
  }

  // Update parent nabovarsel status
  const allNaboer = await client.from("nabovarsel_naboer").select("status").eq("nabovarsel_id", id);
  const statuses = (allNaboer.data ?? []).map((n: { status: string }) => n.status);
  const allSent = statuses.every(s => s !== "ikke_sendt");
  if (allSent && nv.status === "utkast") {
    await client.from("nabovarsel").update({ status: isPurring ? "purring_sendt" : "sendt" }).eq("id", id);
  }

  return NextResponse.json({ sent, errors });
}
