import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const DISP_INFO: Record<string, { tekst: string; hjemmel: string }> = {
  nabogrense: {
    tekst: "Dispensasjon fra krav til avstand til nabogrense",
    hjemmel: "plan- og bygningsloven § 29-4 og kommuneplanens bestemmelser",
  },
  avstandBygg: {
    tekst: "Dispensasjon fra krav til avstand mellom byggverk",
    hjemmel: "plan- og bygningsloven § 29-4",
  },
  bya50: {
    tekst: "Dispensasjon fra tillatt bebygd areal (BYA)",
    hjemmel: "kommuneplanens arealdel og tilhørende bestemmelser",
  },
  monehoyde: {
    tekst: "Dispensasjon fra tillatt mønehøyde",
    hjemmel: "kommuneplanens bestemmelser om byggehøyde",
  },
  enEtasje: {
    tekst: "Dispensasjon fra krav om én etasje",
    hjemmel: "kommuneplanens bestemmelser",
  },
  lnf: {
    tekst: "Dispensasjon fra LNF-formål i arealplanen",
    hjemmel: "plan- og bygningsloven § 12-5 nr. 5 og § 19-1",
  },
  ikkeVernet: {
    tekst: "Dispensasjon i tilknytning til vernede omgivelser",
    hjemmel: "plan- og bygningsloven og kulturminneloven",
  },
  ikkeFlom: {
    tekst: "Dispensasjon i flomutsatt område",
    hjemmel: "plan- og bygningsloven § 28-1",
  },
};

export interface DispensasjonSection {
  title: string;
  hjemmel: string;
  text: string;
}

export interface GenerateRequest {
  adresse: string;
  gnr: number | null;
  bnr: number | null;
  kommunenavn: string;
  kommunenummer: string;
  kundenavn: string;
  telefon: string | null;
  epost: string;
  garType: string;
  bredde: number | null;
  lengde: number | null;
  taktype: string;
  pakke: string;
  dibkDisps: string[];
  manualDisps: string[];
  ekstraInfo: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const jar = await cookies();
  if (jar.get("gp-admin")?.value !== "1")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await params;

  const body: GenerateRequest = await request.json();

  const dibkSections = body.dibkDisps.map(k => ({
    title: DISP_INFO[k]?.tekst ?? k,
    hjemmel: DISP_INFO[k]?.hjemmel ?? "",
  }));

  const manualSections = body.manualDisps.map(d => ({
    title: d,
    hjemmel: "kommuneplanens bestemmelser / reguleringsplan",
  }));

  const allSections = [...dibkSections, ...manualSections];

  const garBeskrivelse = `${body.garType === "carport" ? "carport" : "garasje"}${body.bredde && body.lengde ? ` på ${body.bredde} × ${body.lengde} m` : ""}${body.taktype ? ` med ${body.taktype}` : ""}`;

  const systemPrompt = `Du er en erfaren ansvarlig søker og byggesaksrådgiver i Norge. Du skriver profesjonelle, saklige dispensasjonssøknader til kommuner på vegne av tiltakshavere. Skriv alltid på norsk bokmål. Svar KUN med gyldig JSON.`;

  const sectionList = allSections
    .map((s, i) => `${i + 1}. "${s.title}" (hjemmel: ${s.hjemmel})`)
    .join("\n");

  const userPrompt = `Skriv begrunnelse for en dispensasjonssøknad til ${body.kommunenavn} kommune.

EIENDOM: ${body.adresse}${body.gnr ? `, gnr. ${body.gnr} bnr. ${body.bnr}` : ""}
TILTAK: ${garBeskrivelse} (${body.pakke === "prefab" ? "prefabrikert" : "materialpakke"})
${body.ekstraInfo ? `TILLEGGSINFO: ${body.ekstraInfo}` : ""}

DISPENSASJONER:
${sectionList}

Returner NØYAKTIG denne JSON-strukturen (ingen markdown, ingen forklaring):
{
  "intro": "En setning som beskriver tiltaket og formålet med søknaden.",
  "sections": [
    ${allSections.map((s) => `{
      "title": ${JSON.stringify(s.title)},
      "hjemmel": ${JSON.stringify(s.hjemmel)},
      "text": "2–4 setninger: (1) hva dispensasjonen gjelder konkret, (2) hvorfor hensynet bak bestemmelsen ikke vesentlig tilsidesettes jf. pbl § 19-2 første ledd, (3) hvorfor fordelen klart overstiger ulempen jf. pbl § 19-2 andre ledd."
    }`).join(",\n    ")}
  ],
  "conclusion": "En avsluttende setning som oppsummerer og ber om at dispensasjon innvilges."
}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const raw = message.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("");

  let parsed: { intro: string; sections: DispensasjonSection[]; conclusion: string };
  try {
    parsed = JSON.parse(raw);
  } catch {
    // fallback: wrap raw text as single section
    parsed = {
      intro: "",
      sections: allSections.map(s => ({ title: s.title, hjemmel: s.hjemmel, text: raw })),
      conclusion: "",
    };
  }

  return NextResponse.json(parsed);
}
