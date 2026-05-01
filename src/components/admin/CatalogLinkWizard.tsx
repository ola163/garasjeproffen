"use client";

import { useState, useEffect, useCallback } from "react";

export interface WizardItem {
  varenr: string; // may be empty
  name: string;
  dimensjon?: string;
  enhet?: string;
  nettopris?: number;
}

export interface WizardResult {
  itemIndex: number;
  supplier_varenr?: string; // only when item had a varenr (for DB link)
  gp_varenr: string;
}

interface MatchResult {
  varenr: string;
  name: string;
  dimensjon?: string;
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

type ItemAction =
  | { type: "accept"; gpId: string; gpVarenr: string }
  | { type: "link"; gpId: string; gpVarenr: string }
  | { type: "create"; name: string; category: string; unit: string }
  | { type: "skip" };

interface Props {
  supplier: string;
  items: WizardItem[];
  onDone: (results: WizardResult[]) => void;
  onCancel: () => void;
  cancelLabel?: string;
}

export default function CatalogLinkWizard({ supplier, items, onDone, onCancel, cancelLabel }: Props) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<Record<number, ItemAction>>({});
  const [searchQuery, setSearchQuery] = useState<Record<number, string>>({});
  const [searchHits, setSearchHits] = useState<Record<number, GpProduct[]>>({});
  const [searchLoading, setSearchLoading] = useState<Record<number, boolean>>({});
  const [categories, setCategories] = useState<GpCategory[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
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
        const initial: Record<number, ItemAction> = {};
        for (let i = 0; i < matched.length; i++) {
          const r = matched[i];
          if (r.matchType === "exact" && r.gpId && r.gpVarenr) {
            initial[i] = { type: "accept", gpId: r.gpId, gpVarenr: r.gpVarenr };
          }
        }
        setDecisions(initial);
      } finally {
        setLoading(false);
      }
    }
    run();
  }, [supplier, items]);

  const searchGp = useCallback(async (idx: number, q: string) => {
    if (!q.trim()) { setSearchHits(prev => ({ ...prev, [idx]: [] })); return; }
    setSearchLoading(prev => ({ ...prev, [idx]: true }));
    try {
      const res = await fetch(`/api/admin/katalog?q=${encodeURIComponent(q)}&limit=8`);
      const json = await res.json();
      setSearchHits(prev => ({ ...prev, [idx]: json.data ?? [] }));
    } finally {
      setSearchLoading(prev => ({ ...prev, [idx]: false }));
    }
  }, []);

  function setDecision(idx: number, action: ItemAction | null) {
    setDecisions(prev => {
      if (action === null) {
        const next = { ...prev };
        delete next[idx];
        return next;
      }
      return { ...prev, [idx]: action };
    });
  }

  const decidedCount = Object.values(decisions).filter(d => d.type !== "skip").length;
  const totalHandled = Object.keys(decisions).length;

  async function handleSave() {
    setSaving(true);
    setError("");
    const wizardResults: WizardResult[] = [];
    try {
      for (const [idxStr, action] of Object.entries(decisions)) {
        const idx = Number(idxStr);
        const item = items[idx];
        if (action.type === "skip") continue;

        if (action.type === "accept" || action.type === "link") {
          if (item.varenr) {
            await fetch(`/api/admin/katalog/${action.gpId}/links`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ supplier, supplier_varenr: item.varenr }),
            });
          }
          wizardResults.push({ itemIndex: idx, supplier_varenr: item.varenr || undefined, gp_varenr: action.gpVarenr });
        } else if (action.type === "create") {
          const createRes = await fetch("/api/admin/katalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: action.name, category: action.category, unit: action.unit, description: "" }),
          });
          const createJson = await createRes.json();
          if (createJson.error) throw new Error(createJson.error);
          if (item.varenr) {
            await fetch(`/api/admin/katalog/${createJson.data.id}/links`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ supplier, supplier_varenr: item.varenr }),
            });
          }
          wizardResults.push({ itemIndex: idx, supplier_varenr: item.varenr || undefined, gp_varenr: createJson.data.varenr });
        }
      }
      onDone(wizardResults);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Ukjent feil");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-xl bg-white p-8 shadow-2xl text-center">
          <div className="mb-3 h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-sm text-gray-600">Matcher varer mot GP-katalogen…</p>
        </div>
      </div>
    );
  }

  const currentItem = items[currentIdx];
  const currentResult = results[currentIdx];
  const currentDecision = decisions[currentIdx];

  // Progress dots (up to 20 visible)
  const dotItems = items.slice(0, 20);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "92vh" }}>

        {/* Header */}
        <div className="border-b px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Knytt til GP-katalogen</h2>
              <p className="mt-0.5 text-xs text-gray-500">{supplier} · {items.length} varer</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold text-gray-700">{currentIdx + 1} / {items.length}</p>
              <p className="text-xs text-gray-400">{decidedCount} koblet · {totalHandled - decidedCount} hoppet over</p>
            </div>
          </div>

          {/* Progress dots */}
          <div className="mt-3 flex gap-1 flex-wrap">
            {dotItems.map((_, i) => {
              const dec = decisions[i];
              const isCurrent = i === currentIdx;
              const color = !dec
                ? isCurrent ? "bg-blue-500" : "bg-gray-200"
                : dec.type === "skip" ? "bg-gray-300"
                : "bg-green-400";
              return (
                <button
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  className={`h-2 rounded-full transition-all ${isCurrent ? "w-6" : "w-2"} ${color}`}
                />
              );
            })}
            {items.length > 20 && (
              <span className="text-xs text-gray-400 self-center ml-1">+{items.length - 20}</span>
            )}
          </div>
        </div>

        {/* Item card */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {currentItem && currentResult && (
            <ItemCard
              idx={currentIdx}
              item={currentItem}
              result={currentResult}
              decision={currentDecision}
              searchQuery={searchQuery[currentIdx] ?? ""}
              searchHits={searchHits[currentIdx] ?? []}
              searchLoading={searchLoading[currentIdx] ?? false}
              categories={categories}
              setDecision={setDecision}
              onSearchChange={(q) => {
                setSearchQuery(prev => ({ ...prev, [currentIdx]: q }));
                searchGp(currentIdx, q);
              }}
            />
          )}
        </div>

        {error && <p className="px-6 py-2 text-sm text-red-600 border-t">{error}</p>}

        {/* Footer */}
        <div className="border-t px-6 py-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
            >
              ←
            </button>
            <button
              onClick={() => setCurrentIdx(i => Math.min(items.length - 1, i + 1))}
              disabled={currentIdx >= items.length - 1}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
            >
              →
            </button>

            {/* Jump to next undecided */}
            {totalHandled < items.length && (
              <button
                onClick={() => {
                  const after = items.findIndex((_, i) => i > currentIdx && decisions[i] === undefined);
                  const any = after !== -1 ? after : items.findIndex((_, i) => decisions[i] === undefined);
                  if (any !== -1) setCurrentIdx(any);
                }}
                className="text-xs text-orange-500 hover:underline flex-1 text-left ml-1"
              >
                Neste ubehandlet →
              </button>
            )}
            {totalHandled >= items.length && <span className="flex-1" />}

            <button onClick={onCancel} className="text-sm text-gray-400 hover:text-gray-600 shrink-0">
              {cancelLabel ?? "Avbryt"}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || decidedCount === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40 shrink-0"
            >
              {saving ? "Lagrer…" : `Lagre ${decidedCount} kobling${decidedCount === 1 ? "" : "er"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Per-item card ────────────────────────────────────────────────────────────

interface ItemCardProps {
  idx: number;
  item: WizardItem;
  result: MatchResult;
  decision: ItemAction | undefined;
  searchQuery: string;
  searchHits: GpProduct[];
  searchLoading: boolean;
  categories: GpCategory[];
  setDecision: (idx: number, action: ItemAction | null) => void;
  onSearchChange: (q: string) => void;
}

function ItemCard({ idx, item, result, decision, searchQuery, searchHits, searchLoading, categories, setDecision, onSearchChange }: ItemCardProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState(item.name);
  const [newCategory, setNewCategory] = useState("");
  const [newUnit, setNewUnit] = useState(item.enhet ?? "stk");

  useEffect(() => {
    if (!newCategory && categories[0]) setNewCategory(categories[0].label);
  }, [categories, newCategory]);

  const isLinked = decision?.type === "accept" || decision?.type === "link";
  const isCreating = decision?.type === "create";
  const isSkipped = decision?.type === "skip";

  function clearDecision() {
    setDecision(idx, null);
    setShowCreate(false);
  }

  return (
    <div className="space-y-4">

      {/* Supplier item */}
      <div className={`rounded-xl border-2 p-4 ${
        isLinked ? "border-green-300 bg-green-50"
        : isCreating ? "border-blue-300 bg-blue-50"
        : isSkipped ? "border-gray-100 bg-gray-50 opacity-60"
        : result.matchType === "exact" ? "border-green-200 bg-green-50"
        : result.matchType === "suggestion" ? "border-yellow-200 bg-yellow-50"
        : "border-orange-200 bg-orange-50"
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 leading-tight">{item.name}</p>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
              {item.varenr && <span className="font-mono">Varenr: {item.varenr}</span>}
              {item.dimensjon && <span>Dim: {item.dimensjon}</span>}
              {item.enhet && <span>Enhet: {item.enhet}</span>}
              {item.nettopris != null && <span>kr {item.nettopris.toLocaleString("nb-NO", { minimumFractionDigits: 2 })}</span>}
            </div>
          </div>
          <StatusBadge decision={decision} matchType={result.matchType} />
        </div>

        {/* Current decision summary */}
        {isLinked && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm">
            <span className="text-gray-500">Koblet til </span>
            <span className="font-semibold text-green-700 ml-1">
              {(decision as { gpVarenr: string }).gpVarenr}
            </span>
            <button onClick={clearDecision} className="ml-auto text-xs text-gray-400 hover:text-red-500">Endre</button>
          </div>
        )}
        {isCreating && (
          <div className="mt-3 flex items-center justify-between rounded-lg bg-white/80 px-3 py-2 text-sm">
            <span className="text-blue-700">Ny vare: «{(decision as { name: string }).name}»</span>
            <button onClick={clearDecision} className="ml-2 text-xs text-gray-400 hover:text-red-500">Endre</button>
          </div>
        )}
        {isSkipped && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">Hoppet over</span>
            <button onClick={clearDecision} className="text-xs text-orange-500 hover:underline">Angre</button>
          </div>
        )}
      </div>

      {/* Actions — only when not yet decided */}
      {!isLinked && !isCreating && !isSkipped && (
        <div className="space-y-4">

          {/* Auto-suggestions from match API */}
          {(result.suggestions?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                {result.matchType === "exact" ? "Eksakt treff" : "Forslag basert på navn / dimensjon"}
              </p>
              <div className="space-y-1.5">
                {result.suggestions?.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setDecision(idx, { type: "link", gpId: s.id, gpVarenr: s.varenr })}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="font-mono text-xs text-gray-400">{s.varenr}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-blue-600">Koble →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Manual search */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Søk i GP-katalogen</p>
            <div className="relative">
              <input
                type="text"
                placeholder="Navn, varenr, dimensjon (f.eks. 48x98)…"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
              />
              {searchLoading && (
                <span className="absolute right-3 top-2.5 text-xs text-gray-400 animate-pulse">søker…</span>
              )}
            </div>
            {searchHits.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {searchHits.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setDecision(idx, { type: "link", gpId: s.id, gpVarenr: s.varenr })}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-4 py-3 text-left hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{s.name}</p>
                      <p className="font-mono text-xs text-gray-400">{s.varenr}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-blue-600">Koble →</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Create new GPV item */}
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="w-full rounded-xl border-2 border-dashed border-blue-200 py-3 text-sm font-medium text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              + Opprett ny GP-vare
            </button>
          ) : (
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <p className="text-sm font-bold text-blue-800">Ny GP-vare</p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Navn</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kategori</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.label}>
                      {c.label} (GPV-{c.varenr_start}–{c.varenr_start + 999})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Enhet</label>
                <input
                  type="text"
                  value={newUnit}
                  onChange={e => setNewUnit(e.target.value)}
                  placeholder="stk, lm, m², pk…"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    if (!newName.trim()) return;
                    setDecision(idx, { type: "create", name: newName.trim(), category: newCategory, unit: newUnit.trim() || "stk" });
                    setShowCreate(false);
                  }}
                  className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Opprett
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setDecision(idx, { type: "skip" })}
            className="w-full py-1 text-xs text-gray-400 hover:text-gray-600"
          >
            Hopp over denne varen
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ decision, matchType }: { decision: ItemAction | undefined; matchType: string }) {
  if (decision?.type === "accept" || decision?.type === "link")
    return <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">✓ Koblet</span>;
  if (decision?.type === "create")
    return <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">+ Ny vare</span>;
  if (decision?.type === "skip")
    return <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-500">Hoppet over</span>;
  if (matchType === "exact")
    return <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Eksakt treff</span>;
  if (matchType === "suggestion")
    return <span className="shrink-0 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-700">Forslag</span>;
  return <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-600">Ingen treff</span>;
}
