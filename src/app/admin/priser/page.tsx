"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { SupplierPriceRow } from "@/app/api/admin/supplier-prices/route";

// ── Suppliers ──────────────────────────────────────────────────────────────────
const SUPPLIERS = ["Optimera", "XLBygg", "Coop Obs Bygg", "Neumann"] as const;
type Supplier = (typeof SUPPLIERS)[number];

// ── Parse Optimera semicolon file ─────────────────────────────────────────────
// Format: varegruppenr;ean;varenr;kategori;varebenevnelse;bruttopris(øre);nettopris(øre);
//         enhet;varenr2;dimensjon;enhet2;antall;kostpris(øre);mva_kode;...
function parseOptimeraFile(text: string, supplier: string): SupplierPriceRow[] {
  const rows: SupplierPriceRow[] = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  for (const line of lines) {
    const c = line.split(";");
    if (c.length < 8) continue;
    const varenr = c[2]?.trim();
    if (!varenr) continue;

    const bruttopris = parseInt(c[5] ?? "0", 10) / 100;
    const nettopris  = parseInt(c[6] ?? "0", 10) / 100;
    const kostpris   = parseInt(c[12] ?? "0", 10) / 100;
    const mvaKode    = parseInt(c[13] ?? "2500", 10);
    const mva_pst    = mvaKode === 2500 ? 25 : mvaKode === 2400 ? 24 : mvaKode === 1500 ? 15 : 25;

    rows.push({
      supplier,
      varenr,
      ean:          c[1]?.trim() || undefined,
      varegruppenr: c[0]?.trim() || undefined,
      kategori:     c[3]?.trim() || undefined,
      varebenevnelse: c[4]?.trim() || "",
      dimensjon:    c[9]?.trim() || undefined,
      enhet:        c[7]?.trim() || undefined,
      bruttopris:   isNaN(bruttopris) ? 0 : bruttopris,
      nettopris:    isNaN(nettopris)  ? 0 : nettopris,
      antall:       parseFloat(c[11] ?? "1") || 1,
      mva_pst,
    });
  }
  return rows;
}

// ── Formatted price ────────────────────────────────────────────────────────────
function kr(n: number) {
  return n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";
}

interface PriceRecord {
  id: string;
  supplier: string;
  varenr: string;
  ean?: string;
  kategori?: string;
  varebenevnelse: string;
  dimensjon?: string;
  enhet?: string;
  bruttopris: number;
  nettopris: number;
  mva_pst: number;
  updated_at: string;
}

