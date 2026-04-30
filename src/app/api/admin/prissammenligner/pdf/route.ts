import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY ikke satt" }, { status: 503 });
  }

  try {
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Analyser denne leverandørprislisten og ekstraher ALLE produktrader med priser.

For hver rad, returner et JSON-objekt med:
- varenr: varenummer som string (kun siffer, tom streng hvis mangler)
- beskrivelse: produktbeskrivelse/varetekst som string
- pris: nettopris/enhetspris i NOK som number (0 hvis ikke funnet)
- enhet: enhet som string (f.eks. "stk", "m2", "lm", "m", "pk", "rll" – tom streng hvis mangler)

Returner KUN et JSON-array, ingen forklaringstekst. Eksempel:
[{"varenr":"12345","beskrivelse":"Gipsplate 13mm 1200x3000","pris":189.50,"enhet":"stk"},{"varenr":"67890","beskrivelse":"Mineralull 150mm","pris":245.00,"enhet":"m2"}]

Viktig:
- Bruk nettopris (ikke bruttopris) hvis begge finnes
- Ignorer rader uten pris eller uten beskrivelse
- Behold originale varenummer nøyaktig som de står
- Hvis dokumentet ikke inneholder prisliste, returner []`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return NextResponse.json({ rows: [], pageCount: 1 });

    const raw = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(raw)) return NextResponse.json({ rows: [], pageCount: 1 });

    const rows: ParsedRow[] = raw
      .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object")
      .map((item) => ({
        varenr:      String(item.varenr      ?? "").trim().slice(0, 50),
        beskrivelse: String(item.beskrivelse ?? "").slice(0, 300),
        pris:        Math.max(0, Number(item.pris) || 0),
        enhet:       String(item.enhet ?? "").slice(0, 20) || undefined,
      }))
      .filter((item) => item.beskrivelse.length > 0 && item.pris > 0)
      .slice(0, 2000);

    return NextResponse.json({ rows, pageCount: 1 });
  } catch (err) {
    console.error("PDF parse error:", err);
    const msg = err instanceof Error ? err.message : "Ukjent feil";
    return NextResponse.json({ error: `Kunne ikke lese PDF-filen: ${msg}` }, { status: 500 });
  }
}
