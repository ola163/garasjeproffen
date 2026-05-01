"use client";

import { useState, useEffect, useCallback } from "react";

export interface WizardItem {
  varenr: string;
  name: string;
  dimensjon?: string;
  enhet?: string;
  nettopris?: number;
}

interface MatchResult {
  varenr: string;
  name: string;
  dimensjon?: string;
  enhet?: string;
  nettopris?: number;
  matchType: "exact" | "suggestion" | "none";
  gpId?: string;
  gpVarenr?: string;
  gpName?: string;
  suggestions?: { id: string; varenr: string; name: string }[];
}

interface GpProduct {
  id: string;
  varenr: string;
  name: string;
}

interface GpCategory {
  id: string;
  label: string;
  varenr_start: number;
}

// Per-item user decision
interface ItemDecision {
  action: "accept" | "link" | "create" | "skip";
  gpId?: string;
  gpVarenr?: string;
  newName?: string;
  newCategory?: string;
  newUnit?: string;
}

interface Props {
  supplier: string;
  items: WizardItem[];
  onDone: (links: { supplier_varenr: string; gp_varenr: string }[]) => void;
  onCancel: () => void;
  cancelLabel?: string;
}

export default function CatalogLinkWizard({ supplier, items, onDone, onCancel, cancelLabel }: Props) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>({});
  const [searchQuery, setSearchQuery] = useState<Record<string, string>>({});
  const [searchHits, setSearchHits] = useState<Record<string, GpProduct[]>>({});
  const [searchLoading, setSearchLoading] = useState<Record<string, boolean>>({});
  const [categories, setCategories] = useState<GpCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function run() {
      setLoading(true);
      try {
        const [matchRes, catRes] = await Promise.all([
          fetch("/api/admin/katalog/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ supplier, items }),
          }),
          fetch("/api/admin/katalog/kategorier"),
        ]);
        const matchJson = await matchRes.json();
        const catJson = await catRes.json();
        const matched: MatchResult[] = matchJson.results ?? [];
        setResults(matched);
        setCategories(catJson.data ?? []);

        // Auto-accept exact matches
        const initial: Record<string, ItemDecision> = {};
        for (const r of matched) {
          if (r.matchType === "exact" && r.gpId) {
            initial[r.varenr] = { action: "accept", gpId: r.gpId, gpVarenr: r.gpVarenr };
          }
        }
        setDecisions(initial);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [supplier, items]);

  const searchGp = useCallback(async (varenr: string, q: string) => {
    if (!q.trim()) { setSearchHits(prev => ({ ...prev, [varenr]: [] })); return; }
    setSearchLoading(prev => ({ ...prev, [varenr]: true }));
    try {
      const res = await fetch(`/api/admin/katalog?q=${encodeURIComponent(q)}&limit=8`);
      const json = await res.json();
      setSearchHits(prev => ({ ...prev, [varenr]: json.data ?? [] }));
    } finally {
      setSearchLoading(prev => ({ ...prev, [varenr]: false }));
    }
  }, []);

  function setDecision(varenr: string, d: ItemDecision) {
    setDecisions(prev => ({ ...prev, [varenr]: d }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const linksToSave: { supplier_varenr: string; gp_varenr: string; gpId: string }[] = [];

      for (const [varenr, dec] of Object.entries(decisions)) {
        if (dec.action === "skip") continue;

        if (dec.action === "accept" || dec.action === "link") {
          if (dec.gpId && dec.gpVarenr) {
            linksToSave.push({ supplier_varenr: varenr, gp_varenr: dec.gpVarenr, gpId: dec.gpId });
          }
        } else if (dec.action === "create") {
          // Create new GP product then save link
          const createRes = await fetch("/api/admin/katalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: dec.newName ?? "",
              category: dec.newCategory ?? "",
              unit: dec.newUnit ?? "",
              description: "",
            }),
          });
          const createJson = await createRes.json();
          if (createJson.error) throw new Error(createJson.error);
          linksToSave.push({ supplier_varenr: varenr, gp_varenr: createJson.data.varenr, gpId: createJson.data.id });
        }
      }

      // Save all links via PATCH
      await Promise.all(
        linksToSave.map(({ supplier_varenr, gpId }) =>
          fetch(`/api/admin/katalog/${gpId}/links`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ supplier, supplier_varenr }),
          })
        )
      );

      onDone(linksToSave.map(({ supplier_varenr, gp_varenr }) => ({ supplier_varenr, gp_varenr })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setSaving(false);
    }
  }

  const acceptedCount = Object.values(decisions).filter(d => d.action !== "skip").length;

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-lg bg-white p-8 shadow-xl">
          <p className="text-gray-600">Matcher varer mot GP-katalogen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl" style={{ maxHeight: "90vh" }}>
        <div className="border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Knytt leverandørvarer til GP-katalogen</h2>
          <p className="mt-1 text-sm text-gray-500">
            {supplier} · {items.length} varer fra opplastet pristilbud
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {results.map(r => {
            const dec = decisions[r.varenr];

            return (
              <div
                key={r.varenr}
                className={`rounded-lg border p-4 ${
                  r.matchType === "exact"
                    ? "border-green-200 bg-green-50"
                    : r.matchType === "suggestion"
                    ? "border-yellow-200 bg-yellow-50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">{r.name}</p>
                    <p className="text-xs text-gray-500">
                      {r.varenr}{r.dimensjon ? ` · ${r.dimensjon}` : ""}{r.nettopris ? ` · kr ${r.nettopris}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                      r.matchType === "exact"
                        ? "bg-green-100 text-green-700"
                        : r.matchType === "suggestion"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {r.matchType === "exact" ? "Eksakt treff" : r.matchType === "suggestion" ? "Forslag" : "Ingen treff"}
                  </span>
                </div>

                {/* Exact match */}
                {r.matchType === "exact" && r.gpId && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-green-700">
                      → {r.gpVarenr} · {r.gpName}
                    </span>
                    {dec?.action === "accept" ? (
                      <button
                        onClick={() => setDecision(r.varenr, { action: "skip" })}
                        className="ml-auto text-xs text-gray-400 hover:text-red-500"
                      >
                        Hopp over
                      </button>
                    ) : (
                      <button
                        onClick={() => setDecision(r.varenr, { action: "accept", gpId: r.gpId, gpVarenr: r.gpVarenr })}
                        className="ml-auto text-xs text-green-600 hover:underline"
                      >
                        Godta
                      </button>
                    )}
                  </div>
                )}

                {/* Suggestions */}
                {r.matchType === "suggestion" && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Forslag fra GP-katalogen</p>
                    {r.suggestions?.map(s => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`suggestion-${r.varenr}`}
                          checked={dec?.action === "link" && dec.gpId === s.id}
                          onChange={() => setDecision(r.varenr, { action: "link", gpId: s.id, gpVarenr: s.varenr })}
                          className="accent-blue-600"
                        />
                        <span className="text-sm">{s.varenr} · {s.name}</span>
                      </label>
                    ))}
                    <SuggestionSearchSection
                      varenr={r.varenr}
                      dec={dec}
                      searchQuery={searchQuery}
                      searchHits={searchHits}
                      searchLoading={searchLoading}
                      setDecision={setDecision}
                      setSearchQuery={setSearchQuery}
                      searchGp={searchGp}
                    />
                    <CreateSection
                      varenr={r.varenr}
                      dec={dec}
                      categories={categories}
                      defaultName={r.name}
                      setDecision={setDecision}
                    />
                  </div>
                )}

                {/* No match */}
                {r.matchType === "none" && (
                  <div className="mt-3 space-y-2">
                    <SuggestionSearchSection
                      varenr={r.varenr}
                      dec={dec}
                      searchQuery={searchQuery}
                      searchHits={searchHits}
                      searchLoading={searchLoading}
                      setDecision={setDecision}
                      setSearchQuery={setSearchQuery}
                      searchGp={searchGp}
                    />
                    <CreateSection
                      varenr={r.varenr}
                      dec={dec}
                      categories={categories}
                      defaultName={r.name}
                      setDecision={setDecision}
                    />
                    <button
                      onClick={() => setDecision(r.varenr, { action: "skip" })}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      Hopp over denne
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="px-6 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between border-t px-6 py-4">
          <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700">
            {cancelLabel ?? "Avbryt"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || acceptedCount === 0}
            className="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Lagrer..." : `Lagre ${acceptedCount} kobling${acceptedCount === 1 ? "" : "er"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-components for search and create sections

function SuggestionSearchSection({
  varenr, dec, searchQuery, searchHits, searchLoading, setDecision, setSearchQuery, searchGp,
}: {
  varenr: string;
  dec: ItemDecision | undefined;
  searchQuery: Record<string, string>;
  searchHits: Record<string, GpProduct[]>;
  searchLoading: Record<string, boolean>;
  setDecision: (v: string, d: ItemDecision) => void;
  setSearchQuery: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  searchGp: (varenr: string, q: string) => void;
}) {
  return (
    <div>
      <div className="flex gap-2 mt-2">
        <input
          type="text"
          placeholder="Søk i GP-katalogen..."
          value={searchQuery[varenr] ?? ""}
          onChange={e => {
            const q = e.target.value;
            setSearchQuery(prev => ({ ...prev, [varenr]: q }));
            searchGp(varenr, q);
          }}
          className="flex-1 rounded border px-2 py-1 text-sm"
        />
        {searchLoading[varenr] && <span className="text-xs text-gray-400 self-center">...</span>}
      </div>
      {(searchHits[varenr] ?? []).map(s => (
        <label key={s.id} className="flex items-center gap-2 cursor-pointer mt-1">
          <input
            type="radio"
            name={`suggestion-${varenr}`}
            checked={dec?.action === "link" && dec.gpId === s.id}
            onChange={() => setDecision(varenr, { action: "link", gpId: s.id, gpVarenr: s.varenr })}
            className="accent-blue-600"
          />
          <span className="text-sm">{s.varenr} · {s.name}</span>
        </label>
      ))}
    </div>
  );
}

function CreateSection({
  varenr, dec, categories, defaultName, setDecision,
}: {
  varenr: string;
  dec: ItemDecision | undefined;
  categories: GpCategory[];
  defaultName: string;
  setDecision: (v: string, d: ItemDecision) => void;
}) {
  const isCreating = dec?.action === "create";

  if (!isCreating) {
    return (
      <button
        onClick={() =>
          setDecision(varenr, {
            action: "create",
            newName: defaultName,
            newCategory: categories[0]?.id ?? "",
            newUnit: "stk",
          })
        }
        className="text-xs text-blue-600 hover:underline"
      >
        + Opprett ny GP-vare
      </button>
    );
  }

  return (
    <div className="rounded border border-blue-200 bg-blue-50 p-3 space-y-2 mt-2">
      <p className="text-xs font-medium text-blue-700">Ny GP-vare</p>
      <input
        type="text"
        placeholder="Navn"
        value={dec.newName ?? ""}
        onChange={e => setDecision(varenr, { ...dec, newName: e.target.value })}
        className="w-full rounded border px-2 py-1 text-sm"
      />
      <select
        value={dec.newCategory ?? ""}
        onChange={e => setDecision(varenr, { ...dec, newCategory: e.target.value })}
        className="w-full rounded border px-2 py-1 text-sm"
      >
        {categories.map(c => (
          <option key={c.id} value={c.id}>
            {c.label} (GPV-{c.varenr_start}–{c.varenr_start + 999})
          </option>
        ))}
      </select>
      <input
        type="text"
        placeholder="Enhet (stk, lm, m²...)"
        value={dec.newUnit ?? ""}
        onChange={e => setDecision(varenr, { ...dec, newUnit: e.target.value })}
        className="w-full rounded border px-2 py-1 text-sm"
      />
      <button
        onClick={() => setDecision(varenr, { action: "skip" })}
        className="text-xs text-gray-400 hover:text-red-500"
      >
        Avbryt opprettelse
      </button>
    </div>
  );
}
