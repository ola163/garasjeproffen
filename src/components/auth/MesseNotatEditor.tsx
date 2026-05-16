"use client";

import { useState, useEffect } from "react";

interface Notat {
  id: string;
  content: string;
  url: string | null;
  url_label: string | null;
  created_at: string;
}

export default function MesseNotatEditor() {
  const [notater, setNotater] = useState<Notat[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [urlLabel, setUrlLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/messe-notater")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setNotater(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function addNotat(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/messe-notater", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, url: url || undefined, url_label: urlLabel || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Ukjent feil");
    } else {
      setNotater(prev => [...prev, data]);
      setContent("");
      setUrl("");
      setUrlLabel("");
    }
    setSaving(false);
  }

  async function deleteNotat(id: string) {
    await fetch(`/api/admin/messe-notater/${id}`, { method: "DELETE" });
    setNotater(prev => prev.filter(n => n.id !== id));
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Messenotat</h2>
      <p className="mt-1 text-sm text-gray-400">Notater og lenker som messebrukeren ser på sin side.</p>

      {/* Existing notes */}
      <div className="mt-4 space-y-2">
        {loading && <p className="text-xs text-gray-400">Laster…</p>}
        {!loading && notater.length === 0 && (
          <p className="text-xs text-gray-400 italic">Ingen notater ennå.</p>
        )}
        {notater.map(n => (
          <div key={n.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm text-gray-800 break-words">{n.content}</p>
              {n.url && (
                <a href={n.url} target="_blank" rel="noopener noreferrer"
                  className="mt-0.5 block text-xs text-orange-500 hover:underline truncate">
                  {n.url_label || n.url}
                </a>
              )}
            </div>
            <button
              onClick={() => deleteNotat(n.id)}
              className="shrink-0 text-gray-300 hover:text-red-500 transition-colors text-lg leading-none"
              title="Slett notat"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Add form */}
      <form onSubmit={addNotat} className="mt-4 space-y-2">
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Notat til messebrukeren…"
          rows={2}
          required
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none"
        />
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="Lenke (valgfritt)"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
          <input
            type="text"
            value={urlLabel}
            onChange={e => setUrlLabel(e.target.value)}
            placeholder="Lenketekst"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? "Lagrer…" : "Legg til notat"}
        </button>
      </form>
    </div>
  );
}
