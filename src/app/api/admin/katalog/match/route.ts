import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";

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

export interface MatchItem {
  varenr: string;
  name: string;
  dimensjon?: string;
  enhet?: string;
  nettopris?: number;
}

export interface Suggestion {
  id: string;
  varenr: string;
  name: string;
  confidence: number;  // 0–1, Claude-provided
  reason: string;      // Short Norwegian explanation
}

export interface MatchResult {
  varenr: string;
  name: string;
  dimensjon?: string;
  enhet?: string;
  nettopris?: number;
  matchType: "exact" | "suggestion" | "none";
  gpId?: string;
  gpVarenr?: string;
  gpName?: string;
  suggestions?: Suggestion[];
  noConfidentMatch?: boolean;
}

interface GpCandidate {
  id: string;
  varenr: string;
  name: string;
  category: string;
}

function extractSearchTerm(name: string, dimensjon?: string): string {
  const combined = [name, dimensjon].filter(Boolean).join(" ");
  const dimMatch = combined.match(/\d+[x×X]\d+(?:[x×X]\d+)?/);
  if (dimMatch) return dimMatch[0].replace(/[×X]/g, "x");
  const words = name.split(/\s+/).filter(w => w.length > 3);
  return words.slice(0, 2).join(" ");
}

async function fetchCandidates(sb: ReturnType<typeof getSupabase>, item: MatchItem): Promise<GpCandidate[]> {
  const seen = new Set<string>();
  const candidates: GpCandidate[] = [];

  async function addResults(data: GpCandidate[] | null) {
    for (const p of data ?? []) {
      if (!seen.has(p.id)) { seen.add(p.id); candidates.push(p); }
    }
  }

  // Strategy 1: dimension / key-term
  const q1 = extractSearchTerm(item.name, item.dimensjon);
  if (q1) {
    const { data } = await sb.from("gp_products").select("id, varenr, name, category").ilike("name", `%${q1}%`).limit(8);
    await addResults(data);
  }

  // Strategy 2: first long word in name (broadens recall)
  if (candidates.length < 5) {
    const firstWord = item.name.split(/\s+/).find(w => w.length > 4);
    if (firstWord && firstWord !== q1) {
      const { data } = await sb.from("gp_products").select("id, varenr, name, category").ilike("name", `%${firstWord}%`).limit(6);
      await addResults(data);
    }
  }

  return candidates.slice(0, 10);
}

// ── Claude batch ranking ──────────────────────────────────────────────────────

interface BatchItem {
  originalIdx: number;
  item: MatchItem;
  candidates: GpCandidate[];
}

interface ClaudeSuggestion { varenr: string; confidence: number; reason: string }
interface ClaudeItem { index: number; no_confident_match?: boolean; suggestions: ClaudeSuggestion[] }

