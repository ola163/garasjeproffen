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
  const [expanded, setExpanded] = useState<string | null>(null);

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
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kontakthenvendelser</h1>
            <p className="mt-0.5 text-sm text-gray-400">{contacts.length} totalt</p>
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

        {/* List */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Laster...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Ingen henvendelser.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                    className="w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-gray-500">{c.reference_number}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                        </div>
                        <p className="mt-1 font-medium text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-400">{c.email}{c.phone ? ` · ${c.phone}` : ""}</p>
                        <p className="text-xs text-gray-400">{c.address}</p>
                      </div>
                      <span className="shrink-0 text-xs text-gray-400">{formatDate(c.created_at)}</span>
                    </div>
                  </button>

                  {expanded === c.id && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                      {c.message && (
                        <div className="mb-4">
                          <p className="text-xs font-medium text-gray-500 mb-1">Melding</p>
                          <p className="text-sm text-gray-700 whitespace-pre-line">{c.message}</p>
                        </div>
                      )}
                      {c.attachments && c.attachments.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-medium text-gray-500 mb-1">Vedlegg ({c.attachments.length})</p>
                          <ul className="space-y-1">
                            {c.attachments.map((url, i) => {
                              const fileName = decodeURIComponent(url.split("/").pop() ?? url);
                              return (
                                <li key={i}>
                                  <a href={url} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-orange-600 hover:underline truncate block">
                                    {fileName}
                                  </a>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <a href={`mailto:${c.email}`}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                          Send e-post
                        </a>
                        {c.status !== "new" && (
                          <button onClick={() => updateStatus(c.id, "new")}
                            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100">
                            Merk som ny
                          </button>
                        )}
                        {c.status !== "in_progress" && (
                          <button onClick={() => updateStatus(c.id, "in_progress")}
                            className="rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 hover:bg-yellow-100">
                            Under behandling
                          </button>
                        )}
                        {c.status !== "resolved" && (
                          <button onClick={() => updateStatus(c.id, "resolved")}
                            className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">
                            Merk som løst
                          </button>
                        )}
                      </div>
                    </div>
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
