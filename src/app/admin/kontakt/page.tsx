"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

type ContactStatus = "new" | "in_progress" | "resolved";

interface ContactRow {
  id: string;
  reference_number: string;
  name: string;
  email: string;
  phone: string | null;
  address: string;
  message: string | null;
  attachments: string[] | null;
  status: ContactStatus;
  created_at: string;
}

const STATUS_LABELS: Record<ContactStatus, string> = {
  new: "Ny",
  in_progress: "Under behandling",
  resolved: "Løst",
};

const STATUS_COLORS: Record<ContactStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
};

const FILTERS: { id: ContactStatus | "all"; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "new", label: "Ny" },
  { id: "in_progress", label: "Under behandling" },
  { id: "resolved", label: "Løst" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("nb-NO", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminKontaktPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ContactStatus | "all">("all");
  const [selected, setSelected] = useState<ContactRow | null>(null);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
      if (data.user) loadContacts();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadContacts();
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadContacts() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error("loadContacts error:", error);
    if (data) setContacts(data as ContactRow[]);
    setLoading(false);
  }

  async function updateStatus(id: string, status: ContactStatus) {
    if (!supabase) return;
    await supabase.from("contacts").update({ status }).eq("id", id);
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
    setSelected((prev) => prev?.id === id ? { ...prev, status } : prev);
  }

  if (authLoading) return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster...</div>;
  if (!supabase) return null;

  if (!user || !ALLOWED_ADMINS.includes(user.email?.toLowerCase() ?? "")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Du har ikke tilgang.</p>
          <Link href="/admin" className="mt-3 block text-sm text-orange-500 hover:underline">Gå til innlogging</Link>
        </div>
      </div>
    );
  }

  const filtered = activeFilter === "all" ? contacts : contacts.filter((c) => c.status === activeFilter);
  const counts = contacts.reduce((acc, c) => { acc[c.status] = (acc[c.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kontakthenvendelser</h1>
            <p className="mt-0.5 text-sm text-gray-400">{user.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Admin</Link>
            <button onClick={() => supabase?.auth.signOut()} className="text-sm text-gray-400 hover:text-gray-600">Logg ut</button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {(["new", "in_progress", "resolved"] as ContactStatus[]).map((s) => (
            <div key={s} className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-gray-900">{counts[s] ?? 0}</p>
              <p className="mt-0.5 text-xs text-gray-500">{STATUS_LABELS[s]}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setActiveFilter(f.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${activeFilter === f.id ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {f.label}{f.id !== "all" && counts[f.id] ? ` (${counts[f.id]})` : ""}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Laster...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Ingen henvendelser.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Ticket</th>
                  <th className="px-4 py-3 text-left">Kunde</th>
                  <th className="hidden px-4 py-3 text-left sm:table-cell">Adresse</th>
                  <th className="hidden px-4 py-3 text-left md:table-cell">Dato</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-gray-700">{c.reference_number}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-gray-500 sm:table-cell">{c.address}</td>
                    <td className="hidden px-4 py-3 text-xs text-gray-400 md:table-cell">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]}`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                        {c.attachments && c.attachments.length > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            {c.attachments.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setSelected(c)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                        Åpne
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSelected(null)}>
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <span className="font-mono text-xs font-semibold text-gray-500">{selected.reference_number}</span>
                <h2 className="mt-0.5 text-lg font-bold text-gray-900">{selected.name}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Contact info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-gray-500">E-post</p>
                  <a href={`mailto:${selected.email}`} className="text-orange-600 hover:underline">{selected.email}</a>
                </div>
                {selected.phone && (
                  <div>
                    <p className="text-xs font-medium text-gray-500">Telefon</p>
                    <a href={`tel:${selected.phone}`} className="text-gray-800">{selected.phone}</a>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500">Adresse</p>
                  <p className="text-gray-800">{selected.address}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">Dato</p>
                  <p className="text-gray-800">{formatDate(selected.created_at)}</p>
                </div>
              </div>

              {/* Message */}
              {selected.message && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Melding</p>
                  <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 whitespace-pre-line">{selected.message}</p>
                </div>
              )}

              {/* Attachments */}
              {selected.attachments && selected.attachments.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Vedlegg ({selected.attachments.length})</p>
                  <ul className="space-y-1">
                    {selected.attachments.map((url, i) => (
                      <li key={i}>
                        <a href={url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-orange-600 hover:underline truncate block">
                          {decodeURIComponent(url.split("/").pop() ?? url)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Status */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Status</p>
                <div className="flex flex-wrap gap-2">
                  {(["new", "in_progress", "resolved"] as ContactStatus[]).map((s) => (
                    <button key={s} onClick={() => updateStatus(selected.id, s)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        selected.status === s
                          ? STATUS_COLORS[s] + " border-transparent"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}>
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 px-6 py-4">
              <a href={`mailto:${selected.email}`}
                className="block w-full rounded-lg bg-orange-500 py-2.5 text-center text-sm font-medium text-white hover:bg-orange-600">
                Send e-post til kunde
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
