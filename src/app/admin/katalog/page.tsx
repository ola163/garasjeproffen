"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";

interface GpCategory {
  id: string;
  label: string;
  sort_order: number;
  varenr_start: number;
  varenr_end?: number | null;
  parent_id?: string | null;
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
interface CatNode { cat: GpCategory; children: CatNode[] }

const DB_SUPPLIERS = ["Optimera", "XLBygg", "Coop Obs Bygg", "Neumann"];
const SUPPLIER_ABBR: Record<string, string> = { Optimera: "Opt", XLBygg: "XL", "Coop Obs Bygg": "Coop", Neumann: "Neu" };

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
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editCatLabel, setEditCatLabel] = useState("");
  const [editCatStart, setEditCatStart] = useState(1000);
  const [editCatEnd, setEditCatEnd] = useState<number | "">("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState(EMPTY_CAT);
  const [addingSubcatTo, setAddingSubcatTo] = useState<string | null>(null);
  const [newSubcat, setNewSubcat] = useState({ label: "", varenr_start: 0, varenr_end: 0 });
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

  // ── Supplier links map (all products) ──────────────────────────────────
  const [linksMap, setLinksMap] = useState<Record<string, Record<string, string>>>({});
  const [linkModalProduct, setLinkModalProduct] = useState<GpProduct | null>(null);
  const [linkModalLinks, setLinkModalLinks] = useState<LinkMap>({ ...EMPTY_LINKS });
  const [linkModalSuggestions, setLinkModalSuggestions] = useState<Record<string, SupplierPriceHit[]>>({});
  const [linkModalSuggestionsLoading, setLinkModalSuggestionsLoading] = useState(false);
  const [savingLinkModal, setSavingLinkModal] = useState(false);

  // ── Merge duplicates ───────────────────────────────────────────────────
  const [mergeSource, setMergeSource] = useState<GpProduct | null>(null);
  const [mergeQuery, setMergeQuery] = useState("");
  const [mergeTargets, setMergeTargets] = useState<GpProduct[]>([]);
  const [mergeTargetLoading, setMergeTargetLoading] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<GpProduct | null>(null);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState("");

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

  // ── Load all supplier links ────────────────────────────────────────────
  const loadLinks = useCallback(async () => {
    const res = await fetch("/api/admin/katalog/links");
    const json = await res.json();
    const map: Record<string, Record<string, string>> = {};
    for (const l of json.data ?? []) {
      if (!map[l.gp_varenr]) map[l.gp_varenr] = {};
      map[l.gp_varenr][l.supplier] = l.supplier_varenr;
    }
    setLinksMap(map);
  }, []);

  useEffect(() => { loadCats(); }, [loadCats]);
  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { loadLinks(); }, [loadLinks]);

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
    const body: Record<string, unknown> = { label: editCatLabel, varenr_start: editCatStart };
    if (editCatEnd !== "") body.varenr_end = editCatEnd;
    const res = await fetch(`/api/admin/katalog/kategorier/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

  async function addSubcategory(parentId: string) {
    if (!newSubcat.label.trim()) { setCatError("Navn er påkrevd"); return; }
    if (!newSubcat.varenr_start || !newSubcat.varenr_end) { setCatError("Start og slutt GPV-nr er påkrevd"); return; }
    setSavingCat(true); setCatError("");
    const res = await fetch("/api/admin/katalog/kategorier", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: newSubcat.label.trim(),
        varenr_start: newSubcat.varenr_start,
        varenr_end: newSubcat.varenr_end,
        parent_id: parentId,
      }),
    });
    const json = await res.json();
    setSavingCat(false);
    if (!res.ok) { setCatError(json.error ?? "Feil"); return; }
    setAddingSubcatTo(null);
    setNewSubcat({ label: "", varenr_start: 0, varenr_end: 0 });
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

  // ── Supplier link modal ────────────────────────────────────────────────
  async function openLinkModal(p: GpProduct) {
    const existing = linksMap[p.varenr] ?? {};
    const map: LinkMap = { ...EMPTY_LINKS };
    for (const sup of DB_SUPPLIERS) {
      if (existing[sup]) map[sup] = { varenr: existing[sup], name: "" };
    }
    setLinkModalLinks(map);
    setLinkModalSuggestions({});
    setLinkModalProduct(p);

    // Fetch descriptions for existing links + auto-suggestions in parallel
    const descTask = Promise.all(
      DB_SUPPLIERS.map(async (sup) => {
        const sv = existing[sup];
        if (!sv) return;
        const r = await fetch(`/api/admin/supplier-prices?supplier=${encodeURIComponent(sup)}&q=${encodeURIComponent(sv)}&limit=1`);
        const j = await r.json();
        const hit = j.data?.[0];
        if (hit) setLinkModalLinks(prev => ({
          ...prev,
          [sup]: { varenr: sv, name: [hit.varebenevnelse, hit.dimensjon].filter(Boolean).join(" ") },
        }));
      })
    );

    // Auto-suggest matching items from all suppliers based on product name
    const searchTerm = extractSearchTerm(p.name);
    if (searchTerm) {
      setLinkModalSuggestionsLoading(true);
      const simTask = fetch(`/api/admin/supplier-prices/similar?q=${encodeURIComponent(searchTerm)}&limit=5`)
        .then(r => r.json())
        .then(j => setLinkModalSuggestions(j.data ?? {}))
        .catch(() => {})
        .finally(() => setLinkModalSuggestionsLoading(false));
      await Promise.all([descTask, simTask]);
    } else {
      await descTask;
    }
  }

  async function saveLinkModal() {
    if (!linkModalProduct) return;
    setSavingLinkModal(true);
    const links = DB_SUPPLIERS.map(s => ({ supplier: s, supplier_varenr: linkModalLinks[s]?.varenr ?? "" }));
    await fetch(`/api/admin/katalog/${linkModalProduct.id}/links`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ links }),
    });
    setSavingLinkModal(false);
    setLinkModalProduct(null);
    loadLinks();
  }

  // ── Merge: search for target product ──────────────────────────────────
  useEffect(() => {
    if (!mergeSource || !mergeQuery.trim()) { setMergeTargets([]); return; }
    let cancelled = false;
    setMergeTargetLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/katalog?q=${encodeURIComponent(mergeQuery)}&limit=8`);
        const json = await res.json();
        if (!cancelled) setMergeTargets((json.data ?? []).filter((p: GpProduct) => p.id !== mergeSource.id));
      } finally {
        if (!cancelled) setMergeTargetLoading(false);
      }
    }, 280);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergeQuery, mergeSource]);

  async function handleMerge() {
    if (!mergeSource || !mergeTarget) return;
    setMerging(true);
    setMergeError("");
    try {
      const res = await fetch("/api/admin/katalog/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromId: mergeSource.id, toId: mergeTarget.id }),
      });
      const json = await res.json();
      if (!res.ok) { setMergeError(json.error ?? "Feil"); return; }
      setMergeSource(null);
      setMergeTarget(null);
      setMergeQuery("");
      loadProducts();
      loadLinks();
    } finally {
      setMerging(false);
    }
  }

  // ── Import tab search ──────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "importer") return;
    if (importTimerRef.current) clearTimeout(importTimerRef.current);
    // Debounce typed queries; load immediately on supplier change or tab open (no query)
    const delay = importSearch.trim() ? 280 : 0;
    importTimerRef.current = setTimeout(async () => {
      setImportLoading(true);
      try {
        const params = new URLSearchParams({ supplier: importSupplier, limit: "50" });
        if (importSearch.trim()) params.set("q", importSearch.trim());
        const res = await fetch(`/api/admin/supplier-prices?${params}`);
        const json = await res.json();
        setImportResults(json.data ?? []);
        setImportTotal(json.count ?? 0);
      } finally {
        setImportLoading(false);
      }
    }, delay);
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
        {tab === "kategorier" && (() => {
          function buildTree(parentId: string | null): CatNode[] {
            return categories
              .filter(c => (c.parent_id ?? null) === parentId)
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(cat => ({ cat, children: buildTree(cat.id) }));
          }
          const tree = buildTree(null);

          function renderNode(node: CatNode, depth: number, siblings: CatNode[]): React.ReactNode {
            const { cat, children } = node;
            const idx = siblings.indexOf(node);
            const pl = depth * 28 + 16;
            const isEditing = editingCat === cat.id;
            const isAddingHere = addingSubcatTo === cat.id;
            const bg = depth === 0 ? "bg-gray-50/70" : depth === 1 ? "bg-white" : "bg-gray-50/30";

            return (
              <div key={cat.id}>
                {/* Category row */}
                <div className={`flex items-center gap-2 border-t border-gray-50 py-2.5 pr-4 ${bg}`} style={{ paddingLeft: pl }}>
                  {depth > 0 && <span className="text-gray-200 shrink-0 text-xs select-none">{"└"}</span>}
                  {/* Reorder */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveCategory(cat.id, "up")} disabled={idx === 0}
                      className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7"/></svg>
                    </button>
                    <button onClick={() => moveCategory(cat.id, "down")} disabled={idx === siblings.length - 1}
                      className="rounded p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                  </div>

                  {/* Edit / display */}
                  {isEditing ? (
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <input type="text" value={editCatLabel} autoFocus onChange={e => setEditCatLabel(e.target.value)}
                        className="flex-1 min-w-28 rounded-lg border border-orange-300 px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
                      <label className="text-xs text-gray-500">Fra:</label>
                      <input type="number" value={editCatStart} onChange={e => setEditCatStart(parseInt(e.target.value) || 0)}
                        className="w-20 rounded-lg border border-orange-300 px-2 py-1.5 text-sm text-right focus:outline-none" />
                      <label className="text-xs text-gray-500">Til:</label>
                      <input type="number" value={editCatEnd} onChange={e => setEditCatEnd(parseInt(e.target.value) || "")}
                        placeholder="—"
                        className="w-20 rounded-lg border border-orange-300 px-2 py-1.5 text-sm text-right focus:outline-none" />
                      <button onClick={() => saveCatEdit(cat.id)} disabled={savingCat}
                        className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50">
                        {savingCat ? "…" : "Lagre"}
                      </button>
                      <button onClick={() => setEditingCat(null)} className="text-xs text-gray-400 hover:text-gray-600">Avbryt</button>
                    </div>
                  ) : (
                    <div className="flex flex-1 items-center gap-3 min-w-0">
                      <span className={`font-${depth === 0 ? "semibold" : "medium"} text-gray-${depth === 0 ? "800" : "700"} text-${depth >= 2 ? "xs" : "sm"}`}>
                        {cat.label}
                      </span>
                      <span className="font-mono text-xs text-blue-400">
                        GPV-{cat.varenr_start}{cat.varenr_end ? `–${cat.varenr_end}` : "+"}
                      </span>
                      {cat.varenr_end && (
                        <span className="text-xs text-gray-300">{cat.varenr_end - cat.varenr_start + 1} stk</span>
                      )}
                      {children.length > 0 && (
                        <span className="text-xs text-gray-300">{children.length} under</span>
                      )}
                    </div>
                  )}

                  {!isEditing && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => { setEditingCat(cat.id); setEditCatLabel(cat.label); setEditCatStart(cat.varenr_start); setEditCatEnd(cat.varenr_end ?? ""); setCatError(""); }}
                        className="text-xs text-gray-400 hover:text-orange-500">Rediger</button>
                      <button onClick={() => deleteCategory(cat.id)} disabled={deletingCat === cat.id}
                        className="text-xs text-gray-300 hover:text-red-500 disabled:opacity-50">
                        {deletingCat === cat.id ? "…" : "Slett"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Recursive children */}
                {children.map(child => renderNode(child, depth + 1, children))}

                {/* Add sub-subcategory form or button */}
                {isAddingHere ? (
                  <div className="flex flex-wrap items-end gap-2 border-t border-blue-100 bg-blue-50 py-3 pr-4"
                    style={{ paddingLeft: pl + 28 }}>
                    <div className="flex-1 min-w-28">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Navn</label>
                      <input type="text" value={newSubcat.label} autoFocus
                        onChange={e => setNewSubcat(s => ({ ...s, label: e.target.value }))}
                        placeholder={`f.eks. ${depth === 0 ? "Spiker" : "Dykkspiker"}`}
                        className="w-full rounded-lg border border-blue-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">GPV fra</label>
                      <input type="number" value={newSubcat.varenr_start || ""}
                        onChange={e => setNewSubcat(s => ({ ...s, varenr_start: parseInt(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-blue-300 px-2 py-1.5 text-sm text-right focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">GPV til</label>
                      <input type="number" value={newSubcat.varenr_end || ""}
                        onChange={e => setNewSubcat(s => ({ ...s, varenr_end: parseInt(e.target.value) || 0 }))}
                        className="w-20 rounded-lg border border-blue-300 px-2 py-1.5 text-sm text-right focus:outline-none" />
                    </div>
                    <button onClick={() => addSubcategory(cat.id)} disabled={savingCat}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                      {savingCat ? "…" : "Legg til"}
                    </button>
                    <button onClick={() => { setAddingSubcatTo(null); setCatError(""); }}
                      className="text-xs text-gray-400 hover:text-gray-600 self-end pb-1.5">Avbryt</button>
                  </div>
                ) : depth < 2 && (
                  <button
                    onClick={() => { setAddingSubcatTo(cat.id); setNewSubcat({ label: "", varenr_start: cat.varenr_start, varenr_end: cat.varenr_end ?? cat.varenr_start + 199 }); }}
                    className="flex w-full items-center gap-1.5 border-t border-gray-50 py-1.5 pr-4 text-xs text-blue-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    style={{ paddingLeft: pl + 28 }}>
                    + Legg til underkategori
                  </button>
                )}
              </div>
            );
          }
          return (
          <div className="space-y-3">
            {catError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">{catError}</div>
            )}

            {catsLoading ? (
              <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-400 shadow-sm">Laster…</div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {tree.length === 0 && !showNewCat && (
                  <div className="py-12 text-center text-sm text-gray-400">
                    Ingen kategorier ennå. Legg til din første kategori.
                  </div>
                )}
                {tree.map(node => renderNode(node, 0, tree))}

                {/* New root category form */}
                {showNewCat && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-orange-100 bg-orange-50 px-4 py-3">
                    <div className="w-7 shrink-0" />
                    <input type="text" value={newCat.label} autoFocus
                      onChange={e => setNewCat(c => ({ ...c, label: e.target.value }))}
                      placeholder="Kategorinavn, f.eks. Trevare"
                      onKeyDown={e => { if (e.key === "Enter") addCategory(); if (e.key === "Escape") setShowNewCat(false); }}
                      className="flex-1 min-w-32 rounded-lg border border-orange-300 px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs text-gray-500 whitespace-nowrap">GPV start:</label>
                      <input type="number" value={newCat.varenr_start}
                        onChange={e => setNewCat(c => ({ ...c, varenr_start: parseInt(e.target.value) || 1000 }))}
                        className="w-20 rounded-lg border border-orange-300 px-2 py-1.5 text-sm text-right focus:border-orange-500 focus:outline-none" />
                    </div>
                    <button onClick={addCategory} disabled={savingCat}
                      className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50">
                      {savingCat ? "…" : "Legg til"}
                    </button>
                    <button onClick={() => setShowNewCat(false)} className="text-xs text-gray-400 hover:text-gray-600">Avbryt</button>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-gray-400 px-1">
              Underkategorier får eget GPV-nummerområde (f.eks. GPV-1000 til GPV-1199). Produkter i underkategorien får nr innen dette området.
            </p>
          </div>
          );
        })()}

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
                      <th className="px-4 py-3 text-left font-medium text-gray-500 w-36 hidden md:table-cell">Leverandører</th>
                      <th className="px-4 py-3 w-28" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {products.map(p => {
                      const pLinks = linksMap[p.varenr] ?? {};
                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{p.varenr}</td>
                          <td className="px-4 py-3 text-gray-800 font-medium">{p.name}</td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">{p.category}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">{p.unit ?? "—"}</td>
                          <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate hidden lg:table-cell">{p.description ?? ""}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="flex gap-1 flex-wrap">
                              {DB_SUPPLIERS.map(s => (
                                <span
                                  key={s}
                                  title={pLinks[s] ? `${s}: ${pLinks[s]}` : s}
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${pLinks[s] ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-300"}`}
                                >
                                  {SUPPLIER_ABBR[s] ?? s.slice(0, 3)}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openLinkModal(p)} className="text-xs text-blue-400 hover:text-blue-600">Koblinger</button>
                              <button onClick={() => openEdit(p)} className="text-xs text-gray-400 hover:text-orange-500">Rediger</button>
                              <button onClick={() => { setMergeSource(p); setMergeTarget(null); setMergeQuery(p.name); setMergeError(""); }} className="text-xs text-gray-300 hover:text-purple-500">Slå sammen</button>
                              <button onClick={() => setDeleteId(p.id)} className="text-xs text-gray-300 hover:text-red-500">Slett</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {importLoading ? (
                <div className="py-12 text-center text-sm text-gray-400">Laster…</div>
              ) : importResults.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  {importSearch ? "Ingen treff" : `Ingen varer funnet for ${importSupplier}`}
                </div>
              ) : (
                <>
                  <p className="border-b border-gray-50 px-4 py-2 text-xs text-gray-400">
                    {importSearch
                      ? `${importTotal ?? importResults.length} treff${(importTotal ?? 0) > 50 ? " — skriv mer for å avgrense" : ""}`
                      : `Viser de første 50 varene fra ${importSupplier} — søk for å filtrere`}
                  </p>
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
                      {categories.map(c => <option key={c.id} value={c.label}>{c.label} (GPV-{c.varenr_start}–{c.varenr_start + 999})</option>)}
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

      {/* ── Supplier link modal ─────────────────────────────────────────── */}
      {linkModalProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Leverandørkoblinger</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                <span className="font-mono font-semibold text-orange-600">{linkModalProduct.varenr}</span>
                <span className="ml-2">{linkModalProduct.name}</span>
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* Auto-suggestions */}
              {(linkModalSuggestionsLoading || DB_SUPPLIERS.some(s => (linkModalSuggestions[s]?.length ?? 0) > 0)) && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-gray-700">
                    Automatiske forslag
                    {linkModalSuggestionsLoading && <span className="ml-2 text-gray-400 font-normal animate-pulse">Søker…</span>}
                  </p>
                  <p className="mb-2 text-[10px] text-gray-400">Kryss av varer som er det samme produktet. De kobles automatisk til GPV-nummeret.</p>
                  <div className="space-y-3">
                    {DB_SUPPLIERS.map(sup => {
                      const hits = linkModalSuggestions[sup] ?? [];
                      if (!hits.length) return null;
                      const already = linkModalLinks[sup]?.varenr;
                      return (
                        <div key={sup}>
                          <p className="mb-1 text-xs font-medium text-gray-500">{sup}</p>
                          <div className="space-y-1">
                            {hits.map(hit => {
                              const label = [hit.varebenevnelse, hit.dimensjon].filter(Boolean).join(" ");
                              const isSelected = already === hit.varenr;
                              return (
                                <label
                                  key={hit.varenr}
                                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors ${isSelected ? "border-orange-300 bg-orange-50" : "border-gray-100 hover:bg-gray-50"}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => setLinkModalLinks(l => ({
                                      ...l,
                                      [sup]: isSelected ? { varenr: "", name: "" } : { varenr: hit.varenr, name: label },
                                    }))}
                                    className="h-3.5 w-3.5 accent-orange-500"
                                  />
                                  <span className="font-mono text-xs text-gray-600 shrink-0">{hit.varenr}</span>
                                  <span className="min-w-0 truncate text-xs text-gray-800">{label}</span>
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
                </div>
              )}

              {/* Manual pickers */}
              <div>
                <p className="mb-2 text-xs font-semibold text-gray-700">Manuell tilknytning</p>
                <p className="mb-2 text-[10px] text-gray-400">Søk på varenr eller navn fra leverandørens prisdatabase.</p>
                <div className="rounded-lg border border-gray-200 overflow-visible">
                  {DB_SUPPLIERS.map((sup, i) => (
                    <div key={sup} className={`flex items-start gap-3 px-3 py-2.5 ${i > 0 ? "border-t border-gray-100" : ""}`}>
                      <span className="w-28 shrink-0 pt-1.5 text-xs font-medium text-gray-600">{sup}</span>
                      <SupplierVarenrPicker
                        supplier={sup}
                        varenr={linkModalLinks[sup]?.varenr ?? ""}
                        name={linkModalLinks[sup]?.name ?? ""}
                        onChange={(v, n) => setLinkModalLinks(l => ({ ...l, [sup]: { varenr: v, name: n } }))}
                      />
                      {linkModalLinks[sup]?.varenr && (
                        <button
                          type="button"
                          onClick={() => setLinkModalLinks(l => ({ ...l, [sup]: { varenr: "", name: "" } }))}
                          className="shrink-0 pt-1.5 text-gray-300 hover:text-red-400"
                          title="Fjern kobling"
                        >✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={saveLinkModal}
                disabled={savingLinkModal}
                className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {savingLinkModal ? "Lagrer…" : "Lagre koblinger"}
              </button>
              <button
                onClick={() => setLinkModalProduct(null)}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Merge duplicates modal ──────────────────────────────────────── */}
      {mergeSource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "90vh" }}>
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Slå sammen duplikater</h2>
              <p className="mt-0.5 text-xs text-gray-400">Kilde slettes. Alle unike leverandørkoblinger flyttes til målet.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Source product */}
              <div>
                <p className="mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Slettes (kilde)</p>
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <span className="font-mono text-xs font-semibold text-red-600">{mergeSource.varenr}</span>
                  <span className="ml-2 text-sm text-gray-800">{mergeSource.name}</span>
                  <span className="ml-2 text-xs text-gray-400">({mergeSource.category})</span>
                  <div className="mt-1.5 flex gap-1 flex-wrap">
                    {DB_SUPPLIERS.map(s => {
                      const v = linksMap[mergeSource.varenr]?.[s];
                      return v ? (
                        <span key={s} className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-[10px] text-red-700">{SUPPLIER_ABBR[s]}: {v}</span>
                      ) : null;
                    })}
                  </div>
                </div>
              </div>

              {/* Target search */}
              <div>
                <p className="mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Beholdes (mål)</p>
                <input
                  type="text"
                  placeholder="Søk etter mål-vare…"
                  value={mergeQuery}
                  onChange={e => { setMergeQuery(e.target.value); setMergeTarget(null); }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                  autoFocus
                />
                {mergeTargetLoading && <p className="mt-1 text-xs text-gray-400 animate-pulse">Søker…</p>}
                {!mergeTargetLoading && mergeTargets.length > 0 && !mergeTarget && (
                  <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                    {mergeTargets.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setMergeTarget(p)}
                        className="flex w-full items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-left hover:border-purple-300 hover:bg-purple-50 transition-colors"
                      >
                        <span className="font-mono text-xs font-semibold text-purple-600">{p.varenr}</span>
                        <span className="text-sm text-gray-800 truncate">{p.name}</span>
                        <span className="ml-auto text-xs text-gray-400">{p.category}</span>
                      </button>
                    ))}
                  </div>
                )}
                {mergeTarget && (
                  <div className="mt-2 rounded-lg border border-purple-300 bg-purple-50 px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-purple-600">{mergeTarget.varenr}</span>
                    <span className="ml-2 text-sm text-gray-800">{mergeTarget.name}</span>
                    <button onClick={() => setMergeTarget(null)} className="ml-2 text-xs text-gray-400 hover:text-red-500">✕ Endre</button>
                    <div className="mt-1.5 flex gap-1 flex-wrap">
                      {DB_SUPPLIERS.map(s => {
                        const v = linksMap[mergeTarget.varenr]?.[s];
                        return v ? (
                          <span key={s} className="rounded bg-purple-100 px-1.5 py-0.5 font-mono text-[10px] text-purple-700">{SUPPLIER_ABBR[s]}: {v}</span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {mergeError && <p className="text-xs text-red-500">{mergeError}</p>}

              {mergeTarget && (
                <p className="text-xs text-gray-400">
                  Leverandørkoblinger fra <span className="font-mono">{mergeSource.varenr}</span> som ikke finnes hos <span className="font-mono">{mergeTarget.varenr}</span> flyttes over. Konflikter (samme leverandør, ulik varenr) beholdes hos målet.
                </p>
              )}
            </div>

            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button
                onClick={handleMerge}
                disabled={!mergeTarget || merging}
                className="flex-1 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {merging ? "Slår sammen…" : `Slå sammen → behold ${mergeTarget?.varenr ?? "…"}`}
              </button>
              <button
                onClick={() => { setMergeSource(null); setMergeTarget(null); setMergeQuery(""); }}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
              >
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
