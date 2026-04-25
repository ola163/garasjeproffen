"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

type Change = {
  id: string;
  user_email: string;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  status: string;
  changed_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  note: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  name: "Navn", email: "E-post", phone: "Telefon", address: "Adresse",
};
const STATUS_STYLES: Record<string, string> = {
  completed:        "bg-green-100 text-green-700",
  pending_approval: "bg-yellow-100 text-yellow-800",
  approved:         "bg-green-100 text-green-700",
  rejected:         "bg-red-100 text-red-600",
};
const STATUS_LABELS: Record<string, string> = {
  completed:        "Fullført",
  pending_approval: "Venter godkjenning",
  approved:         "Godkjent",
  rejected:         "Avvist",
};

function formatDt(iso: string) {
  return new Date(iso).toLocaleString("nb-NO", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function ProfileChangesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionNote, setActionNote] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending_approval">("pending_approval");

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    loadChanges();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filter]);

  async function loadChanges() {
    setLoading(true);
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    const url = filter === "all"
      ? "/api/admin/profile-changes"
      : "/api/admin/profile-changes?status=pending_approval";
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    setChanges(json.changes ?? []);
    setLoading(false);
  }

  async function handleAction(id: string, action: "approve" | "reject") {
    if (!supabase) return;
    setActing(id);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token ?? "";
    await fetch("/api/admin/profile-changes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, action, note: actionNote[id] ?? null }),
    });
    setActing(null);
    setActionNote(prev => { const n = { ...prev }; delete n[id]; return n; });
    loadChanges();
  }

  if (authLoading) return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster…</div>;
  if (!user || !ALLOWED_ADMINS.includes(user.email?.toLowerCase() ?? "")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Ikke tilgang. <Link href="/admin" className="text-orange-500 underline">Tilbake</Link></p>
      </div>
    );
  }

  const pending = changes.filter(c => c.status === "pending_approval");
  const rest    = changes.filter(c => c.status !== "pending_approval");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">

        <div className="mb-6 flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-gray-900">Profilendringer</h1>
          {pending.length > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-yellow-400 px-1.5 text-xs font-bold text-white">
              {pending.length}
            </span>
          )}
        </div>

        {/* SQL migration helper */}
        <details className="mb-6 rounded-xl border border-gray-200 bg-white p-4 text-xs text-gray-500">
          <summary className="cursor-pointer font-medium text-gray-700 select-none">SQL-migrasjon (kjør én gang i Supabase)</summary>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-[11px] text-green-300 leading-relaxed">{`
CREATE TABLE IF NOT EXISTS user_profiles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text UNIQUE NOT NULL,
  phone               text,
  phone_verified_at   timestamptz,
  address             text,
  address_pending     text,
  updated_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_change_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email   text NOT NULL,
  change_type  text NOT NULL,
  old_value    text,
  new_value    text,
  status       text NOT NULL DEFAULT 'completed',
  changed_at   timestamptz DEFAULT now(),
  reviewed_by  text,
  reviewed_at  timestamptz,
  note         text
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_profile_change_log_email  ON profile_change_log (user_email);
CREATE INDEX IF NOT EXISTS idx_profile_change_log_status ON profile_change_log (status);

-- Enable RLS (blocks anon/authenticated direct access; service_role bypasses automatically)
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_change_log ENABLE ROW LEVEL SECURITY;

-- No client-side policies needed: all reads/writes go through API routes
-- that use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS entirely.
-- This means the anon and authenticated keys cannot access these tables directly.
          `.trim()}</pre>
        </details>

        {/* Filter */}
        <div className="mb-6 flex gap-2">
          {(["pending_approval", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${filter === f ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"}`}>
              {f === "pending_approval" ? "Venter godkjenning" : "Alle endringer"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-xl bg-white border border-gray-200" />)}
          </div>
        ) : changes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <p className="text-gray-400">{filter === "pending_approval" ? "Ingen ventende godkjenninger." : "Ingen endringer registrert."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending — needs action */}
            {pending.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-yellow-700">Venter godkjenning</p>
                <div className="space-y-3">
                  {pending.map(c => (
                    <div key={c.id} className="rounded-xl border border-yellow-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">{TYPE_LABELS[c.change_type] ?? c.change_type}</span>
                            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">Venter</span>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-500">{c.user_email} · {formatDt(c.changed_at)}</p>
                          <div className="mt-3 flex flex-wrap gap-4 text-sm">
                            {c.old_value && (
                              <div>
                                <p className="text-xs text-gray-400">Fra</p>
                                <p className="font-medium text-gray-700">{c.old_value}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-gray-400">Til</p>
                              <p className="font-medium text-gray-900">{c.new_value}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 items-center">
                        <input
                          type="text"
                          value={actionNote[c.id] ?? ""}
                          onChange={e => setActionNote(prev => ({ ...prev, [c.id]: e.target.value }))}
                          placeholder="Notat (valgfritt)…"
                          className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                        <button onClick={() => handleAction(c.id, "approve")} disabled={acting === c.id}
                          className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
                          {acting === c.id ? "…" : "Godkjenn"}
                        </button>
                        <button onClick={() => handleAction(c.id, "reject")} disabled={acting === c.id}
                          className="rounded-lg border border-red-300 px-4 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors">
                          Avvis
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviewed */}
            {rest.length > 0 && (
              <div>
                {pending.length > 0 && <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Behandlede endringer</p>}
                <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Bruker</th>
                        <th className="px-4 py-3 text-left">Type</th>
                        <th className="hidden px-4 py-3 text-left sm:table-cell">Endring</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="hidden px-4 py-3 text-left md:table-cell">Dato</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rest.map(c => (
                        <tr key={c.id}>
                          <td className="px-4 py-3 text-xs text-gray-600 max-w-[140px] truncate">{c.user_email}</td>
                          <td className="px-4 py-3 text-xs font-medium text-gray-700">{TYPE_LABELS[c.change_type] ?? c.change_type}</td>
                          <td className="hidden px-4 py-3 text-xs text-gray-500 sm:table-cell max-w-[200px]">
                            {c.old_value && <span className="line-through text-gray-400 mr-1">{c.old_value}</span>}
                            {c.new_value}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-500"}`}>
                              {STATUS_LABELS[c.status] ?? c.status}
                            </span>
                            {c.reviewed_by && <p className="mt-0.5 text-[10px] text-gray-400">{c.reviewed_by}</p>}
                          </td>
                          <td className="hidden px-4 py-3 text-xs text-gray-400 md:table-cell">{formatDt(c.changed_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
