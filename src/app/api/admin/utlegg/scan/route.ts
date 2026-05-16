import Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";

const client = new Anthropic();

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const email = cookieStore.get("gp-user")?.value;
  if (!email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("image") as File | null;
  if (!file || file.size === 0) return Response.json({ error: "Ingen fil" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const mediaType = (file.type || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 64,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text: "This is a Norwegian receipt. Extract the final total amount paid (totalbeløp/å betale/sum/total). Reply with ONLY the number in Norwegian format (e.g. 1234.50 or 1234,50 — use period as decimal separator). No currency symbol, no text.",
          },
        ],
      },
    ],
  });

  const raw = (msg.content[0] as { type: string; text: string }).text.trim();
  const amount = parseFloat(raw.replace(",", ".").replace(/\s/g, ""));
  if (isNaN(amount) || amount <= 0) return Response.json({ error: "Fant ikke beløp" }, { status: 422 });

  return Response.json({ amount });
}
