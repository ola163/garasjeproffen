import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Resend } from "resend";

// Force Node.js runtime so the `fs` module is available
export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "data");
const LEADS_FILE = path.join(DATA_DIR, "leads.json");

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(LEADS_FILE)) {
    fs.writeFileSync(LEADS_FILE, "[]", "utf-8");
  }
}

function readLeads(): Lead[] {
  ensureFile();
  const raw = fs.readFileSync(LEADS_FILE, "utf-8");
  try {
    return JSON.parse(raw) as Lead[];
  } catch {
    return [];
  }
}

interface Lead {
  id: string;
  date: string;
  name: string;
  email: string;
  phone: string;
  size: string;
  message: string;
}

// ── POST /api/leads ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: Partial<Lead>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ugyldig forespørsel." }, { status: 400 });
  }

  const { name, email, phone, size = "", message = "" } = body;

  if (!name || !email || !phone) {
    return NextResponse.json(
      { error: "Navn, e-post og telefon er påkrevd." },
      { status: 422 }
    );
  }

  const lead: Lead = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    name: String(name).trim(),
    email: String(email).trim(),
    phone: String(phone).trim(),
    size: String(size).trim(),
    message: String(message).trim(),
  };

  try {
    const leads = readLeads();
    leads.push(lead);
    ensureFile();
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), "utf-8");
  } catch (err) {
    console.error("Feil ved lagring av lead:", err);
    return NextResponse.json(
      { error: "Kunne ikke lagre forespørselen. Prøv igjen." },
      { status: 500 }
    );
  }

  // Send email notification (best-effort — don't fail the request if email fails)
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: "GarasjeProffen <onboarding@resend.dev>",
        to: "christian@garasjeporten.no",
        subject: `Ny garasjeforespørsel fra ${lead.name}`,
        html: `
          <h2>Ny forespørsel fra GarasjeProffen.no</h2>
          <table style="border-collapse:collapse;font-family:sans-serif;font-size:14px">
            <tr><td style="padding:6px 12px;color:#6b7280">Navn</td>      <td style="padding:6px 12px;font-weight:600">${lead.name}</td></tr>
            <tr><td style="padding:6px 12px;color:#6b7280">E-post</td>    <td style="padding:6px 12px"><a href="mailto:${lead.email}">${lead.email}</a></td></tr>
            <tr><td style="padding:6px 12px;color:#6b7280">Telefon</td>   <td style="padding:6px 12px"><a href="tel:${lead.phone}">${lead.phone}</a></td></tr>
            <tr><td style="padding:6px 12px;color:#6b7280">Størrelse</td> <td style="padding:6px 12px">${lead.size || "–"}</td></tr>
            <tr><td style="padding:6px 12px;color:#6b7280">Melding</td>   <td style="padding:6px 12px">${lead.message || "–"}</td></tr>
            <tr><td style="padding:6px 12px;color:#6b7280">Tidspunkt</td> <td style="padding:6px 12px">${new Date(lead.date).toLocaleString("nb-NO")}</td></tr>
          </table>
        `,
      });
    } catch (emailErr) {
      console.error("E-post kunne ikke sendes:", emailErr);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

// ── GET /api/leads?secret=xxx ────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.LEADS_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Ikke autorisert." }, { status: 401 });
  }

  try {
    const leads = readLeads();
    return NextResponse.json(leads, { status: 200 });
  } catch (err) {
    console.error("Feil ved lesing av leads:", err);
    return NextResponse.json(
      { error: "Kunne ikke lese leads." },
      { status: 500 }
    );
  }
}
