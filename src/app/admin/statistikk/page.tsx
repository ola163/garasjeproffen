"use client";

import { useEffect, useState, useMemo } from "react";
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
  allIps: string[];
  geo: GeoInfo | null;
  countryCode: string | null;
}

interface StatsData {
  totalVisits: number;
  uniqueIpCount: number;
  uniqueIpDay: number;
  uniqueIpWeek: number;
  uniqueIpMonth: number;
  uniqueIps: IpEntry[];
  topPages: { path: string; count: number }[];
  topReferrers: { domain: string; count: number }[];
}

interface UserGroup {
  email: string;
  ips: string[];
  totalCount: number;
  firstSeen: string;
  lastSeen: string;
  paths: string[];
  geo: GeoInfo | null;
  countryCode: string | null;
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
  const [tab, setTab] = useState<"brukere" | "iper" | "utland" | "sider" | "trafikk">("brukere");
  const [relinking, setRelinking] = useState(false);
  const [relinkResult, setRelinkResult] = useState<string | null>(null);

  function loadStats() {
    setLoading(true);
    fetch("/api/admin/visitor-stats")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => { loadStats(); }, []);

  async function handleRelink() {
    setRelinking(true);
    setRelinkResult(null);
    try {
      const res = await fetch("/api/admin/visitor-stats/relink", { method: "POST" });
      const json = await res.json();
      if (json.error) { setRelinkResult(`Feil: ${json.error}`); return; }
      setRelinkResult(`✓ ${json.linked} rader koblet`);
      loadStats(); // refresh data
    } catch {
      setRelinkResult("Nettverksfeil");
    } finally {
      setRelinking(false);
    }
  }

