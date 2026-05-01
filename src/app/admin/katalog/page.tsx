"use client";

import { useState, useEffect, useCallback } from "react";
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

const EMPTY_PRODUCT = { varenr: "", name: "", category: "", unit: "", description: "" };
const EMPTY_CAT = { label: "", varenr_start: 1000 };

export default function KatalogPage() {
  const [tab, setTab] = useState<"produkter" | "kategorier">("produkter");

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
    setProdError("");
    setShowModal(true);
  }

  function openEdit(p: GpProduct) {
    setEditId(p.id);
    setForm({ varenr: p.varenr, name: p.name, category: p.category, unit: p.unit ?? "", description: p.description ?? "" });
    setProdError("");
    setShowModal(true);
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
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-1 rounded-xl border border-gray-200 bg-white p-1 w-fit shadow-sm">
          {(["produkter", "kategorier"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors capitalize ${tab === t ? "bg-orange-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t === "produkter" ? `Produkter${total > 0 ? ` (${total})` : ""}` : "Kategorier"}
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
      </div>

      {/* ── Product add/edit modal ───────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
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

              {prodError && <p className="text-xs text-red-500">{prodError}</p>}
            </div>

            <div className="mt-5 flex gap-3">
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
