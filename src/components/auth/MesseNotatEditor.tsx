"use client";

import { useState, useEffect, useRef } from "react";

interface Notat {
  id: string;
  content: string;
  url: string | null;
  url_label: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

export default function MesseNotatEditor() {
  const [notater, setNotater] = useState<Notat[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [urlLabel, setUrlLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/messe-notater")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setNotater(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function addNotat(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!content.trim()) return;
    setSaving(true);
    setError(null);

    let fileUrl: string | null = null;
    let fileName: string | null = null;

    if (file) {
      setUploadProgress("Laster opp vedlegg…");
      const fd = new FormData();
      fd.append("file", file);
      const upRes = await fetch("/api/admin/messe-vedlegg", { method: "POST", body: fd });
      const upData = await upRes.json();
      setUploadProgress(null);
      if (!upRes.ok) {
        setError(upData.error ?? "Feil ved opplasting");
        setSaving(false);
        return;
      }
      fileUrl = upData.url;
      fileName = upData.name;
    }

    const res = await fetch("/api/admin/messe-notater", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        url: url || undefined,
        url_label: urlLabel || undefined,
        file_url: fileUrl || undefined,
        file_name: fileName || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Ukjent feil");
    } else {
      setNotater(prev => [...prev, data]);
      setContent("");
      setUrl("");
      setUrlLabel("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
      <p className="mt-1 text-sm text-gray-400">Notater, lenker og vedlegg som messebrukeren ser på sin side.</p>

      {/* Existing notes */}
      <div className="mt-4 space-y-2">
        {loading && <p className="text-xs text-gray-400">Laster…</p>}
        {!loading && notater.length === 0 && (
          <p className="text-xs text-gray-400 italic">Ingen notater ennå.</p>
        )}
        {notater.map(n => (
          <div key={n.id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
            <div className="min-w-0 space-y-1">
              <p className="text-sm text-gray-800 break-words">{n.content}</p>
              {n.url && (
                <a href={n.url} target="_blank" rel="noopener noreferrer"
                  className="block text-xs text-orange-500 hover:underline truncate">
                  {n.url_label || n.url}
                </a>
              )}
              {n.file_url && (
                <a href={n.file_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                  <FileIcon />
                  {n.file_name || "Vedlegg"}
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

        {/* File upload */}
        <div className="flex items-center gap-2">
          <label className="flex-1 cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
            />
            {file ? (
              <span className="flex items-center gap-1.5 text-blue-600">
                <FileIcon />
                {file.name}
                <span className="text-gray-400">({(file.size / 1024).toFixed(0)} KB)</span>
              </span>
            ) : (
              "Legg ved fil (bilde, PDF, dokument…)"
            )}
          </label>
          {file && (
            <button
              type="button"
              onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="text-gray-400 hover:text-red-500 text-lg leading-none"
              title="Fjern fil"
            >
              ×
            </button>
          )}
        </div>

        {uploadProgress && <p className="text-xs text-blue-500">{uploadProgress}</p>}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={saving || !content.trim()}
          className="w-full rounded-lg bg-orange-500 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {saving ? (uploadProgress ?? "Lagrer…") : "Legg til notat"}
        </button>
      </form>
    </div>
  );
}
