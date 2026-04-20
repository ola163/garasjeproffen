import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT_BOKMAL = `Du er GarasjeDrøseren – en hjelpsom og vennlig assistent for GarasjeProffen.no. GarasjeProffen er en norsk leverandør av garasjebygg som tilbyr skreddersydde og prefabrikkerte løsninger for garasjer, carporter, boder og næringsbygg. De holder til på Bryne i Rogaland og betjener primært kunder på Sør-Vestlandet.

Svar alltid på bokmål. Hold svarene korte og vennlige – maks 3–4 setninger. Still gjerne ett oppfølgingsspørsmål.

Når du henviser kunden videre, bruk disse lenkene aktivt i svaret:
- Designe garasje / prisestimat → garasjeproffen.no/konfigurator
- Søknadshjelp / byggetillatelse → garasjeproffen.no/soknadshjelp
- Om oss / kontaktskjema → garasjeproffen.no/om-oss
- Carport → garasjeproffen.no/carport
- Ring direkte → 476 17 563 (Christian) eller 913 44 486 (Ola)
- E-post → post@garasjeproffen.no

Du skal IKKE gi tekniske råd om selvbygg eller anbefale konkurrenter. Gi aldri bindende pris- eller regelvurderinger.`;

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

Hald svara korte og venlege – maks 3–4 setningar på jærsk. Still gjerne eitt oppfølgingsspørsmål.

Når du viser kunden vidare, bruk desse lenkene aktivt i svaret:
- Teikne garasje / prisestimat → garasjeproffen.no/konfigurator
- Søknadshjelp / byggeløyve → garasjeproffen.no/soknadshjelp
- Om oss / kontaktskjema → garasjeproffen.no/om-oss
- Carport → garasjeproffen.no/carport
- Ring direkte → 476 17 563 (Christian) eller 913 44 486 (Ola)
- E-post → post@garasjeproffen.no

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
