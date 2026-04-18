"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

interface Customer {
  name: string;
  email: string;
  phone: string | null;
  quoteCount: number;
  lastQuote: string;
  statuses: string[];
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
    const { data } = await supabase
      .from("quotes")
      .select("customer_name, customer_email, customer_phone, status, created_at")
      .order("created_at", { ascending: false });

    if (data) {
      const map = new Map<string, Customer>();
      for (const row of data) {
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
          });
        }
      }
      setCustomers(Array.from(map.values()));
    }
    setLoading(false);
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

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone ?? "").includes(search)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Kunderegister</h1>
            <p className="mt-0.5 text-sm text-gray-400">{customers.length} unike kunder</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Admin</Link>
            <button onClick={() => supabase?.auth.signOut()} className="text-sm text-gray-400 hover:text-gray-600">Logg ut</button>
          </div>
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
                  <th className="hidden px-4 py-3 text-left md:table-cell">Siste forespørsel</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((c) => (
                  <tr key={c.email} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <a href={`mailto:${c.email}`} className="text-xs text-orange-500 hover:underline">{c.email}</a>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-gray-500 sm:table-cell">
                      {c.phone ? <a href={`tel:${c.phone}`} className="hover:text-orange-500">{c.phone}</a> : <span className="text-gray-300">–</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">{c.quoteCount}</span>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-gray-400 md:table-cell">{formatDate(c.lastQuote)}</td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`mailto:${c.email}`}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                      >
                        Send e-post
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
