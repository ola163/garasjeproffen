"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";

interface GpCategory {
  id: string;
  label: string;
  sort_order: number;
  varenr_start: number;
}

interface GpProduct {
  id: string;
  varenr: string;
  name: string;
  category: string;
  unit?: string;
  description?: string;
}

interface SupplierPriceHit {
  varenr: string;
  varebenevnelse: string;
  dimensjon?: string;
  enhet?: string;
  nettopris?: number;
  bruttopris?: number;
  supplier?: string;
}

type LinkState = { varenr: string; name: string };
type LinkMap = Record<string, LinkState>;

const DB_SUPPLIERS = ["Optimera", "XLBygg", "Coop Obs Bygg", "Neumann"];

const EMPTY_PRODUCT = { varenr: "", name: "", category: "", unit: "", description: "" };
const EMPTY_CAT = { label: "", varenr_start: 1000 };
const EMPTY_LINKS: LinkMap = Object.fromEntries(DB_SUPPLIERS.map(s => [s, { varenr: "", name: "" }]));

// ── Autocomplete picker for supplier varenr ───────────────────────────────────
function SupplierVarenrPicker({ supplier, varenr, name, onChange }: {
  supplier: string;
  varenr: string;
  name: string;
  onChange: (varenr: string, name: string) => void;
}) {
  const [query, setQuery] = useState(varenr);
  const [results, setResults] = useState<SupplierPriceHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when external value changes (e.g. when edit modal opens)
  useEffect(() => { setQuery(varenr); }, [varenr]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (query.length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/supplier-prices?supplier=${encodeURIComponent(supplier)}&q=${encodeURIComponent(query)}&limit=15`);
        const json = await res.json();
        setResults(json.data ?? []);
      } finally {
        setLoading(false);
      }
    }, 280);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, supplier]);

  function hitLabel(hit: SupplierPriceHit) {
    return [hit.varebenevnelse, hit.dimensjon].filter(Boolean).join(" ");
  }

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value, ""); setOpen(true); }}
        onFocus={() => { if (query.length >= 2) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
        placeholder="Søk varenr eller navn…"
        className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs font-mono focus:border-orange-400 focus:outline-none"
      />
      {name && !open && (
        <p className="mt-0.5 truncate text-[10px] text-gray-400">{name}</p>
      )}
      {open && (results.length > 0 || loading) && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-52 w-[420px] max-w-[90vw] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
          {loading && <p className="px-3 py-2 text-xs text-gray-400 animate-pulse">Søker…</p>}
          {results.map(hit => (
            <button
              key={hit.varenr}
              onMouseDown={() => { onChange(hit.varenr, hitLabel(hit)); setQuery(hit.varenr); setOpen(false); }}
              className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-orange-50"
            >
              <span className="shrink-0 font-mono text-xs font-semibold text-gray-800">{hit.varenr}</span>
              <span className="min-w-0 truncate text-xs text-gray-500">{hitLabel(hit)}</span>
              {hit.nettopris != null && (
                <span className="ml-auto shrink-0 text-[10px] text-gray-400">{hit.nettopris.toLocaleString("nb-NO")} kr</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function KatalogPage() {
  const [tab, setTab] = useState<"produkter" | "kategorier" | "importer">("produkter");

  // ── Categories ─────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<GpCategory[]>([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [editingCat, setEditingCat] = useState<string | null>(null); // id being edited inline
  const [editCatLabel, setEditCatLabel] = useState("");
  const [editCatStart, setEditCatStart] = useState(1000);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState(EMPTY_CAT);
  const [savingCat, setSavingCat] = useState(false);
  const [catError, setCatError] = useState("");
  const [deletingCat, setDeletingCat] = useState<string | null>(null);

  // ── Products ───────────────────────────────────────────────────────────
  const [products, setProducts] = useState<GpProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [prodsLoading, setProdsLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [prodError, setProdError] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [supplierLinks, setSupplierLinks] = useState<LinkMap>({ ...EMPTY_LINKS });

  // ── Import tab ──────────────────────────────────────────────────────────
  const [importSupplier, setImportSupplier] = useState(DB_SUPPLIERS[0]);
  const [importSearch, setImportSearch] = useState("");
  const [importResults, setImportResults] = useState<SupplierPriceHit[]>([]);
  const [importTotal, setImportTotal] = useState(0);
  const [importLoading, setImportLoading] = useState(false);
  const [importModal, setImportModal] = useState<SupplierPriceHit | null>(null);
  const [importForm, setImportForm] = useState({ name: "", category: "", unit: "", description: "" });
  const [importLinks, setImportLinks] = useState<LinkMap>({ ...EMPTY_LINKS });
  const [gpMatches, setGpMatches] = useState<GpProduct[]>([]);
  const [supplierMatches, setSupplierMatches] = useState<Record<string, SupplierPriceHit[]>>({});
  const [selectedGpId, setSelectedGpId] = useState<string | null>(null);
  const [importMatchLoading, setImportMatchLoading] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [importError, setImportError] = useState("");
  const importTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load categories ────────────────────────────────────────────────────
  const loadCats = useCallback(async () => {
    setCatsLoading(true);
    const res = await fetch("/api/admin/katalog/kategorier");
    const json = await res.json();
    setCategories(json.data ?? []);
    setCatsLoading(false);
  }, []);

  // ── Load products ──────────────────────────────────────────────────────
  const loadProducts = useCallback(async () => {
    setProdsLoading(true);
    const params = new URLSearchParams();
    if (searchQ) params.set("q", searchQ);
    if (categoryFilter) params.set("category", categoryFilter);
    const res = await fetch(`/api/admin/katalog?${params}`);
    const json = await res.json();
    setProducts(json.data ?? []);
    setTotal(json.count ?? 0);
    setProdsLoading(false);
  }, [searchQ, categoryFilter]);

  useEffect(() => { loadCats(); }, [loadCats]);
  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ── Category actions ───────────────────────────────────────────────────
  async function moveCategory(id: string, dir: "up" | "down") {
    const res = await fetch(`/api/admin/katalog/kategorier/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: dir }),
    });
    const json = await res.json();
    if (json.data) setCategories(json.data);
  }

  async function saveCatEdit(id: string) {
    setSavingCat(true); setCatError("");
    const res = await fetch(`/api/admin/katalog/kategorier/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: editCatLabel, varenr_start: editCatStart }),
    });
    const json = await res.json();
    setSavingCat(false);
    if (!res.ok) { setCatError(json.error ?? "Feil"); return; }
    setEditingCat(null);
    loadCats();
  }

  async function addCategory() {
    if (!newCat.label.trim()) { setCatError("Navn er påkrevd"); return; }
    setSavingCat(true); setCatError("");
    const res = await fetch("/api/admin/katalog/kategorier", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCat),
    });
    const json = await res.json();
    setSavingCat(false);
    if (!res.ok) { setCatError(json.error ?? "Feil"); return; }
    setNewCat(EMPTY_CAT);
    setShowNewCat(false);
    loadCats();
  }

  async function deleteCategory(id: string) {
    setDeletingCat(id);
    const res = await fetch(`/api/admin/katalog/kategorier/${id}`, { method: "DELETE" });
    const json = await res.json();
    setDeletingCat(null);
    if (!res.ok) { setCatError(json.error ?? "Feil"); return; }
    loadCats();
  }

  // ── Product actions ────────────────────────────────────────────────────
  function openAdd() {
    setEditId(null);
    setForm({ ...EMPTY_PRODUCT, category: categories[0]?.label ?? "" });
    setSupplierLinks({ ...EMPTY_LINKS });
    setProdError("");
    setShowModal(true);
  }

  async function openEdit(p: GpProduct) {
    setEditId(p.id);
    setForm({ varenr: p.varenr, name: p.name, category: p.category, unit: p.unit ?? "", description: p.description ?? "" });
    setSupplierLinks({ ...EMPTY_LINKS });
    setProdError("");
    setShowModal(true);

    // Fetch existing links then look up descriptions in parallel
    fetch(`/api/admin/katalog/${p.id}/links`)
      .then(r => r.json())
      .then(async d => {
        const map: LinkMap = { ...EMPTY_LINKS };
        for (const link of d.data ?? []) map[link.supplier] = { varenr: link.supplier_varenr, name: "" };
        setSupplierLinks({ ...map });

        // Fetch descriptions for each linked varenr
        await Promise.all(
          DB_SUPPLIERS.map(async sup => {
            const sv = map[sup]?.varenr;
            if (!sv) return;
            const r = await fetch(`/api/admin/supplier-prices?supplier=${encodeURIComponent(sup)}&q=${encodeURIComponent(sv)}&limit=1`);
            const j = await r.json();
            const hit = j.data?.[0];
            if (hit) map[sup] = { varenr: sv, name: [hit.varebenevnelse, hit.dimensjon].filter(Boolean).join(" ") };
          })
        );
        setSupplierLinks({ ...map });
      })
      .catch(() => {});
  }

  async function saveLinks(productId: string) {
    const links = DB_SUPPLIERS.map(s => ({ supplier: s, supplier_varenr: supplierLinks[s]?.varenr ?? "" }));
    await fetch(`/api/admin/katalog/${productId}/links`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links }),
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { setProdError("Navn er påkrevd"); return; }
    if (!form.category) { setProdError("Velg en kategori"); return; }
    setSaving(true); setProdError("");
    try {
      const body = { ...form, unit: form.unit || undefined, description: form.description || undefined };
      const res = editId
        ? await fetch(`/api/admin/katalog/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/admin/katalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setProdError(json.error ?? "Feil"); return; }
      // Save supplier links (use existing editId or newly created product id)
      const productId = editId ?? json.data?.id;
      if (productId) await saveLinks(productId);
      setShowModal(false);
      loadProducts();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    await fetch(`/api/admin/katalog/${deleteId}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteId(null);
    loadProducts();
  }

  // ── Import tab search ──────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "importer") return;
    if (importTimerRef.current) clearTimeout(importTimerRef.current);
    if (!importSearch.trim()) { setImportResults([]); setImportTotal(0); return; }
    importTimerRef.current = setTimeout(async () => {
      setImportLoading(true);
      try {
        const res = await fetch(`/api/admin/supplier-prices?supplier=${encodeURIComponent(importSupplier)}&q=${encodeURIComponent(importSearch)}&limit=50`);
        const json = await res.json();
        setImportResults(json.data ?? []);
        setImportTotal(json.count ?? 0);
      } finally {
        setImportLoading(false);
      }
    }, 280);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importSearch, importSupplier, tab]);

  // Extract a searchable term (dimension like "48x98" or first significant words)
  const extractSearchTerm = useMemo(() => (benevnelse: string, dimensjon?: string): string => {
    const combined = [benevnelse, dimensjon].filter(Boolean).join(" ");
    const dimMatch = combined.match(/\d+[x×X]\d+(?:[x×X]\d+)?/i);
    if (dimMatch) return dimMatch[0];
    const words = combined.split(/\s+/).filter(w => w.length > 3);
    return words.slice(0, 2).join(" ");
  }, []);

  async function openImportModal(hit: SupplierPriceHit) {
    const name = [hit.varebenevnelse, hit.dimensjon].filter(Boolean).join(" ");
    setImportModal(hit);
    setImportForm({ name, category: categories[0]?.label ?? "", unit: hit.enhet ?? "", description: "" });
    setImportLinks({ ...EMPTY_LINKS, [importSupplier]: { varenr: hit.varenr, name } });
    setSelectedGpId(null);
    setGpMatches([]);
    setSupplierMatches({});
    setImportError("");

    const searchTerm = extractSearchTerm(hit.varebenevnelse, hit.dimensjon);
    if (!searchTerm) return;
    setImportMatchLoading(true);
    try {
      const [gpRes, simRes] = await Promise.all([
        fetch(`/api/admin/katalog?q=${encodeURIComponent(searchTerm)}&limit=5`),
        fetch(`/api/admin/supplier-prices/similar?q=${encodeURIComponent(searchTerm)}&exclude_supplier=${encodeURIComponent(importSupplier)}&limit=5`),
      ]);
      const [gpJson, simJson] = await Promise.all([gpRes.json(), simRes.json()]);
      setGpMatches(gpJson.data ?? []);
      setSupplierMatches(simJson.data ?? {});
    } finally {
      setImportMatchLoading(false);
    }
  }

  function toggleSupplierMatch(supplier: string, hit: SupplierPriceHit) {
    setImportLinks(l => {
      if (l[supplier]?.varenr === hit.varenr) return { ...l, [supplier]: { varenr: "", name: "" } };
      return { ...l, [supplier]: { varenr: hit.varenr, name: [hit.varebenevnelse, hit.dimensjon].filter(Boolean).join(" ") } };
    });
  }

  async function handleImportSave() {
    if (!importModal) return;
    if (!importForm.name.trim()) { setImportError("Navn er påkrevd"); return; }
    if (!importForm.category) { setImportError("Velg en kategori"); return; }
    setImportSaving(true); setImportError("");
    try {
      let productId = selectedGpId;

      if (!productId) {
        const res = await fetch("/api/admin/katalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: importForm.name.trim(),
            category: importForm.category,
            unit: importForm.unit || undefined,
            description: importForm.description || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) { setImportError(json.error ?? "Feil ved opprettelse"); return; }
        productId = json.data?.id;
      }

      if (productId) {
        // If linking to existing GPV, merge with its current links
        const merged: LinkMap = { ...EMPTY_LINKS };
        if (selectedGpId) {
          const lr = await fetch(`/api/admin/katalog/${productId}/links`);
          const lj = await lr.json();
          for (const link of lj.data ?? []) merged[link.supplier as string] = { varenr: link.supplier_varenr, name: "" };
        }
        for (const sup of DB_SUPPLIERS) {
          if (importLinks[sup]?.varenr) merged[sup] = importLinks[sup];
        }
        const links = DB_SUPPLIERS.map(s => ({ supplier: s, supplier_varenr: merged[s]?.varenr ?? "" }));
        await fetch(`/api/admin/katalog/${productId}/links`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ links }),
        });
      }

      setImportModal(null);
      loadProducts();
    } finally {
      setImportSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <h1 className="text-xl font-bold text-gray-900">GP Varekatalog</h1>
          <div className="ml-auto flex gap-2">
            {tab === "produkter" && (
              <button onClick={openAdd} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
                + Ny vare
              </button>
            )}
            {tab === "kategorier" && (
              <button onClick={() => { setShowNewCat(true); setCatError(""); }} className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
                + Ny kategori
              </button>
            )}
            {tab === "importer" && (
              <span className="text-xs text-gray-400 self-center">Importer varer fra leverandørenes prisdatabase</span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 w-fit shadow-sm">
          {(["produkter", "kategorier", "importer"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors capitalize ${tab === t ? "bg-orange-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t === "produkter" ? `Produkter${total > 0 ? ` (${total})` : ""}` : t === "kategorier" ? "Kategorier" : "Importer fra leverandør"}
            </button>
          ))}
        </div>

        {/* ── Kategorier tab ───────────────────────────────────────────── */}
        {tab === "kategorier" && (
          <div className="space-y-3">
            {catError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">{catError}</div>
            )}

            {catsLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-400 shadow-sm">Laster…</div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {categories.length === 0 && !showNewCat && (
                  <div className="py-12 text-center text-sm text-gray-400">
                    Ingen kategorier ennå. Opprett tabellen i Supabase og legg til kategorier.
                  </div>
                )}
                {categories.map((cat, idx) => (
                  <div key={cat.id} className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0">

                    {/* Reorder buttons */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => moveCategory(cat.id, "up")}
                        disabled={idx === 0}
                        className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
                        title="Flytt opp"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveCategory(cat.id, "down")}
                        disabled={idx === categories.length - 1}
                        className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-not-allowed"
                        title="Flytt ned"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Content: edit inline or display */}
                    {editingCat === cat.id ? (
                      <div className="flex flex-1 items-center gap-3">
                        <input
                          type="text"
                          value={editCatLabel}
                          onChange={e => setEditCatLabel(e.target.value)}
                          className="flex-1 rounded-lg border border-orange-300 px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                          placeholder="Kategorinavn"
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-gray-500 whitespace-nowrap">GPV start:</label>
                          <input
                            type="number"
                            value={editCatStart}
                            onChange={e => setEditCatStart(parseInt(e.target.value) || 1000)}
                            className="w-20 rounded-lg border border-orange-300 px-2 py-1.5 text-sm text-right focus:border-orange-500 focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => saveCatEdit(cat.id)}
                          disabled={savingCat}
                          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                          {savingCat ? "…" : "Lagre"}
                        </button>
                        <button onClick={() => setEditingCat(null)} className="text-gray-400 hover:text-gray-600 text-xs">Avbryt</button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center gap-4">
                        <span className="font-medium text-gray-800">{cat.label}</span>
                        <span className="font-mono text-xs text-gray-400">GPV-{cat.varenr_start}+</span>
                      </div>
                    )}

                    {/* Actions */}
                    {editingCat !== cat.id && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => { setEditingCat(cat.id); setEditCatLabel(cat.label); setEditCatStart(cat.varenr_start); setCatError(""); }}
                          className="text-xs text-gray-400 hover:text-orange-500"
                        >
                          Rediger
                        </button>
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          disabled={deletingCat === cat.id}
                          className="text-xs text-gray-300 hover:text-red-500 disabled:opacity-50"
                        >
                          {deletingCat === cat.id ? "…" : "Slett"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* New category inline form */}
                {showNewCat && (
                  <div className="flex items-center gap-3 border-t border-orange-100 bg-orange-50 px-4 py-3">
                    <div className="w-7 shrink-0" />
                    <input
                      type="text"
                      value={newCat.label}
                      onChange={e => setNewCat(c => ({ ...c, label: e.target.value }))}
                      className="flex-1 rounded-lg border border-orange-300 px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                      placeholder="Kategorinavn, f.eks. Trevare"
                      autoFocus
                      onKeyDown={e => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") setShowNewCat(false); }}
                    />
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-gray-500 whitespace-nowrap">GPV start:</label>
                      <input
                        type="number"
                        value={newCat.varenr_start}
                        onChange={e => setNewCat(c => ({ ...c, varenr_start: parseInt(e.target.value) || 1000 }))}
                        className="w-20 rounded-lg border border-orange-300 px-2 py-1.5 text-sm text-right focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    <button
                      onClick={addCategory}
                      disabled={savingCat}
                      className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                      {savingCat ? "…" : "Legg til"}
                    </button>
                    <button onClick={() => setShowNewCat(false)} className="text-gray-400 hover:text-gray-600 text-xs">Avbryt</button>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-gray-400 px-1">
              GPV-start bestemmer nummereringen for varer i kategorien (f.eks. GPV-1000, GPV-1001…). Bruk steg på 1000 mellom kategorier.
            </p>
          </div>
        )}

        {/* ── Produkter tab ────────────────────────────────────────────── */}
        {tab === "produkter" && (
          <div className="space-y-4">

            {/* Category filter chips */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter("")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!categoryFilter ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
              >
                Alle
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.label === categoryFilter ? "" : cat.label)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${categoryFilter === cat.label ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Søk på varenr, navn eller beskrivelse…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
            />

            {/* Table */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {prodsLoading ? (
                <div className="py-16 text-center text-sm text-gray-400">Laster…</div>
              ) : products.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-sm font-medium text-gray-500">Ingen varer funnet</p>
                  {categories.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">Opprett kategorier først.</p>
                  )}
                  <button onClick={openAdd} className="mt-4 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">
                    + Legg til første vare
                  </button>
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 w-28">Varenr</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Navn</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 w-32">Kategori</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 w-20">Enhet</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500 hidden lg:table-cell">Beskrivelse</th>
                      <th className="px-4 py-3 w-24" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{p.varenr}</td>
                        <td className="px-4 py-3 text-gray-800 font-medium">{p.name}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">{p.category}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{p.unit ?? "—"}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate hidden lg:table-cell">{p.description ?? ""}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(p)} className="text-xs text-gray-400 hover:text-orange-500">Rediger</button>
                            <button onClick={() => setDeleteId(p.id)} className="text-xs text-gray-300 hover:text-red-500">Slett</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── Importer tab ─────────────────────────────────────────────── */}
        {tab === "importer" && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <select
                value={importSupplier}
                onChange={e => { setImportSupplier(e.target.value); setImportSearch(""); setImportResults([]); }}
                className="rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-orange-400 focus:outline-none"
              >
                {DB_SUPPLIERS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                type="text"
                placeholder={`Søk i ${importSupplier}s prisdatabase…`}
                value={importSearch}
                onChange={e => setImportSearch(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              />
            </div>

            {importSearch ? (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {importLoading ? (
                  <div className="py-12 text-center text-sm text-gray-400">Søker…</div>
                ) : importResults.length === 0 ? (
                  <div className="py-12 text-center text-sm text-gray-400">Ingen treff</div>
                ) : (
                  <>
                    {importTotal > 50 && (
                      <p className="border-b border-gray-50 px-4 py-2 text-xs text-gray-400">Viser 50 av {importTotal} treff — skriv mer for å avgrense</p>
                    )}
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-xs">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium text-gray-500 w-28">Varenr</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500">Navn</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500 w-28">Dimensjon</th>
                          <th className="px-4 py-3 text-left font-medium text-gray-500 w-16">Enhet</th>
                          <th className="px-4 py-3 text-right font-medium text-gray-500 w-24">Nettopris</th>
                          <th className="px-4 py-3 w-32" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {importResults.map(hit => (
                          <tr key={hit.varenr} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-mono text-xs text-gray-600">{hit.varenr}</td>
                            <td className="px-4 py-3 text-gray-800">{hit.varebenevnelse}</td>
                            <td className="px-4 py-3 text-xs text-gray-400">{hit.dimensjon ?? "—"}</td>
                            <td className="px-4 py-3 text-xs text-gray-400">{hit.enhet ?? "—"}</td>
                            <td className="px-4 py-3 text-right text-xs text-gray-600">
                              {hit.nettopris != null ? `${hit.nettopris.toLocaleString("nb-NO")} kr` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => openImportModal(hit)}
                                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600"
                              >
                                Importer →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
                <p className="text-sm font-medium text-gray-500">Søk i {importSupplier}s prisdatabase</p>
                <p className="mt-1 text-xs text-gray-400">Finn varer du vil legge inn i GP-katalogen</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Product add/edit modal ───────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "90vh" }}><div className="overflow-y-auto p-6">
            <h2 className="mb-4 text-base font-semibold text-gray-900">{editId ? "Rediger vare" : "Ny vare"}</h2>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-orange-400 focus:outline-none"
                  >
                    <option value="">Velg kategori</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.label}>{c.label} (GPV-{c.varenr_start}+)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Varenr <span className="text-gray-400">(auto hvis tom)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="GPV-1001"
                    value={form.varenr}
                    onChange={e => setForm(f => ({ ...f, varenr: e.target.value }))}
                    disabled={!!editId}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm font-mono focus:border-orange-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Navn <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="f.eks. Konstruksjonsvirke 48x148mm C24"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-orange-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Enhet</label>
                  <input
                    type="text"
                    placeholder="stk, m², lm, m, pk…"
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-orange-400 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Beskrivelse</label>
                <textarea
                  rows={2}
                  placeholder="Valgfri tilleggsinformasjon…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-orange-400 focus:outline-none resize-none"
                />
              </div>

              {/* Supplier varenr mapping */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">Leverandørtilknytning</label>
                <p className="mb-2 text-[10px] text-gray-400">Søk på varenr eller navn fra leverandørens prisdatabase for å knytte dem til dette GPV-varenummeret.</p>
                <div className="rounded-lg border border-gray-200 overflow-visible">
                  {DB_SUPPLIERS.map((sup, i) => (
                    <div key={sup} className={`flex items-start gap-3 px-3 py-2.5 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                      <span className="w-28 shrink-0 pt-1.5 text-xs font-medium text-gray-600">{sup}</span>
                      <SupplierVarenrPicker
                        supplier={sup}
                        varenr={supplierLinks[sup]?.varenr ?? ""}
                        name={supplierLinks[sup]?.name ?? ""}
                        onChange={(v, n) => setSupplierLinks(l => ({ ...l, [sup]: { varenr: v, name: n } }))}
                      />
                      {supplierLinks[sup]?.varenr && (
                        <button
                          type="button"
                          onClick={() => setSupplierLinks(l => ({ ...l, [sup]: { varenr: "", name: "" } }))}
                          className="shrink-0 pt-1.5 text-gray-300 hover:text-red-400"
                          title="Fjern kobling"
                        >✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {prodError && <p className="text-xs text-red-500">{prodError}</p>}
            </div>
          </div>

          <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
            <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
              {saving ? "Lagrer…" : editId ? "Lagre endringer" : "Legg til vare"}
            </button>
            <button onClick={() => setShowModal(false)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50">
              Avbryt
            </button>
          </div>
        </div>
      </div>
    )}

      {/* ── Import modal ────────────────────────────────────────────────── */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Importer til GP-katalog</h2>
              <p className="mt-0.5 text-xs text-gray-400">{importSupplier} varenr: {importModal.varenr}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Form */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Kategori <span className="text-red-500">*</span></label>
                    <select
                      value={importForm.category}
                      onChange={e => setImportForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-orange-400 focus:outline-none"
                    >
                      <option value="">Velg kategori</option>
                      {categories.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Enhet</label>
                    <input type="text" value={importForm.unit}
                      onChange={e => setImportForm(f => ({ ...f, unit: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-orange-400 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Navn i katalogen <span className="text-red-500">*</span></label>
                  <input type="text" value={importForm.name}
                    onChange={e => setImportForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-orange-400 focus:outline-none" />
                </div>
              </div>

              {/* Existing GP catalog matches */}
              {(gpMatches.length > 0 || importMatchLoading) && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-2">Allerede i katalogen?</p>
                  {importMatchLoading ? (
                    <p className="text-xs text-gray-400 animate-pulse">Søker…</p>
                  ) : (
                    <div className="space-y-1.5">
                      {gpMatches.map(gp => (
                        <div key={gp.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${selectedGpId === gp.id ? "border-orange-400 bg-orange-50" : "border-gray-200"}`}>
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-xs font-semibold text-orange-600">{gp.varenr}</span>
                            <span className="ml-2 text-xs text-gray-800">{gp.name}</span>
                            <span className="ml-1 text-xs text-gray-400">({gp.category})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedGpId(selectedGpId === gp.id ? null : gp.id)}
                            className={`shrink-0 rounded-lg px-3 py-1 text-xs font-medium transition-colors ${selectedGpId === gp.id ? "bg-orange-500 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                          >
                            {selectedGpId === gp.id ? "✓ Valgt" : "Knytt til denne"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Other supplier name matches */}
              {(DB_SUPPLIERS.some(s => s !== importSupplier && (supplierMatches[s]?.length ?? 0) > 0) || importMatchLoading) && (
                <div>
                  <p className="text-xs font-semibold text-gray-700 mb-1">Tilsvarende hos andre leverandører?</p>
                  <p className="mb-2 text-[10px] text-gray-400">Kryss av for varer som er det samme produktet — de kobles automatisk til GPV-varenummeret.</p>
                  {importMatchLoading ? (
                    <p className="text-xs text-gray-400 animate-pulse">Søker…</p>
                  ) : (
                    <div className="space-y-3">
                      {DB_SUPPLIERS.filter(s => s !== importSupplier).map(sup => {
                        const hits = supplierMatches[sup] ?? [];
                        if (!hits.length) return null;
                        return (
                          <div key={sup}>
                            <p className="mb-1 text-xs font-medium text-gray-500">{sup}</p>
                            <div className="space-y-1">
                              {hits.map(hit => {
                                const linked = importLinks[sup]?.varenr === hit.varenr;
                                return (
                                  <label
                                    key={hit.varenr}
                                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors ${linked ? "border-orange-300 bg-orange-50" : "border-gray-100 hover:bg-gray-50"}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={linked}
                                      onChange={() => toggleSupplierMatch(sup, hit)}
                                      className="h-3.5 w-3.5 accent-orange-500"
                                    />
                                    <span className="font-mono text-xs text-gray-600 shrink-0">{hit.varenr}</span>
                                    <span className="min-w-0 truncate text-xs text-gray-800">{[hit.varebenevnelse, hit.dimensjon].filter(Boolean).join(" ")}</span>
                                    {hit.nettopris != null && (
                                      <span className="ml-auto shrink-0 text-[10px] text-gray-400">{hit.nettopris.toLocaleString("nb-NO")} kr</span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Current supplier link summary */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Leverandørtilknytning som opprettes</p>
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                  {DB_SUPPLIERS.map(sup => (
                    <div key={sup} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-28 shrink-0 text-xs font-medium text-gray-600">{sup}</span>
                      {importLinks[sup]?.varenr ? (
                        <div className="flex flex-1 items-center gap-2">
                          <span className="rounded bg-green-50 px-1.5 py-0.5 font-mono text-xs text-green-700">{importLinks[sup].varenr}</span>
                          <span className="min-w-0 truncate text-xs text-gray-400">{importLinks[sup].name}</span>
                          {sup !== importSupplier && (
                            <button
                              onClick={() => setImportLinks(l => ({ ...l, [sup]: { varenr: "", name: "" } }))}
                              className="ml-auto shrink-0 text-gray-300 hover:text-red-400"
                            >✕</button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {importError && <p className="text-xs text-red-500">{importError}</p>}
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={handleImportSave}
                disabled={importSaving}
                className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {importSaving ? "Lagrer…" : selectedGpId ? "Knytt til valgt GPV-vare" : "Opprett ny GPV-vare"}
              </button>
              <button onClick={() => setImportModal(null)} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete product confirmation ──────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-gray-900">Slett vare?</h2>
            <p className="mt-2 text-sm text-gray-500">
              {products.find(p => p.id === deleteId)?.varenr} — {products.find(p => p.id === deleteId)?.name}
            </p>
            <div className="mt-5 flex gap-3">
              <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50">
                {deleting ? "Sletter…" : "Ja, slett"}
              </button>
              <button onClick={() => setDeleteId(null)} className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