export default function PriserPage() {
  const [supplier, setSupplier]       = useState<Supplier>("Optimera");
  const [rows, setRows]               = useState<PriceRecord[]>([]);
  const [total, setTotal]             = useState(0);
  const [search, setSearch]           = useState("");
  const [loading, setLoading]         = useState(false);
  const [importing, setImporting]     = useState(false);
  const [importMsg, setImportMsg]     = useState<{ ok: boolean; warn?: boolean; text: string } | null>(null);
  const [counts, setCounts]           = useState<Record<string, number>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // Load rows whenever supplier or search changes
  useEffect(() => {
    loadRows();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplier, search]);

  // Load counts for all suppliers on mount
  useEffect(() => { loadCounts(); }, []);

  async function loadRows() {
    setLoading(true);
    const params = new URLSearchParams({ supplier, limit: "200" });
    if (search) params.set("q", search);
    const res = await fetch(`/api/admin/supplier-prices?${params}`);
    const json = await res.json();
    setRows(json.data ?? []);
    setTotal(json.count ?? 0);
    setLoading(false);
  }

  async function loadCounts() {
    const results: Record<string, number> = {};
    await Promise.all(SUPPLIERS.map(async (s) => {
      const res = await fetch(`/api/admin/supplier-prices?supplier=${s}&limit=1`);
      const json = await res.json();
      results[s] = json.count ?? 0;
    }));
    setCounts(results);
  }

  // ── Import Optimera built-in file ──────────────────────────────────────────
  async function importOptimeraBuiltin() {
    setImporting(true); setImportMsg(null);
    try {
      const res  = await fetch("/Prisfil optimera 13042026.txt");
      const text = await res.text();
      const parsed = parseOptimeraFile(text, "Optimera");
      await uploadRows(parsed, "Optimera");
    } catch (e) {
      setImportMsg({ ok: false, text: String(e) });
    } finally {
      setImporting(false);
    }
  }

  // ── Import from uploaded file ──────────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg(null);
    try {
      const text   = await file.text();
      const parsed = parseOptimeraFile(text, supplier);
      await uploadRows(parsed, supplier);
    } catch (e) {
      setImportMsg({ ok: false, text: String(e) });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function uploadRows(parsed: SupplierPriceRow[], sup: string) {
    if (!parsed.length) {
      setImportMsg({ ok: false, text: "Ingen rader ble funnet i filen." });
      return;
    }

    // Detect duplicate varenr within the file before uploading
    const varenrCount = new Map<string, number>();
    for (const row of parsed) {
      if (row.varenr) varenrCount.set(row.varenr, (varenrCount.get(row.varenr) ?? 0) + 1);
    }
    const duplicates = Array.from(varenrCount.entries())
      .filter(([, n]) => n > 1)
      .map(([varenr]) => varenr);

    const BATCH = 1500;
    let totalInserted = 0;

    for (let i = 0; i < parsed.length; i += BATCH) {
      const batch = parsed.slice(i, i + BATCH);
      const res = await fetch("/api/admin/supplier-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier: sup, rows: batch }),
      });

      const text = await res.text();
      let json: { inserted?: number; error?: string } = {};
      try { json = JSON.parse(text); } catch {
        setImportMsg({ ok: false, text: `Serverfeil: ${text.slice(0, 120)}` });
        return;
      }

      if (!res.ok) {
        setImportMsg({ ok: false, text: json.error ?? "Feil ved import" });
        return;
      }
      totalInserted += json.inserted ?? 0;
    }

    if (duplicates.length > 0) {
      const shown = duplicates.slice(0, 8).join(", ");
      const extra = duplicates.length > 8 ? ` … og ${duplicates.length - 8} til` : "";
      setImportMsg({
        ok: true,
        warn: true,
        text: `${totalInserted} varer importert for ${sup}. ⚠ ${duplicates.length} duplikat varenr (siste rad brukt): ${shown}${extra}`,
      });
    } else {
      setImportMsg({ ok: true, text: `${totalInserted} varer importert for ${sup}` });
    }
    await loadRows();
    await loadCounts();
  }

  // ── Delete supplier's prices ───────────────────────────────────────────────
  async function clearSupplier() {
    if (!confirm(`Slett alle priser for ${supplier}?`)) return;
    const res = await fetch(`/api/admin/supplier-prices?supplier=${encodeURIComponent(supplier)}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok) {
      setImportMsg({ ok: true, text: `Slettet ${json.deleted} rader for ${supplier}` });
      setRows([]); setTotal(0);
      await loadCounts();
    } else {
      setImportMsg({ ok: false, text: json.error ?? "Feil ved sletting" });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
            <h1 className="text-xl font-bold text-gray-900">Prisdatabase</h1>
          </div>
        </div>

        {/* Supplier tabs + counts */}
        <div className="mb-6 flex flex-wrap gap-2">
          {SUPPLIERS.map(s => (
            <button
              key={s}
              onClick={() => { setSupplier(s); setSearch(""); setImportMsg(null); }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                supplier === s
                  ? "bg-orange-500 text-white shadow-sm"
                  : "bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:text-orange-600"
              }`}
            >
              {s}
              {counts[s] != null && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                  supplier === s ? "bg-orange-400 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {counts[s].toLocaleString("nb-NO")}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Import panel */}
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Importer prisfil — {supplier}</h2>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Optimera: one-click from built-in file */}
            {supplier === "Optimera" && (
              <button
                onClick={importOptimeraBuiltin}
                disabled={importing}
                className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {importing ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                Importer Prisfil optimera 13042026.txt
              </button>
            )}

            {/* All suppliers: file upload */}
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              Last opp prisfil (.txt)
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.csv"
                className="hidden"
                onChange={handleFileUpload}
                disabled={importing}
              />
            </label>

            {rows.length > 0 && (
              <button
                onClick={clearSupplier}
                className="ml-auto rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50"
              >
                Slett alle for {supplier}
              </button>
            )}
          </div>

          <p className="mt-2 text-xs text-gray-400">
            Formatet er Optimera sin semikolon-separerte prisfil. Priser importeres som bruttopris inkl. MVA.
            Nye rader legges til, eksisterende oppdateres (upsert på varenr).
          </p>

          {importMsg && (
            <div className={`mt-3 rounded-lg px-4 py-2.5 text-sm font-medium ${
              importMsg.warn ? "bg-yellow-50 text-yellow-800" :
              importMsg.ok  ? "bg-green-50 text-green-700"   : "bg-red-50 text-red-700"
            }`}>
              {importMsg.warn ? "" : importMsg.ok ? "✓ " : "✗ "}{importMsg.text}
            </div>
          )}
        </div>

        {/* Search + table */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
            <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Søk på varenr, navn eller dimensjon…"
              className="flex-1 text-sm outline-none placeholder:text-gray-300"
            />
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />}
            <span className="text-xs text-gray-400">{total.toLocaleString("nb-NO")} varer</span>
          </div>

          {rows.length === 0 && !loading ? (
            <div className="px-6 py-12 text-center text-sm text-gray-400">
              {total === 0
                ? `Ingen priser importert for ${supplier} ennå. Bruk import-knappen over.`
                : "Ingen treff på søket."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Varenr</th>
                    <th className="px-4 py-3 text-left">Varebenevnelse</th>
                    <th className="px-4 py-3 text-left">Kategori</th>
                    <th className="px-4 py-3 text-left">Dimensjon</th>
                    <th className="px-4 py-3 text-right">Enhet</th>
                    <th className="px-4 py-3 text-right">Bruttopris</th>
                    <th className="px-4 py-3 text-right">Nettopris</th>
                    <th className="px-4 py-3 text-right">MVA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.varenr}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800 max-w-xs truncate">{r.varebenevnelse}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[140px] truncate">{r.kategori}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">{r.dimensjon}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-500">{r.enhet}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-gray-800">{kr(r.bruttopris)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{kr(r.nettopris)}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-400">{r.mva_pst}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {total > 200 && (
                <p className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
                  Viser 200 av {total.toLocaleString("nb-NO")} — søk for å filtrere
                </p>
              )}
            </div>
          )}
        </div>

        {/* SQL hint */}
        <details className="mt-6">
          <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600">Supabase SQL-migrering (kjør én gang)</summary>
          <pre className="mt-2 rounded-lg bg-gray-800 p-4 text-xs text-green-300 overflow-x-auto whitespace-pre">{SQL_MIGRATION}</pre>
        </details>
      </div>
    </div>
  );
}

const SQL_MIGRATION = `-- Kjør i Supabase SQL-editor (én gang)
CREATE TABLE IF NOT EXISTS supplier_prices (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier      text NOT NULL,
  varenr        text NOT NULL,
  ean           text,
  varegruppenr  text,
  kategori      text,
  varebenevnelse text NOT NULL,
  dimensjon     text,
  enhet         text,
  bruttopris    numeric DEFAULT 0,
  nettopris     numeric DEFAULT 0,
  antall        numeric DEFAULT 1,
  mva_pst       integer DEFAULT 25,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (supplier, varenr)
);

CREATE INDEX IF NOT EXISTS supplier_prices_supplier_idx ON supplier_prices (supplier);
CREATE INDEX IF NOT EXISTS supplier_prices_varenr_idx   ON supplier_prices (varenr);
CREATE INDEX IF NOT EXISTS supplier_prices_search_idx   ON supplier_prices
  USING gin(to_tsvector('norwegian', varebenevnelse || ' ' || COALESCE(dimensjon, '')));

-- Tillat lese-tilgang for innloggede brukere, skrivetilgang via service-role
ALTER TABLE supplier_prices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read" ON supplier_prices FOR SELECT USING (true);
`;
