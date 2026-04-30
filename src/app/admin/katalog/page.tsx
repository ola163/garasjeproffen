"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const CATEGORIES: { key: string; label: string; prefix: string; color: string }[] = [
  { key: "material",    label: "Material",    prefix: "GPV-1xxx", color: "bg-blue-100 text-blue-700" },
  { key: "festemidler", label: "Festemidler", prefix: "GPV-2xxx", color: "bg-orange-100 text-orange-700" },
  { key: "isolasjon",   label: "Isolasjon",   prefix: "GPV-3xxx", color: "bg-yellow-100 text-yellow-700" },
  { key: "membran",     label: "Membran",     prefix: "GPV-4xxx", color: "bg-purple-100 text-purple-700" },
  { key: "ventilasjon", label: "Ventilasjon", prefix: "GPV-5xxx", color: "bg-cyan-100 text-cyan-700" },
  { key: "elektro",     label: "Elektro",     prefix: "GPV-6xxx", color: "bg-green-100 text-green-700" },
  { key: "diverse",     label: "Diverse",     prefix: "GPV-9xxx", color: "bg-gray-100 text-gray-600" },
];

interface GpProduct {
  id: string;
  varenr: string;
  name: string;
  category: string;
  unit?: string;
  description?: string;
  created_at: string;
}

const EMPTY_FORM = { varenr: "", name: "", category: "material", unit: "", description: "" };

export default function KatalogPage() {
  const [products, setProducts] = useState<GpProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [total, setTotal] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (searchQ) params.set("q", searchQ);
    if (categoryFilter) params.set("category", categoryFilter);
    const res = await fetch(`/api/admin/katalog?${params}`);
    const json = await res.json();
    setProducts(json.data ?? []);
    setTotal(json.count ?? 0);
    setLoading(false);
  }, [searchQ, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowModal(true);
  }

  function openEdit(p: GpProduct) {
    setEditId(p.id);
    setForm({ varenr: p.varenr, name: p.name, category: p.category, unit: p.unit ?? "", description: p.description ?? "" });
    setError("");
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Navn er påkrevd"); return; }
    setSaving(true); setError("");
    try {
      const body = { ...form, unit: form.unit || undefined, description: form.description || undefined };
      const res = editId
        ? await fetch(`/api/admin/katalog/${editId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/admin/katalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Feil"); return; }
      setShowModal(false);
      load();
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
    load();
  }

  function catMeta(key: string) {
    return CATEGORIES.find(c => c.key === key) ?? { label: key, prefix: "", color: "bg-gray-100 text-gray-600" };
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <h1 className="text-xl font-bold text-gray-900">GP Varekatalog</h1>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">{total} varer</span>
          <button
            onClick={openAdd}
            className="ml-auto rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            + Ny vare
          </button>
        </div>

        {/* Category legend */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!categoryFilter ? "bg-gray-800 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
          >
            Alle
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key === categoryFilter ? "" : cat.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${categoryFilter === cat.key ? cat.color + " ring-2 ring-offset-1 ring-current" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              {cat.label} <span className="opacity-60">{cat.prefix}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Søk på varenr, navn eller beskrivelse…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
          />
        </div>

        {/* Table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-16 text-center text-sm text-gray-400">Laster…</div>
          ) : products.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-medium text-gray-500">Ingen varer funnet</p>
              {!searchQ && !categoryFilter && (
                <p className="mt-1 text-xs text-gray-400">
                  Opprett Supabase-tabellen <code className="bg-gray-100 px-1 rounded">gp_products</code> og legg til varer.
                </p>
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
                  <th className="px-4 py-3 text-right font-medium text-gray-500 w-24">Handlinger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(p => {
                  const cat = catMeta(p.category);
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{p.varenr}</td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{p.name}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cat.color}`}>{cat.label}</span>
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
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="mb-4 text-base font-semibold text-gray-900">
              {editId ? "Rediger vare" : "Ny vare"}
            </h2>

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
                    {CATEGORIES.map(c => (
                      <option key={c.key} value={c.key}>{c.label} ({c.prefix})</option>
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
                <div />
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

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? "Lagrer…" : editId ? "Lagre endringer" : "Legg til vare"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-gray-900">Slett vare?</h2>
            <p className="mt-2 text-sm text-gray-500">
              {products.find(p => p.id === deleteId)?.varenr} — {products.find(p => p.id === deleteId)?.name}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? "Sletter…" : "Ja, slett"}
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
