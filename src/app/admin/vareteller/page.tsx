"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import type { VaretellerResponse } from "@/app/api/admin/vareteller/route";

type Filter = "alle" | "pagaende" | "ferdigstilte";
type SortKey = "quantity" | "projects" | "alpha";

const FILTER_LABELS: Record<Filter, string> = {
  alle: "Alle prosjekter",
  pagaende: "Pågående",
  ferdigstilte: "Ferdigstilte",
};

const FILTER_COLORS: Record<Filter, string> = {
  alle: "bg-gray-900 text-white",
  pagaende: "bg-green-600 text-white",
  ferdigstilte: "bg-teal-600 text-white",
};

const STATUS_LABELS: Record<string, string> = {
  in_review: "Under behandling",
  pending_approval: "Venter godkjenning",
  offer_sent: "Tilbud sendt",
  paid: "Betalt",
  ferdigstilt: "Ferdigstilt",
};

const STATUS_DOT: Record<string, string> = {
  in_review: "bg-yellow-400",
  pending_approval: "bg-orange-400",
  offer_sent: "bg-purple-400",
  paid: "bg-green-400",
  ferdigstilt: "bg-teal-400",
};

export default function VaretellerPage() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);

  const [filter, setFilter] = useState<Filter>("alle");
  const [sort, setSort] = useState<SortKey>("quantity");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<VaretellerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Auth
  useEffect(() => {
    const client = supabase;
    if (client) {
      client.auth.getSession().then(({ data: { session } }) => {
        if (session?.access_token) {
          setAuthToken(session.access_token);
          setAuthed(true);
        } else {
          fetch("/api/admin/vareteller?filter=alle", { credentials: "include" })
            .then(r => { if (r.ok) setAuthed(true); else setAuthed(false); });
        }
      });
    } else {
      fetch("/api/admin/vareteller?filter=alle", { credentials: "include" })
        .then(r => { if (r.ok) setAuthed(true); else setAuthed(false); });
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    setError("");
    const headers: Record<string, string> = authToken ? { Authorization: `Bearer ${authToken}` } : {};
    fetch(`/api/admin/vareteller?filter=${filter}`, { headers, credentials: "include" })
      .then(r => r.json())
      .then((json: VaretellerResponse & { error?: string }) => {
        if (json.error) { setError(json.error); return; }
        setData(json);
      })
      .catch(() => setError("Nettverksfeil"))
      .finally(() => setLoading(false));
  }, [filter, authed, authToken]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let items = data.items;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(
        i => i.description.toLowerCase().includes(q) || i.varenr.toLowerCase().includes(q)
      );
    }

    return [...items].sort((a, b) => {
      if (sort === "quantity") return b.totalQuantity - a.totalQuantity;
      if (sort === "projects") return b.projectCount - a.projectCount;
      return a.description.localeCompare(b.description, "nb");
    });
  }, [data, search, sort]);

  const topItem = filtered[0];
  const totalQty = filtered.reduce((sum, i) => sum + i.totalQuantity, 0);

  function toggleExpand(key: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  if (!authed && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Ikke autorisert. <Link href="/admin" className="text-blue-600 hover:underline">Logg inn</Link></p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-lg font-bold text-gray-900">Vareteller</h1>
        </div>

        {/* Filter tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          {(["alle", "pagaende", "ferdigstilte"] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f
                  ? FILTER_COLORS[f]
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {FILTER_LABELS[f]}
              {data && filter === f && (
                <span className={`ml-1.5 text-xs opacity-75`}>
                  ({data.totalProjects} prosjekter)
                </span>
              )}
            </button>
          ))}

          {data && (
            <div className="ml-auto flex items-center gap-2">
              {Object.entries(data.statusCounts).map(([s, c]) => (
                <span key={s} className="flex items-center gap-1 text-xs text-gray-500">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s] ?? "bg-gray-300"}`} />
                  {STATUS_LABELS[s] ?? s}: {c}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Summary cards */}
        {data && !loading && (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Unike varer</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{filtered.length}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Prosjekter</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{data.totalProjects}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Total mengde</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{totalQty.toLocaleString("nb-NO")}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Mest brukt</p>
              <p className="mt-1 text-sm font-bold text-gray-900 truncate" title={topItem?.description}>
                {topItem?.description ?? "—"}
              </p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Søk på varenavn eller varenr…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-gray-400 focus:outline-none"
          />
          <div className="flex rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {([["quantity", "Mest mengde"], ["projects", "Flest prosjekter"], ["alpha", "A–Å"]] as [SortKey, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`px-3 py-2 text-xs font-medium transition-colors border-r last:border-r-0 border-gray-200 ${
                  sort === key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-sm text-red-500">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white py-16 text-center shadow-sm">
            <p className="text-sm text-gray-400">
              {search ? "Ingen varer matchet søket." : "Ingen varer funnet for dette filteret."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-gray-100 bg-gray-50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              <span>Vare</span>
              <span className="text-right">Enhet</span>
              <span className="text-right w-24">Total mengde</span>
              <span className="text-right w-20">Prosjekter</span>
              <span className="w-6" />
            </div>

            {filtered.map((item, idx) => {
              const isOpen = expanded.has(item.key);
              const rankPct = topItem && topItem.totalQuantity > 0
                ? (item.totalQuantity / topItem.totalQuantity) * 100
                : 0;

              return (
                <div key={item.key} className={`${idx > 0 ? "border-t border-gray-100" : ""}`}>
                  <button
                    onClick={() => toggleExpand(item.key)}
                    className="grid w-full grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {item.varenr && (
                          <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] text-blue-600">
                            {item.varenr}
                          </span>
                        )}
                        <p className="truncate text-sm font-medium text-gray-900">{item.description}</p>
                      </div>
                      {/* Quantity bar */}
                      <div className="mt-1.5 h-1 w-full max-w-48 rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-blue-400 transition-all"
                          style={{ width: `${rankPct}%` }}
                        />
                      </div>
                    </div>

                    <span className="text-xs text-gray-400 text-right w-12">{item.enhet || "—"}</span>

                    <span className="w-24 text-right text-sm font-bold text-gray-900">
                      {item.totalQuantity.toLocaleString("nb-NO")}
                    </span>

                    <span className="w-20 text-right text-xs text-gray-500">
                      {item.projectCount} prosjekt{item.projectCount !== 1 ? "er" : ""}
                    </span>

                    <span className={`w-6 text-gray-400 text-center text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>
                      ▾
                    </span>
                  </button>

                  {/* Expanded project list */}
                  {isOpen && (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                        Prosjekter
                      </p>
                      <div className="space-y-1.5">
                        {item.projects
                          .slice()
                          .sort((a, b) => b.quantity - a.quantity)
                          .map(p => (
                            <div key={p.id} className="flex items-center gap-3">
                              <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[p.status] ?? "bg-gray-300"}`} />
                              <Link
                                href={`/admin/quotes/${p.id}`}
                                className="font-mono text-xs text-blue-600 hover:underline shrink-0"
                              >
                                {p.ticketNumber}
                              </Link>
                              <span className="flex-1 truncate text-xs text-gray-600">{p.customerName}</span>
                              <span className="shrink-0 text-xs text-gray-400 tabular-nums">
                                {STATUS_LABELS[p.status] ?? p.status}
                              </span>
                              <span className="shrink-0 text-xs font-semibold text-gray-700 tabular-nums">
                                {p.quantity.toLocaleString("nb-NO")} {item.enhet}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
