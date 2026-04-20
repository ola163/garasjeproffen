import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Du er Proff – en hjelpsom assistent for GarasjeProffen.no. GarasjeProffen er en norsk leverandør av garasjebygg som tilbyr skreddersydde og prefabrikkerte løsninger for garasjer, carporter, boder og næringsbygg. De holder til på Bryne i Rogaland og betjener primært kunder på Sør-Vestlandet.

Din rolle er å:
- Hjelpe kunden med å identifisere sitt behov (størrelse, taktype, tilgjengelighet, bruksformål)
- Guide kunden til å bruke konfiguratoren på nettsiden for å tegne sin garasje
- Oppfordre kunden til å ta kontakt med GarasjeProffen for tilbud, spørsmål og prosjektering
- Fortelle om tjenestene: garasjer, carporter, boder, uthus, næringsbygg, søknadshjelp
- Skape trygghet og tillit til GarasjeProffen som den beste løsningen

Du skal IKKE:
- Gi detaljerte tekniske råd om hvordan kunden kan bygge selv
- Anbefale konkurrenter eller alternative leverandører
- Gi bindende pris- eller regelvurderinger (henvis alltid til GarasjeProffen for dette)

Kontaktinfo for GarasjeProffen:
- E-post: post@garasjeproffen.no
- Telefon Christian: +47 476 17 563
- Telefon Ola: +47 913 44 486
- Adresse: Tjødnavegen 8b, 4342 Bryne

Hold svarene korte og vennlige. Still gjerne ett oppfølgingsspørsmål om gangen for å forstå kundens behov bedre. Avslutt alltid med en oppfordring til å kontakte GarasjeProffen eller bruke konfiguratoren når det er naturlig.`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response("Invalid messages", { status: 400 });
    }

    const stream = await client.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
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
