"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface GeoInfo {
  city: string;
  region: string;
  country: string;
}

interface IpEntry {
  ip: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
  paths: string[];
  emails: string[];
  geo: GeoInfo | null;
}

interface StatsData {
  totalVisits: number;
  uniqueIpCount: number;
  uniqueIps: IpEntry[];
  topPages: { path: string; count: number }[];
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("nb-NO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function GeoTag({ geo }: { geo: GeoInfo | null }) {
  if (!geo) return <span className="text-gray-300 text-xs">—</span>;
  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  return <span className="text-gray-500 text-xs">{parts.join(", ")}</span>;
}

export default function StatistikkPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<"iper" | "sider">("iper");

  useEffect(() => {
    fetch("/api/admin/visitor-stats")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-12 sm:px-6">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
            <h1 className="mt-1 text-xl font-bold text-gray-900">Statistikk</h1>
          </div>
        </div>

        {loading && <p className="text-sm text-gray-400">Laster statistikk og geolokasjon…</p>}

        {!loading && data && (
          <>
            {/* Summary cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">Totale sidevisninger</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{data.totalVisits.toLocaleString("nb-NO")}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">Unike IP-adresser</p>
                <p className="mt-1 text-3xl font-bold text-orange-500">{data.uniqueIpCount.toLocaleString("nb-NO")}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:col-span-1">
                <p className="text-xs text-gray-400">Snitt visninger / IP</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {data.uniqueIpCount > 0 ? (data.totalVisits / data.uniqueIpCount).toFixed(1) : "0"}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-2">
              <button
                onClick={() => setTab("iper")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "iper" ? "bg-orange-500 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
              >
                IP-adresser
              </button>
              <button
                onClick={() => setTab("sider")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "sider" ? "bg-orange-500 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}
              >
                Topp sider
              </button>
            </div>

            {/* IP table */}
            {tab === "iper" && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP-adresse</th>
                      <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sted</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Besøk</th>
                      <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sist sett</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.uniqueIps.map((entry) => (
                      <>
                        <tr
                          key={entry.ip}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => setExpanded(expanded === entry.ip ? null : entry.ip)}
                        >
                          <td className="px-4 py-3 font-mono text-gray-800">
                            <span className="mr-2 text-gray-300">{expanded === entry.ip ? "▾" : "▸"}</span>
                            {entry.ip}
                            {entry.emails.length > 0 && (
                              <span title={entry.emails.join(", ")} className="ml-2 inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                                innlogget
                              </span>
                            )}
                          </td>
                          <td className="hidden sm:table-cell px-4 py-3">
                            <GeoTag geo={entry.geo} />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-orange-500">{entry.count}</td>
                          <td className="hidden sm:table-cell px-4 py-3 text-gray-500">{fmt(entry.lastSeen)}</td>
                        </tr>
                        {expanded === entry.ip && (
                          <tr key={`${entry.ip}-expanded`} className="bg-orange-50">
                            <td colSpan={4} className="px-6 py-3 space-y-2">
                              {entry.emails.length > 0 && (
                                <p className="text-xs text-gray-700">
                                  Bruker: <strong>{entry.emails.join(", ")}</strong>
                                </p>
                              )}
                              {entry.geo && (
                                <p className="text-xs text-gray-600">
                                  Lokasjon: <strong>{[entry.geo.city, entry.geo.region, entry.geo.country].filter(Boolean).join(", ")}</strong>
                                </p>
                              )}
                              <p className="text-xs text-gray-500">Første besøk: {fmt(entry.firstSeen)}</p>
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Besøkte sider:</p>
                                <div className="flex flex-wrap gap-2">
                                  {entry.paths.length > 0
                                    ? entry.paths.map((p) => (
                                        <span key={p} className="rounded bg-white border border-gray-200 px-2 py-0.5 font-mono text-xs text-gray-700">{p}</span>
                                      ))
                                    : <span className="text-xs text-gray-400">Ingen sideinfo</span>}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
                {data.uniqueIps.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-gray-400">Ingen besøk registrert ennå.</p>
                )}
              </div>
            )}

            {/* Top pages */}
            {tab === "sider" && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Side</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Visninger</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.topPages.map((page) => (
                      <tr key={page.path} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-gray-700">{page.path}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-500">{page.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.topPages.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-gray-400">Ingen data ennå.</p>
                )}
              </div>
            )}
          </>
        )}

        {!loading && !data && (
          <p className="text-sm text-red-500">Kunne ikke laste statistikk. Sjekk at Supabase er konfigurert og tabellen er opprettet.</p>
        )}
      </div>
    </div>
  );
}
