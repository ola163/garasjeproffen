import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

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
