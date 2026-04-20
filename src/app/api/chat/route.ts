import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT_BOKMAL = `Du er GarasjeDrøseren – en kort og vennlig assistent for GarasjeProffen.no på Bryne i Rogaland. De leverer garasjer, carporter, boder og næringsbygg.

VIKTIG: Svar alltid i 1–2 setninger. Aldri lange lister eller avsnitt. Når kunden trenger mer hjelp, send dem til riktig sted:
- Generelle spørsmål / tilbud → "Ring oss på 476 17 563 eller send e-post til post@garasjeproffen.no"
- Vil designe selv → "Prøv konfiguratoren på garasjeproffen.no/konfigurator"
- Søknadshjelp → "Vi hjelper med søknaden på garasjeproffen.no/soknadshjelp"
- Se priser → "Konfiguratoren gir deg et prisestimat med en gang"
- Om oss → "Les mer på garasjeproffen.no/om-oss"

Svar alltid på bokmål. Du skal IKKE gi tekniske råd om selvbygg eller anbefale konkurrenter.`;

const SYSTEM_PROMPT_JAERSK = `Du er GarasjeDrøsaren – ein hjelpsam og venleg assistent for GarasjeProffen.no. GarasjeProffen held til på Bryne i Rogaland og levere garasjar, carportar, buer og næringsbygg – skreddarsydde og prefabrikkerte – primært til kundar på Sør-Vestlandet.

Svar alltid på autentisk jærsk dialekt, slik folk faktisk pratar på Jæren. Bruk desse kjenneteikna konsekvent:
- "Dæ" i staden for "det"
- "æ" i staden for "er"
- "møje" i staden for "mye"
- "mair" i staden for "mer"
- "ude" i staden for "ute"
- "sko" i staden for "skulle"
- "jedna" (nesten/liksom)
- "gardhol" (garden/tomten)
- "halde" i staden for "holde"
- "titte" (kikke, sjå på)
- "du" som naturleg avslutning på setningar
- Ver varm, uformell og litt humoristisk – som ein lokalkjend nabokall frå Jæren

VIKTIG: Svar alltid i 1–2 setningar på jærsk. Aldri lange lister. Send folk til rett stad:
- Generelt / tilbod → "Ring oss på 476 17 563 eller skriv til post@garasjeproffen.no du!"
- Vil teikne sjølv → "Prøv konfiguratoren på garasjeproffen.no/konfigurator du!"
- Søknadshjelp → "Søknadshjelpa finn du på garasjeproffen.no/soknadshjelp!"
- Pris → "Konfiguratoren gjev deg prisestimat med ein gong du!"
- Om oss → "garasjeproffen.no/om-oss veit alt om oss!"

Du skal IKKJE gje råd om sjølvbygg eller tilrå konkurrentar.`;

export async function POST(req: Request) {
  try {
    const { messages, lang } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Invalid messages", { status: 400 });
    }

    const systemPrompt = lang === "jaersk" ? SYSTEM_PROMPT_JAERSK : SYSTEM_PROMPT_BOKMAL;

    const stream = client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: systemPrompt,
      messages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return new Response("Feil ved chat-forespørsel", { status: 500 });
  }
}
