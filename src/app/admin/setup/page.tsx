"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Migration {
  id: string;
  name: string;
  description: string;
  sql: string;
  checkEndpoint: string;
}

const MIGRATIONS: Migration[] = [
  {
    id: "map_placement",
    name: "Tomteplassering",
    description: "Lagrer kundens kartplassering (koordinater, rotasjon, adresse) på bestillinger. Nødvendig for situasjonsplan-integrasjonen.",
    sql: `ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS map_lat      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS map_lng      DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS map_rotation INTEGER,
  ADD COLUMN IF NOT EXISTS map_address  TEXT;`,
    checkEndpoint: "/api/admin/run-sql",
  },
];

export default function AdminSetupPage() {
  const [status, setStatus]   = useState<Record<string, boolean | null>>({});
  const [results, setResults] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [copied, setCopied]   = useState<string | null>(null);

  useEffect(() => {
    MIGRATIONS.forEach(async (m) => {
      try {
        const res  = await fetch(m.checkEndpoint);
        const data = await res.json();
        setStatus((s) => ({ ...s, [m.id]: data.migrated === true }));
      } catch {
        setStatus((s) => ({ ...s, [m.id]: null }));
      }
    });
  }, []);

  async function runMigration(m: Migration) {
    setRunning(m.id);
    try {
      const res  = await fetch("/api/admin/run-sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: m.sql }),
      });
      const data = await res.json();
      setResults((r) => ({ ...r, [m.id]: { ok: data.ok, msg: data.msg ?? (data.ok ? "OK" : "Feil") } }));
      if (data.ok) setStatus((s) => ({ ...s, [m.id]: true }));
    } catch (e) {
      setResults((r) => ({ ...r, [m.id]: { ok: false, msg: String(e) } }));
    } finally {
      setRunning(null);
    }
  }

  async function copy(id: string, sql: string) {
    await navigator.clipboard.writeText(sql);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-orange-500 transition-colors">← Admin</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-sm font-semibold text-gray-800">Oppsett / Migrasjoner</h1>
        </div>

        <div className="mb-6 rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
          <p className="font-semibold mb-1">Automatisk kjøring</p>
          <p>Klikk «Kjør» for automatisk kjøring via Supabase Management API. Krever at <code className="bg-blue-100 px-1 rounded">SUPABASE_ACCESS_TOKEN</code> er satt i <code className="bg-blue-100 px-1 rounded">.env.local</code> (hentes fra{" "}
            <a href="https://supabase.com/dashboard/account/tokens" target="_blank" rel="noopener noreferrer" className="underline font-medium">supabase.com → Account → Access tokens ↗</a>).
          </p>
          <p className="mt-1">Alternativt: kopier SQL og kjør manuelt i{" "}
            <a href="https://supabase.com/dashboard/project/knznyeiorsypxwireuok/sql/new" target="_blank" rel="noopener noreferrer" className="underline font-medium">Supabase SQL Editor ↗</a>.
          </p>
        </div>

        <div className="space-y-4">
          {MIGRATIONS.map((m) => {
            const applied = status[m.id];
            const result  = results[m.id];
            return (
              <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div>
                    <p className="font-semibold text-gray-800">{m.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                  </div>
                  <div className="shrink-0 ml-4">
                    {applied === null || applied === undefined ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-pulse" />
                        Sjekker…
                      </span>
                    ) : applied ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Kjørt
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        Ikke kjørt
                      </span>
                    )}
                  </div>
                </div>

                <div className="px-5 py-4">
                  <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto text-gray-700 leading-relaxed">
                    {m.sql}
                  </pre>

                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    {!applied && (
                      <button
                        onClick={() => runMigration(m)}
                        disabled={running === m.id}
                        className="flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
                      >
                        {running === m.id ? (
                          <>
                            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
                              <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                            Kjører…
                          </>
                        ) : "Kjør migrasjon"}
                      </button>
                    )}

                    <button
                      onClick={() => copy(m.id, m.sql)}
                      className="text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-2 transition-colors"
                    >
                      {copied === m.id ? "✓ Kopiert" : "Kopier SQL"}
                    </button>

                    <a
                      href="https://supabase.com/dashboard/project/knznyeiorsypxwireuok/sql/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-800 border border-blue-200 rounded-lg px-3 py-2 transition-colors"
                    >
                      Åpne SQL Editor ↗
                    </a>

                    {result && (
                      <span className={`text-sm font-medium ${result.ok ? "text-green-600" : "text-red-600"}`}>
                        {result.ok ? "✓" : "✗"} {result.msg}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
