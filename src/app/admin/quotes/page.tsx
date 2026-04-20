"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { QuoteRow, QuoteStatus } from "@/types/quote-admin";
import Link from "next/link";
import { adminName } from "@/lib/admin-names";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

const STATUS_LABELS: Record<QuoteStatus, string> = {
  new: "Ny",
  in_review: "Under behandling",
  pending_approval: "Venter godkjenning",
  offer_sent: "Tilbud sendt",
  paid: "Betalt",
  cancelled: "Kansellert",
};

const STATUS_COLORS: Record<QuoteStatus, string> = {
  new: "bg-blue-100 text-blue-700",
  in_review: "bg-yellow-100 text-yellow-700",
  pending_approval: "bg-orange-100 text-orange-700",
  offer_sent: "bg-purple-100 text-purple-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const FILTERS: { id: QuoteStatus | "all"; label: string }[] = [
  { id: "all", label: "Alle" },
  { id: "new", label: "Ny" },
  { id: "in_review", label: "Under behandling" },
  { id: "pending_approval", label: "Venter godkjenning" },
  { id: "offer_sent", label: "Tilbud sendt" },
  { id: "paid", label: "Betalt" },
  { id: "cancelled", label: "Kansellert" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("nb-NO", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminQuotesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [activeFilter, setActiveFilter] = useState<QuoteStatus | "all">("all");

  // New manual quote
  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
      if (data.user) loadQuotes();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadQuotes();
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuotes() {
    if (!supabase) return;
    setLoadingQuotes(true);
    const { data } = await supabase
      .from("quotes")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setQuotes(data as QuoteRow[]);
    setLoadingQuotes(false);
  }

  async function handleCreateQuote(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !newForm.name || !newForm.email) return;
    setCreating(true);
    const { data: ticketData } = await supabase.rpc("next_ticket_number");
    const ticketNumber = (ticketData as string) ?? `Q-${Date.now()}`;
    const { data: inserted, error } = await supabase.from("quotes").insert({
      ticket_number: ticketNumber,
      customer_name: newForm.name,
      customer_email: newForm.email,
      customer_phone: newForm.phone || null,
      customer_message: newForm.message || null,
      status: "new",
      created_manually: true,
    }).select("id").single();
    setCreating(false);
    if (!error && inserted) {
      setNewOpen(false);
      setNewForm({ name: "", email: "", phone: "", message: "" });
      router.push(`/admin/quotes/${inserted.id}`);
    }
  }

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoginLoading(true); setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoginLoading(false);
    if (error) setLoginError("Feil e-post eller passord.");
  }

  if (authLoading) return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster...</div>;
  if (!supabase) return <div className="flex min-h-screen items-center justify-center text-gray-500">Supabase ikke konfigurert.</div>;

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-bold text-gray-900">Admin – Tilbud</h1>
          <p className="mb-6 text-sm text-gray-500">Logg inn med din GarasjeProffen-konto.</p>
          <form onSubmit={handleLogin} className="space-y-3">
            <input type="email" required placeholder="E-post" value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <input type="password" required placeholder="Passord" value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            {loginError && <p className="text-xs text-red-500">{loginError}</p>}
            <button type="submit" disabled={loginLoading}
              className="w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
              {loginLoading ? "Logger inn…" : "Logg inn"}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-gray-400">
            <a href="/admin" className="text-orange-500 hover:underline">Glemt passord?</a>
          </p>
        </div>
      </div>
    );
  }

  if (!ALLOWED_ADMINS.includes(user.email?.toLowerCase() ?? "")) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Du har ikke tilgang.</p>
          <button onClick={() => supabase?.auth.signOut()} className="mt-3 text-sm text-orange-500 hover:underline">Logg ut</button>
        </div>
      </div>
    );
  }

  const filtered = activeFilter === "all" ? quotes : quotes.filter((q) => q.status === activeFilter);

  const counts = quotes.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin" className="text-sm text-orange-600 hover:text-orange-800">← Admin</Link>
            <h1 className="mt-1 text-xl font-bold text-gray-900">Tilbudsforespørsler</h1>
            <p className="text-xs text-gray-400 truncate max-w-[200px] sm:max-w-none">{user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setNewOpen(true)}
              className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600">
              + Ny
            </button>
            <Link href="/admin/leads" className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">Leads</Link>
            <Link href="/referanseprosjekter/admin" className="hidden sm:block rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">Referanser</Link>
            <button onClick={() => supabase?.auth.signOut()} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">Logg ut</button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-6">
          {(["new", "in_review", "pending_approval", "offer_sent", "paid", "cancelled"] as QuoteStatus[]).map((s) => (
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
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                activeFilter === f.id ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {f.label} {f.id !== "all" && counts[f.id] ? `(${counts[f.id]})` : ""}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          {loadingQuotes ? (
            <div className="p-8 text-center text-sm text-gray-400">Laster...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Ingen forespørsler.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Ticket</th>
                  <th className="px-4 py-3 text-left">Kunde</th>
                  <th className="hidden px-4 py-3 text-left sm:table-cell">Konfigurasjon</th>
                  <th className="hidden px-4 py-3 text-left md:table-cell">Dato</th>
                  <th className="hidden px-4 py-3 text-left lg:table-cell">Behandler</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((q) => {
                  const p = (q.configuration as { parameters?: Record<string, number> } | null)?.parameters;
                  return (
                    <tr key={q.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-gray-700">{q.ticket_number}</span>
                        {q.created_manually && (
                          <span className="ml-1.5 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">Manuell</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{q.customer_name}</p>
                        <p className="text-xs text-gray-400">{q.customer_email}</p>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-gray-500 sm:table-cell">
                        {p ? `${(p.width ?? 0) / 1000} × ${(p.length ?? 0) / 1000} m` : "–"}
                        {q.package_type && <span className="ml-1 text-gray-400">· {q.package_type === "prefab" ? "Prefab" : "Material"}</span>}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-gray-400 md:table-cell">{formatDate(q.created_at)}</td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        {q.assigned_to
                          ? <span className="text-xs font-medium text-gray-800">{adminName(q.assigned_to)}</span>
                          : <span className="text-xs text-gray-400 italic">Ikke tildelt</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[q.status]}`}>
                          {STATUS_LABELS[q.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/quotes/${q.id}`}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">
                          Åpne
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* New manual quote modal */}
      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Ny forespørsel</h2>
            <p className="mt-1 text-sm text-gray-500">Ticketnummer opprettes automatisk.</p>
            <form onSubmit={handleCreateQuote} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Navn *</label>
                <input required type="text" placeholder="Ola Nordmann"
                  value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">E-post *</label>
                <input required type="email" placeholder="ola@example.no"
                  value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Telefon</label>
                <input type="tel" placeholder="000 00 000"
                  value={newForm.phone} onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Melding / notat</label>
                <textarea rows={3} placeholder="Hva ønsker kunden?"
                  value={newForm.message} onChange={(e) => setNewForm((f) => ({ ...f, message: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setNewOpen(false); setNewForm({ name: "", email: "", phone: "", message: "" }); }}
                  className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Avbryt
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                  {creating ? "Oppretter…" : "Opprett forespørsel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
