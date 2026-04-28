import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  if (cookieStore.get("gp-admin")?.value !== "1") {
    return new Response("Unauthorized", { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return new Response("Ingen fil", { status: 400 });
  if (file.type !== "application/pdf") return new Response("Kun PDF støttes", { status: 400 });

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  const anthropic = new Anthropic();

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
            text: `Analyser dette PDF-dokumentet og ekstraher ALLE varelinjer, materiallister, prislister eller fakturalinjer.

For hver linje, returner et JSON-objekt med:
- varenr: varenummer som string (tom streng hvis mangler)
- description: varetekst/produktbeskrivelse som string
- quantity: antall som number (1 hvis ikke oppgitt)
- enhet: enhet som string (f.eks. "stk", "m²", "lm", "m", "pk" – tom streng hvis mangler)
- amount: enhetspris i NOK som number (0 hvis ikke funnet)

Returner KUN et JSON-array, ingen forklaringstekst. Eksempel:
[{"varenr":"12345","description":"Bindingsverk av tre","quantity":20,"enhet":"m²","amount":450},{"varenr":"","description":"Limtredrager 90x315","quantity":6,"enhet":"lm","amount":1275}]

Hvis dokumentet ikke inneholder varelinjer, returner [].`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text.trim() : "[]";

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return Response.json([]);

  try {
    const items = JSON.parse(jsonMatch[0]);
    return Response.json(Array.isArray(items) ? items : []);
  } catch {
    return Response.json([]);
  }
}
