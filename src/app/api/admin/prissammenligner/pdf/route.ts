import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  if (cookieStore.get("admin_session")?.value === process.env.ADMIN_SESSION_SECRET) return true;
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (token) {
    const { data } = await getSupabase().auth.getUser(token);
    if (data.user?.email && ALLOWED_ADMINS.includes(data.user.email.toLowerCase())) return true;
  }
  return false;
}

interface ParsedRow {
  varenr: string;
  beskrivelse: string;
  pris: number;
  enhet?: string;
}

function parseNorwegianNumber(s: string): number {
  return parseFloat(s.replace(/\s/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
}

function parsePdfText(text: string): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  // Pattern: starts with 4-15 digit varenr, some description, ends with price
  const rowPattern = /^(\d{4,15})\s+(.+?)\s+([\d\s]*\d[\d\s]*[,.]\d{1,2})\s*$/;
  // Secondary: varenr + space + anything + space + price (no comma required)
  const loosePattern = /^(\d{4,15})\s+(.+?)\s+(\d[\d\s]*[,.]?\d{0,2})\s*$/;

  for (const line of lines) {
    // Skip header-like lines
    if (/varenr|beskrivelse|pris|enhet|mengde|totalt/i.test(line) && line.length < 80) continue;

    let match = line.match(rowPattern);
    if (!match) match = line.match(loosePattern);
    if (!match) continue;

    const [, varenr, rest, prisStr] = match;
    const pris = parseNorwegianNumber(prisStr.trim());
    if (isNaN(pris) || pris <= 0 || pris > 1_000_000) continue;

    // Try to extract unit from the rest (stk, m, m2, m3, lm, pk, ...)
    const unitMatch = rest.match(/\b(stk|m2|m3|lm|m|pk|l|kg|rll?|ss|boks)\b/i);
    const enhet = unitMatch?.[1]?.toLowerCase();
    const beskrivelse = rest.replace(/\s+\d[\d\s]*$/, "").trim();

    rows.push({ varenr, beskrivelse, pris, enhet });
  }

  return rows;
}

// POST /api/admin/prissammenligner/pdf
// body: FormData with "file" (PDF)
export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ingen fil mottatt" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Kun PDF-filer støttes" }, { status: 400 });
  }

  try {
    // Dynamic import to avoid issues with pdf-parse test file loading
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParse: any = (await import("pdf-parse") as any).default ?? (await import("pdf-parse") as any);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const result = await pdfParse(buffer);

    const rows = parsePdfText(result.text);
    return NextResponse.json({
      rows,
      rawText: result.text,
      pageCount: result.numpages,
    });
  } catch (err) {
    console.error("PDF parse error:", err);
    return NextResponse.json({ error: "Kunne ikke lese PDF-filen. Kontroller at den ikke er passordbeskyttet." }, { status: 500 });
  }
}
