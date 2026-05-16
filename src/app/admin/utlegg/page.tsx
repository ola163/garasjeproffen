"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const CATEGORIES = ["Drivstoff", "Materialer", "Utstyr", "Mat/servering", "Transport", "Annet"];

interface Utlegg {
  id: string;
  created_at: string;
  submitted_by: string;
  amount: number;
  description: string;
  category: string;
  ticket_number: string | null;
  image_url: string | null;
  notes: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatNOK(n: number) {
  return n.toLocaleString("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });
}

export default function UtleggPage() {
  const [utlegg, setUtlegg] = useState<Utlegg[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [ticketNumber, setTicketNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    fetch("/api/admin/utlegg")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setUtlegg(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleFile(file: File | null) {
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = e => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const form = new FormData();
    form.append("amount", amount);
    form.append("description", description);
    form.append("category", category);
    if (ticketNumber) form.append("ticket_number", ticketNumber);
    if (notes) form.append("notes", notes);
    if (imageFile) form.append("image", imageFile);

    const res = await fetch("/api/admin/utlegg", { method: "POST", body: form });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) { setError(data.error ?? "Feil ved lagring."); return; }
    setUtlegg(prev => [data, ...prev]);
    setFormOpen(false);
    setAmount(""); setDescription(""); setCategory(CATEGORIES[0]);
    setTicketNumber(""); setNotes(""); setImageFile(null); setPreview(null);
  }

  const total = utlegg.reduce((s, u) => s + u.amount, 0);

  const byCategory = CATEGORIES.map(cat => ({
    cat,
    sum: utlegg.filter(u => u.category === cat).reduce((s, u) => s + u.amount, 0),
  })).filter(c => c.sum > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Kvittering" className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-xl" />
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-900">Utlegg</h1>
        </div>

        {/* Summary */}
        {utlegg.length > 0 && (
          <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Totalt</p>
              <p className="text-lg font-bold text-gray-900">{formatNOK(total)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {byCategory.map(({ cat, sum }) => (
                <span key={cat} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                  {cat}: <span className="font-semibold">{formatNOK(sum)}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Add button */}
        <button
          onClick={() => setFormOpen(v => !v)}
          className="mb-4 flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          {formOpen ? "Avbryt" : "+ Legg til utlegg"}
        </button>

        {/* Form */}
        {formOpen && (
          <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Beløp (kr)*</label>
                <input type="number" required min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Kategori*</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Beskrivelse*</label>
              <input type="text" required value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Hva gjelder utlegget?"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ticketnr. (valgfritt)</label>
                <input type="text" value={ticketNumber} onChange={e => setTicketNumber(e.target.value)}
                  placeholder="GP-XXXX"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notat (valgfritt)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Ekstra info"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
            </div>

            {/* Image upload */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kvittering (valgfritt)</label>
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                onChange={e => handleFile(e.target.files?.[0] ?? null)}
                className="hidden" />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors w-full justify-center">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {imageFile ? imageFile.name : "Ta bilde av kvittering"}
              </button>
              {preview && (
                <div className="mt-2 relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Forhåndsvisning" className="h-24 w-auto rounded-lg border border-gray-200 object-cover" />
                  <button type="button" onClick={() => { setImageFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs">×</button>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={saving}
              className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors">
              {saving ? "Lagrer…" : "Lagre utlegg"}
            </button>
          </form>
        )}

        {/* List */}
        {loading ? (
          <p className="text-sm text-gray-400">Laster…</p>
        ) : utlegg.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Ingen utlegg registrert ennå.</p>
        ) : (
          <div className="space-y-3">
            {utlegg.map(u => (
              <div key={u.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{u.description}</span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{u.category}</span>
                      {u.ticket_number && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-mono text-blue-600">{u.ticket_number}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {u.submitted_by} · {formatDate(u.created_at)}
                    </p>
                    {u.notes && <p className="mt-1 text-xs text-gray-500 italic">{u.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {u.image_url && (
                      <button onClick={() => setLightbox(u.image_url!)} title="Vis kvittering">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u.image_url} alt="Kvittering" className="h-10 w-10 rounded-md object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
                      </button>
                    )}
                    <span className="text-base font-bold text-gray-900">{formatNOK(u.amount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
