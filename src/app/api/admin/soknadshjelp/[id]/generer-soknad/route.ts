import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Mapping from DIBK key → human-readable dispensasjon + legal basis
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

export interface GenerateRequest {
  // Property
  adresse: string;
  gnr: number | null;
  bnr: number | null;
  kommunenavn: string;
  kommunenummer: string;

  // Customer
  kundenavn: string;
  telefon: string | null;
  epost: string;

  // Building
  garType: string;        // "garasje" | "carport"
  bredde: number | null;  // width in m
  lengde: number | null;  // length in m
  taktype: string;        // "saltak" | "flattak"
  pakke: string;          // "materialpakke" | "prefab"

  // Dispensations
  dibkDisps: string[];                    // keys from DIBK where dispensasjon is triggered
  manualDisps: string[];                  // free-text from admin
  ekstraInfo: string;                     // additional context typed by admin
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const jar = await cookies();
  if (jar.get("gp-admin")?.value !== "1")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await params; // ensure params resolved

  const body: GenerateRequest = await request.json();

  const allDisps = [
    ...body.dibkDisps.map(k => DISP_INFO[k]?.tekst ?? k),
    ...body.manualDisps,
  ];

  const dispList = allDisps.map((d, i) => `${i + 1}. ${d}`).join("\n");
  const hjemler = body.dibkDisps
    .map(k => DISP_INFO[k]?.hjemmel)
    .filter(Boolean)
    .join("; ");

  const garBeskrivelse = `${body.garType === "carport" ? "carport" : "garasje"}${body.bredde && body.lengde ? ` på ${body.bredde} × ${body.lengde} m` : ""}${body.taktype ? `, ${body.taktype}` : ""}`;

  const systemPrompt = `Du er en erfaren ansvarlig søker og byggesaksrådgiver i Norge med lang erfaring fra kommunal saksbehandling. Du skriver profesjonelle, saklige og overbevisende søknader om dispensasjon fra plan- og bygningsloven på vegne av tiltakshavere. Skriv alltid på norsk bokmål. Vær konkret, juridisk presis og overbevisende uten å overdrive.`;

  const userPrompt = `Skriv en komplett begrunnelse for en søknad om dispensasjon. Begrunnelsen skal inngå i et offisielt søknadsbrev til ${body.kommunenavn} kommune.

EIENDOMSINFORMASJON:
- Adresse: ${body.adresse}
- Gnr./bnr.: ${body.gnr ?? "–"}/${body.bnr ?? "–"}, ${body.kommunenavn} kommune

TILTAKET:
- Type: ${garBeskrivelse} (${body.pakke === "prefab" ? "prefabrikert løsning" : "materialpakke"})

DISPENSASJONER DET SØKES OM:
${dispList}
${hjemler ? `\nRelevante hjemler: ${hjemler}` : ""}

${body.ekstraInfo ? `TILLEGGSINFORMASJON FRA TILTAKSHAVER:\n${body.ekstraInfo}\n` : ""}

KRAV TIL BEGRUNNELSEN:
1. Beskriv tiltaket kort og hva dispensasjonen gjelder
2. For HVER dispensasjon: forklar konkret hvorfor hensynene bak bestemmelsen IKKE vil bli vesentlig tilsidesatt (jf. pbl § 19-2 første ledd)
3. For HVER dispensasjon: argumenter for at fordelene ved dispensasjon klart overstiger ulempene (jf. pbl § 19-2 andre ledd)
4. Henvis til relevant lovverk (plan- og bygningsloven, vegloven e.l.) der det passer
5. Avslutt med en konkluderende setning om at dispensasjon bør innvilges
6. Lengde: 300–500 ord
7. Skriv i løpende tekst (ikke punktlister), men bruk avsnittsoppdeling per dispensasjon om det er flere

Skriv KUN selve begrunnelsesteksten — ingen overskrift, ingen signaturfelt.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = message.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("\n");

  return NextResponse.json({ text, dispList: allDisps });
}