async function rankWithClaude(batch: BatchItem[]): Promise<Map<number, { suggestions: ClaudeSuggestion[]; noConfidentMatch: boolean }>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userContent = batch.map((x, i) => {
    const meta = [
      x.item.dimensjon ? `Dim: ${x.item.dimensjon}` : null,
      x.item.enhet ? `Enhet: ${x.item.enhet}` : null,
    ].filter(Boolean).join(" | ");
    const candidateLines = x.candidates.map(c => `  ${c.varenr}: ${c.name} (${c.category})`).join("\n");
    return `[${i}] "${x.item.name}"${meta ? ` | ${meta}` : ""}\nKandidater:\n${candidateLines}`;
  }).join("\n\n");

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    system: `Du er et forslagssystem for varematching for et norsk byggvarefirma (GP Varekatalog).
Ranger kandidatene etter sannsynlighet for at de er samme vare som leverandørvaren.

Regler:
- Ranger kun kandidater fra listen — opprett aldri nye
- confidence: 0.0 (ingen likhet) til 1.0 (sikker match)
- reason: maks 8 norske ord som forklarer matchen
- Hvis ingen kandidat er ≥0.50: sett "no_confident_match": true
- Returner KUN gyldig JSON, ingen annen tekst`,
    messages: [{
      role: "user",
      content: `Match leverandørvarene til GPV-katalogkandidatene. Returner kun dette JSON-formatet:
{"items":[{"index":0,"no_confident_match":false,"suggestions":[{"varenr":"GPV-XXX","confidence":0.9,"reason":"Eksakt dimensjonsmatch og produkttype"}]}]}

Varer:
${userContent}`,
    }],
  });

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "";
  // Strip markdown code fences if present
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const parsed = JSON.parse(jsonStr) as { items: ClaudeItem[] };

  const result = new Map<number, { suggestions: ClaudeSuggestion[]; noConfidentMatch: boolean }>();
  for (const ci of parsed.items) {
    result.set(batch[ci.index].originalIdx, {
      suggestions: ci.suggestions ?? [],
      noConfidentMatch: ci.no_confident_match ?? false,
    });
  }
  return result;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supplier, items } = await req.json() as { supplier: string; items: MatchItem[] };
  if (!items?.length) return NextResponse.json({ results: [] });

  const sb = getSupabase();
  const varenrs = items.map(i => i.varenr).filter(Boolean);
  const names = items.filter(i => !i.varenr && i.name).map(i => i.name.trim().toLowerCase()).filter(Boolean);

  // ── 1. Exact matches from saved supplier links (by varenr AND by name alias) ─
  const [linksRes, nameLinksRes] = await Promise.all([
    sb.from("gp_product_supplier_links")
      .select("supplier_varenr, gp_varenr")
      .eq("supplier", supplier)
      .in("supplier_varenr", varenrs.length > 0 ? varenrs : ["__none__"]),
    names.length > 0
      ? sb.from("gp_product_supplier_links")
          .select("supplier_varenr, gp_varenr")
          .eq("supplier", `${supplier}:name`)
          .in("supplier_varenr", names)
      : Promise.resolve({ data: [] }),
  ]);

  const linkMap = new Map<string, string>(); // supplier_varenr → gp_varenr
  const nameLinkMap = new Map<string, string>(); // lowercased name → gp_varenr
  for (const l of linksRes.data ?? []) linkMap.set(l.supplier_varenr, l.gp_varenr);
  for (const l of (nameLinksRes as { data: { supplier_varenr: string; gp_varenr: string }[] | null }).data ?? []) {
    nameLinkMap.set(l.supplier_varenr, l.gp_varenr);
  }

  const gpVarenrsNeeded = [...new Set([...linkMap.values(), ...nameLinkMap.values()])];
  const gpByVarenr = new Map<string, GpCandidate>();
  if (gpVarenrsNeeded.length > 0) {
    const { data: gpRows } = await sb.from("gp_products").select("id, varenr, name, category").in("varenr", gpVarenrsNeeded);
    for (const row of gpRows ?? []) gpByVarenr.set(row.varenr, row);
  }

  // ── 2. Fetch DB candidates for non-exact items in parallel ───────────────
  const exactIndices = new Set<number>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (linkMap.has(item.varenr)) exactIndices.add(i);
    else if (!item.varenr && item.name && nameLinkMap.has(item.name.trim().toLowerCase())) exactIndices.add(i);
  }

  const batch: BatchItem[] = [];
  await Promise.all(
    items.map(async (item, i) => {
      if (exactIndices.has(i)) return;
      const candidates = await fetchCandidates(sb, item);
      if (candidates.length > 0) batch.push({ originalIdx: i, item, candidates });
    })
  );

  // ── 3. Claude ranking (one batch call) ───────────────────────────────────
  let aiMap = new Map<number, { suggestions: ClaudeSuggestion[]; noConfidentMatch: boolean }>();
  if (batch.length > 0 && process.env.ANTHROPIC_API_KEY) {
    try {
      aiMap = await rankWithClaude(batch);
    } catch (err) {
      console.error("Claude matching failed, falling back to raw candidates:", err);
      // Fallback: assign raw candidates with default confidence 0.5
      for (const b of batch) {
        aiMap.set(b.originalIdx, {
          suggestions: b.candidates.slice(0, 5).map(c => ({ varenr: c.varenr, confidence: 0.5, reason: "Navnelikhet" })),
          noConfidentMatch: false,
        });
      }
    }
  }

  // ── 4. Build result array ─────────────────────────────────────────────────
  // Build varenr→{id,name} lookup for all candidate products
  const allCandidateVarenrs = batch.flatMap(b => b.candidates.map(c => c.varenr));
  const gpLookup = new Map<string, GpCandidate>();
  for (const b of batch) for (const c of b.candidates) gpLookup.set(c.varenr, c);

  const results: MatchResult[] = items.map((item, i) => {
    // Exact match (by varenr or name alias)
    if (exactIndices.has(i)) {
      const gpVarenr = linkMap.get(item.varenr) ?? nameLinkMap.get(item.name.trim().toLowerCase());
      const gp = gpVarenr ? gpByVarenr.get(gpVarenr) : undefined;
      return { ...item, matchType: "exact" as const, gpId: gp?.id, gpVarenr: gp?.varenr, gpName: gp?.name };
    }

    // AI suggestions
    const ai = aiMap.get(i);
    if (ai && ai.suggestions.length > 0) {
      const suggestions: Suggestion[] = ai.suggestions
        .map(s => {
          const gp = gpLookup.get(s.varenr);
          if (!gp) return null;
          return { id: gp.id, varenr: gp.varenr, name: gp.name, confidence: s.confidence, reason: s.reason };
        })
        .filter((s): s is Suggestion => s !== null);

      if (suggestions.length > 0) {
        return { ...item, matchType: "suggestion" as const, suggestions, noConfidentMatch: ai.noConfidentMatch };
      }
    }

    // Fallback: no candidates or AI returned nothing
    const batchItem = batch.find(b => b.originalIdx === i);
    if (batchItem && batchItem.candidates.length > 0 && !process.env.ANTHROPIC_API_KEY) {
      const suggestions: Suggestion[] = batchItem.candidates.slice(0, 5).map(c => ({
        id: c.id, varenr: c.varenr, name: c.name, confidence: 0.5, reason: "Navnelikhet",
      }));
      return { ...item, matchType: "suggestion" as const, suggestions, noConfidentMatch: false };
    }

    return { ...item, matchType: "none" as const };
  });

  // Suppress unused variable warning
  void allCandidateVarenrs;

  return NextResponse.json({ results });
}
