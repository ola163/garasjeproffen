"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import * as XLSX from "xlsx";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

interface VisitEntry {
  ip: string;
  lastSeen: string;
}

interface Customer {
  name: string;
  email: string;
  phone: string | null;
  quoteCount: number;
  lastQuote: string;
  statuses: string[];
  visits: VisitEntry[];
  lastLogin: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function AdminKunderPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
      if (data.user) loadCustomers();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadCustomers();
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCustomers() {
    if (!supabase) return;
    setLoading(true);

    const { data: quotesData } = await supabase
      .from("quotes")
      .select("customer_name, customer_email, customer_phone, status, created_at")
      .order("created_at", { ascending: false });

    if (!quotesData) { setLoading(false); return; }

    const map = new Map<string, Customer>();
    for (const row of quotesData) {
      const key = row.customer_email.toLowerCase();
      if (map.has(key)) {
        const c = map.get(key)!;
        c.quoteCount++;
        c.statuses.push(row.status);
      } else {
        map.set(key, {
          name: row.customer_name,
          email: row.customer_email,
          phone: row.customer_phone ?? null,
          quoteCount: 1,
          lastQuote: row.created_at,
          statuses: [row.status],
          visits: [],
          lastLogin: row.created_at,
        });
      }
    }

    // Fetch visitor_logs for all customer emails
    const emails = Array.from(map.keys());
    if (emails.length > 0) {
      const { data: visitsData } = await supabase
        .from("visitor_logs")
        .select("ip, visited_at, user_email")
        .in("user_email", emails)
        .order("visited_at", { ascending: false });

      if (visitsData) {
        const visitsByEmail = new Map<string, Map<string, string>>();
        for (const v of visitsData) {
          const email = v.user_email?.toLowerCase();
          if (!email || !map.has(email)) continue;
          if (!visitsByEmail.has(email)) visitsByEmail.set(email, new Map());
          const ipMap = visitsByEmail.get(email)!;
          // visits are desc ordered — first occurrence per IP is most recent
          if (!ipMap.has(v.ip)) ipMap.set(v.ip, v.visited_at);
        }

        for (const [email, customer] of map) {
          const ipMap = visitsByEmail.get(email);
          if (ipMap) {
            customer.visits = Array.from(ipMap.entries())
              .map(([ip, lastSeen]) => ({ ip, lastSeen }))
              .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
            customer.lastLogin = customer.visits[0].lastSeen;
          }
        }
      }
    }

    // Sort by most recent login/visit
    const sorted = Array.from(map.values()).sort((a, b) =>
      b.lastLogin.localeCompare(a.lastLogin)
    );
    setCustomers(sorted);
    setLoading(false);
  }

  function toggleExpand(email: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(email) ? next.delete(email) : next.add(email);
      return next;
    });
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

  function exportToExcel() {
    const rows = customers.map((c) => ({
      "Navn": c.name,
      "E-post": c.email,
      "Telefon": c.phone ?? "",
      "Antall forespørsler": c.quoteCount,
      "Siste innlogging": formatDate(c.lastLogin),
      "IP-adresser": c.visits.map((v) => `${v.ip} (${formatDate(v.lastSeen)})`).join("; "),
      "Statuser": c.statuses.join(", "),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kunder");
    XLSX.writeFile(wb, `kunder-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? "").includes(search)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/admin" className="text-sm text-orange-600 hover:text-orange-800">← Admin</Link>
            <h1 className="mt-1 text-xl font-bold text-gray-900">Kunderegister</h1>
            <p className="text-xs text-gray-400">{customers.length} unike kunder · sortert etter siste innlogging</p>
          </div>
          <button onClick={exportToExcel} disabled={customers.length === 0}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </button>
          <button onClick={() => supabase?.auth.signOut()} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 hover:bg-gray-50">Logg ut</button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Søk på navn, e-post eller telefon…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">Laster...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">Ingen kunder funnet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">Kunde</th>
                  <th className="hidden px-4 py-3 text-left sm:table-cell">Telefon</th>
                  <th className="px-4 py-3 text-left">Forespørsler</th>
                  <th className="px-4 py-3 text-left">Siste innlogging</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => {
                  const isOpen = expanded.has(c.email);
                  return (
                    <>
                      <tr
                        key={c.email}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleExpand(c.email)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{c.name}</p>
                          <a
                            href={`mailto:${c.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-orange-500 hover:underline"
                          >
                            {c.email}
                          </a>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-gray-500 sm:table-cell">
                          {c.phone
                            ? <a href={`tel:${c.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-orange-500">{c.phone}</a>
                            : <span className="text-gray-300">–</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-900">{c.quoteCount}</span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-gray-700">{formatDate(c.lastLogin)}</p>
                          {c.visits.length > 0 && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {c.visits.length} IP{c.visits.length !== 1 ? "-adresser" : "-adresse"}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <svg
                            className={`ml-auto h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr key={`${c.email}-expand`} className="bg-gray-50">
                          <td colSpan={5} className="px-6 pb-4 pt-2">
                            <div className="flex flex-wrap gap-6">
                              {/* IP list */}
                              <div className="flex-1 min-w-[200px]">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">IP-adresser</p>
                                {c.visits.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">Ingen innlogginger registrert</p>
                                ) : (
                                  <div className="space-y-1">
                                    {c.visits.map((v, i) => (
                                      <div key={v.ip} className="flex items-center gap-3">
                                        {i === 0 && (
                                          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-400 shrink-0" />
                                        )}
                                        {i > 0 && (
                                          <span className="inline-flex h-1.5 w-1.5 rounded-full bg-gray-300 shrink-0" />
                                        )}
                                        <span className="font-mono text-xs text-gray-700">{v.ip}</span>
                                        <span className="text-xs text-gray-400">{formatDate(v.lastSeen)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex flex-col gap-2 justify-start">
                                <a
                                  href={`mailto:${c.email}`}
                                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 whitespace-nowrap"
                                >
                                  Send e-post
                                </a>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
