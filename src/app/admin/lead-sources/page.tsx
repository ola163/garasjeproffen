"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

interface LeadSource {
  id: string;
  label: string;
  value: string;
  sort_order: number;
}

function toValue(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export default function LeadSourcesAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    supabase.from("lead_sources").select("*").order("sort_order").then(({ data }) => {
      if (data) setSources(data as LeadSource[]);
      setLoading(false);
    });
  }, [user]);

  async function handleAdd() {
    if (!supabase || !newLabel.trim()) return;
    setAdding(true);
    const value = toValue(newLabel.trim());
    const maxOrder = sources.reduce((m, s) => Math.max(m, s.sort_order), 0);
    const { data, error } = await supabase.from("lead_sources").insert({
      label: newLabel.trim(),
      value,
      sort_order: maxOrder + 1,
    }).select().single();
    if (!error && data) {
      setSources((prev) => [...prev, data as LeadSource]);
      setNewLabel("");
    }
    setAdding(false);
  }

  async function handleSaveLabel(src: LeadSource) {
    if (!supabase || !editingLabel.trim()) return;
    setSaving(true);
    await supabase.from("lead_sources").update({ label: editingLabel.trim() }).eq("id", src.id);
    setSources((prev) => prev.map((s) => s.id === src.id ? { ...s, label: editingLabel.trim() } : s));
    setEditingId(null);
    setSaving(false);
  }

  async function handleDelete(src: LeadSource) {
    if (!supabase) return;
    await supabase.from("lead_sources").delete().eq("id", src.id);
    setSources((prev) => prev.filter((s) => s.id !== src.id));
  }

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster...</div>;
  if (!supabase) return null;
  if (!user || !ALLOWED_ADMINS.includes(user.email?.toLowerCase() ?? "")) {
    router.push("/admin/quotes");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <div className="mb-6">
          <Link href="/admin/quotes" className="text-sm text-orange-600 hover:text-orange-800">← Forespørsler</Link>
          <h1 className="mt-2 text-xl font-bold text-gray-900">Lead kilder</h1>
          <p className="mt-0.5 text-xs text-gray-400">Administrer hvilke lead kilder som vises i dropdown-menyene.</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          {/* Add new */}
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="Ny lead kilde (f.eks. Instagram)"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newLabel.trim()}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
            >
              {adding ? "Legger til…" : "+ Legg til"}
            </button>
          </div>

          {/* List */}
          {sources.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Ingen lead kilder ennå.</p>
          ) : (
            <ul className="space-y-1.5">
              {sources.map((src) => (
                <li key={src.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  {editingId === src.id ? (
                    <>
                      <input
                        type="text"
                        value={editingLabel}
                        onChange={(e) => setEditingLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSaveLabel(src); if (e.key === "Escape") setEditingId(null); }}
                        autoFocus
                        className="flex-1 rounded border border-orange-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                      <button onClick={() => handleSaveLabel(src)} disabled={saving} className="text-xs text-orange-600 font-medium hover:text-orange-800">Lagre</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600">Avbryt</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-800">{src.label}</span>
                      <span className="text-xs text-gray-400">{src.value}</span>
                      <button
                        onClick={() => { setEditingId(src.id); setEditingLabel(src.label); }}
                        className="text-gray-300 hover:text-gray-500"
                        title="Endre navn"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 15H9v-3z" /></svg>
                      </button>
                      <button
                        onClick={() => handleDelete(src)}
                        className="text-gray-300 hover:text-red-500"
                        title="Slett"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