  // Build user groups from entries that have emails
  const userGroups = useMemo<UserGroup[]>(() => {
    if (!data) return [];
    const emailMap = new Map<string, UserGroup>();
    for (const entry of data.uniqueIps) {
      for (const email of entry.emails) {
        const existing = emailMap.get(email);
        if (!existing) {
          emailMap.set(email, {
            email,
            ips: entry.allIps?.length ? entry.allIps : [entry.ip],
            totalCount: entry.count,
            firstSeen: entry.firstSeen,
            lastSeen: entry.lastSeen,
            paths: [...entry.paths],
            geo: entry.geo,
            countryCode: entry.countryCode,
          });
        } else {
          // Shouldn't happen since API already merges, but handle gracefully
          existing.totalCount += entry.count;
          if (entry.firstSeen < existing.firstSeen) existing.firstSeen = entry.firstSeen;
          if (entry.lastSeen > existing.lastSeen) existing.lastSeen = entry.lastSeen;
          for (const p of entry.paths) if (!existing.paths.includes(p)) existing.paths.push(p);
          for (const ip of (entry.allIps ?? [entry.ip])) if (!existing.ips.includes(ip)) existing.ips.push(ip);
        }
      }
    }
    return Array.from(emailMap.values()).sort((a, b) => b.totalCount - a.totalCount);
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:py-12 sm:px-6">

        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
            <h1 className="mt-1 text-xl font-bold text-gray-900">Statistikk</h1>
          </div>
          <div className="flex items-center gap-3">
            {relinkResult && (
              <span className={`text-xs font-medium ${relinkResult.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                {relinkResult}
              </span>
            )}
            <button
              onClick={handleRelink}
              disabled={relinking}
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              {relinking ? "Kobler…" : "Koble IPs til brukere"}
            </button>
          </div>
        </div>

        {loading && <p className="text-sm text-gray-400">Laster statistikk og geolokasjon…</p>}

        {!loading && data && (
          <>
            {/* Summary cards */}
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">I dag</p>
                <p className="mt-1 text-3xl font-bold text-orange-500">{data.uniqueIpDay.toLocaleString("nb-NO")}</p>
                <p className="mt-0.5 text-xs text-gray-400">unike IPs</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">Denne uken</p>
                <p className="mt-1 text-3xl font-bold text-orange-500">{data.uniqueIpWeek.toLocaleString("nb-NO")}</p>
                <p className="mt-0.5 text-xs text-gray-400">unike IPs</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">Denne måneden</p>
                <p className="mt-1 text-3xl font-bold text-orange-500">{data.uniqueIpMonth.toLocaleString("nb-NO")}</p>
                <p className="mt-0.5 text-xs text-gray-400">unike IPs</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <p className="text-xs text-gray-400">Totalt</p>
                <p className="mt-1 text-3xl font-bold text-gray-900">{data.uniqueIpCount.toLocaleString("nb-NO")}</p>
                <p className="mt-0.5 text-xs text-gray-400">unike IPs</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-2 flex-wrap">
              <button onClick={() => setTab("brukere")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "brukere" ? "bg-blue-600 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
                Brukere
                {userGroups.length > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 text-xs font-bold ${tab === "brukere" ? "bg-white text-blue-600" : "bg-blue-100 text-blue-600"}`}>
                    {userGroups.length}
                  </span>
                )}
              </button>
              {(() => {
                const norske = data.uniqueIps.filter((e) => !e.countryCode || e.countryCode === "NO");
                const utland = data.uniqueIps.filter((e) => e.countryCode && e.countryCode !== "NO");
                return (
                  <>
                    <button onClick={() => setTab("iper")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "iper" ? "bg-orange-500 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
                      Norge ({norske.length})
                    </button>
                    <button onClick={() => setTab("utland")}
                      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "utland" ? "bg-red-500 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
                      Utlandet {utland.length > 0 && <span className={`ml-1 rounded-full px-1.5 text-xs font-bold ${tab === "utland" ? "bg-white text-red-500" : "bg-red-100 text-red-600"}`}>{utland.length}</span>}
                    </button>
                  </>
                );
              })()}
              <button onClick={() => setTab("sider")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "sider" ? "bg-orange-500 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
                Topp sider
              </button>
              <button onClick={() => setTab("trafikk")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${tab === "trafikk" ? "bg-orange-500 text-white" : "bg-white text-gray-500 border border-gray-200 hover:bg-gray-50"}`}>
                Trafikkilder
              </button>
            </div>

            {/* Brukere tab */}
            {tab === "brukere" && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                {userGroups.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-gray-400">Ingen innloggede brukere registrert ennå.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {userGroups.map((user) => {
                      const key = `u:${user.email}`;
                      const isOpen = expanded === key;
                      return (
                        <div key={user.email}>
                          <button
                            onClick={() => setExpanded(isOpen ? null : key)}
                            className="w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-blue-700 truncate">{user.email}</span>
                                  {user.ips.length > 1 && (
                                    <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                                      {user.ips.length} IPs
                                    </span>
                                  )}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                  <GeoTag geo={user.geo} />
                                  <span className="text-xs text-gray-400">Sist sett: {fmt(user.lastSeen)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-lg font-bold text-orange-500">{user.totalCount}</span>
                                <span className={`text-gray-300 transition-transform text-xs ${isOpen ? "rotate-180" : ""}`}>▾</span>
                              </div>
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-gray-100 bg-blue-50 px-5 py-4 space-y-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">IP-adresser</p>
                                <div className="flex flex-wrap gap-2">
                                  {user.ips.map((ip) => (
                                    <span key={ip} className="rounded-lg border border-blue-200 bg-white px-3 py-1 font-mono text-xs text-gray-700">
                                      {ip}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <p className="text-xs text-gray-500">Første besøk: {fmt(user.firstSeen)}</p>
                              {user.paths.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Besøkte sider</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {user.paths.slice(0, 15).map((p) => (
                                      <span key={p} className="rounded bg-white border border-gray-200 px-2 py-0.5 font-mono text-xs text-gray-600">{p}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* IP tables */}
            {(tab === "iper" || tab === "utland") && (() => {
              const norske = data.uniqueIps.filter((e) => !e.countryCode || e.countryCode === "NO");
              const utland = data.uniqueIps.filter((e) => e.countryCode && e.countryCode !== "NO");
              const entries = tab === "iper" ? norske : utland;
              const emptyMsg = tab === "iper" ? "Ingen norske besøk registrert ennå." : "Ingen besøk fra utlandet.";

              return (
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP-adresse / Bruker</th>
                        <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sted</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Besøk</th>
                        <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sist sett</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {entries.map((entry) => (
                        <>
                          <tr
                            key={entry.ip}
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => setExpanded(expanded === entry.ip ? null : entry.ip)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-300 text-xs">{expanded === entry.ip ? "▾" : "▸"}</span>
                                <div>
                                  <p className="font-mono text-gray-800 text-sm">{entry.ip}</p>
                                  {entry.emails.length > 0 && (
                                    <p className="mt-0.5 text-xs font-medium text-blue-600">{entry.emails.join(", ")}</p>
                                  )}
                                  {(entry.allIps?.length ?? 0) > 1 && (
                                    <p className="mt-0.5 text-[10px] text-gray-400">+{(entry.allIps.length - 1)} sammenslått IP{entry.allIps.length - 1 !== 1 ? "er" : ""}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="hidden sm:table-cell px-4 py-3">
                              <GeoTag geo={entry.geo} />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-orange-500">{entry.count}</td>
                            <td className="hidden sm:table-cell px-4 py-3 text-gray-500">{fmt(entry.lastSeen)}</td>
                          </tr>
                          {expanded === entry.ip && (
                            <tr key={`${entry.ip}-expanded`} className="bg-orange-50">
                              <td colSpan={4} className="px-6 py-4 space-y-3">
                                {entry.emails.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Bruker</p>
                                    <p className="text-sm font-medium text-blue-700">{entry.emails.join(", ")}</p>
                                  </div>
                                )}
                                {(entry.allIps?.length ?? 0) > 1 && (
                                  <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Alle IP-adresser</p>
                                    <div className="flex flex-wrap gap-2">
                                      {entry.allIps.map((ip) => (
                                        <span key={ip} className={`rounded-lg border px-3 py-1 font-mono text-xs ${ip === entry.ip ? "border-orange-300 bg-orange-100 text-orange-700" : "border-gray-200 bg-white text-gray-600"}`}>
                                          {ip}{ip === entry.ip ? " (primær)" : ""}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {entry.geo && (
                                  <p className="text-xs text-gray-600">Lokasjon: <strong>{[entry.geo.city, entry.geo.region, entry.geo.country].filter(Boolean).join(", ")}</strong></p>
                                )}
                                <p className="text-xs text-gray-500">Første besøk: {fmt(entry.firstSeen)}</p>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Besøkte sider</p>
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
                  {entries.length === 0 && (
                    <p className="px-4 py-8 text-center text-sm text-gray-400">{emptyMsg}</p>
                  )}
                </div>
              );
            })()}

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

            {/* Top referrers */}
            {tab === "trafikk" && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kilde</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Besøk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.topReferrers.map((ref) => (
                      <tr key={ref.domain} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">{ref.domain}</td>
                        <td className="px-4 py-3 text-right font-semibold text-orange-500">{ref.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.topReferrers.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-gray-400">Ingen trafikkilder registrert ennå.</p>
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
