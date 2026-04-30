"use client";

import { useState, useEffect, useCallback, useRef } from "react";
// @ts-ignore
import * as XLSX from "xlsx";
import Link from "next/link";

const DB_SUPPLIERS = ["Optimera", "XLBygg", "Coop Obs Bygg", "Neumann"];

interface PriceRow {
  varenr: string;
  beskrivelse: string;
  dimensjon?: string;
  enhet?: string;
  pris: number;
}

interface Source {
  id: string;
  name: string;
  rows: PriceRow[];
  isOrdered?: boolean; // marked as "faktisk bestilt"
  fromDb?: boolean;
}

interface ComparisonRow {
  varenr: string;
  beskrivelse: string;
  dimensjon?: string;
  enhet?: string;
  cells: Record<string, number | undefined>; // sourceId -> pris
  ranks: Record<string, number>; // sourceId -> rank (1=cheapest), excludes isOrdered
}

interface ColumnMap {
  varenr: string;
  beskrivelse: string;
  pris: string;
  enhet?: string;
  dimensjon?: string;
}

interface PendingUpload {
  name: string;
  headers: string[];
  previewRows: Record<string, string>[];
  colMap: ColumnMap;
  isOrdered: boolean;
  rawRows: Record<string, string>[];
}

const RANK_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800 border-green-300",
  2: "bg-yellow-100 text-yellow-800 border-yellow-300",
  3: "bg-orange-100 text-orange-800 border-orange-300",
  4: "bg-red-100 text-red-700 border-red-300",
};

function parseNumber(s: string): number {
  if (!s) return NaN;
  // Handle Norwegian decimal comma
  return parseFloat(s.replace(/\s/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
}

function autoDetectColumns(headers: string[]): Partial<ColumnMap> {
  const lower = headers.map(h => h.toLowerCase());
  const find = (...terms: string[]) => headers[lower.findIndex(h => terms.some(t => h.includes(t)))] ?? "";
  return {
    varenr: find("varenr", "art nr", "artnr", "art.nr", "item no", "artikkelnr"),
    beskrivelse: find("benevnelse", "beskrivelse", "navn", "name", "item", "description", "tekst"),
    pris: find("nettopris", "netto", "pris", "price", "beløp", "enhetspris"),
    enhet: find("enhet", "unit"),
    dimensjon: find("dimensjon", "dim", "size"),
  };
}

function buildComparison(sources: Source[]): ComparisonRow[] {
  const priceSources = sources.filter(s => !s.isOrdered);
  const orderedSource = sources.find(s => s.isOrdered);
  const activeSources = orderedSource ? [...priceSources, orderedSource] : priceSources;

  const map = new Map<string, { beskrivelse: string; dimensjon?: string; enhet?: string; cells: Record<string, number | undefined> }>();

  for (const src of activeSources) {
    for (const row of src.rows) {
      const key = row.varenr.trim();
      if (!map.has(key)) {
        map.set(key, { beskrivelse: row.beskrivelse, dimensjon: row.dimensjon, enhet: row.enhet, cells: {} });
      }
      const entry = map.get(key)!;
      entry.cells[src.id] = row.pris;
      if (!entry.beskrivelse && row.beskrivelse) entry.beskrivelse = row.beskrivelse;
      if (!entry.enhet && row.enhet) entry.enhet = row.enhet;
    }
  }

  const result: ComparisonRow[] = [];
  for (const [varenr, { beskrivelse, dimensjon, enhet, cells }] of map) {
    // Rank only non-ordered sources
    const sortedByPrice = priceSources
      .filter(s => cells[s.id] !== undefined)
      .sort((a, b) => (cells[a.id] ?? Infinity) - (cells[b.id] ?? Infinity));
    const ranks: Record<string, number> = {};
    sortedByPrice.forEach((s, i) => { ranks[s.id] = i + 1; });
    result.push({ varenr, beskrivelse, dimensjon, enhet, cells, ranks });
  }

  return result.sort((a, b) => a.varenr.localeCompare(b.varenr, "nb"));
}

function parseExcelFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let rows: Record<string, string>[] = [];
        let headers: string[] = [];

        if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
          const text = typeof data === "string" ? data : new TextDecoder("utf-8").decode(data as ArrayBuffer);
          // Detect delimiter
          const firstLine = text.split("\n")[0] ?? "";
          const delim = firstLine.includes(";") ? ";" : firstLine.includes("\t") ? "\t" : ",";
          const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
          headers = lines[0].split(delim).map(h => h.replace(/^"|"$/g, "").trim());
          rows = lines.slice(1).map(line => {
            const cols = line.split(delim).map(c => c.replace(/^"|"$/g, "").trim());
            return Object.fromEntries(headers.map((h, i) => [h, cols[i] ?? ""]));
          });
        } else {
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
          headers = json.length ? Object.keys(json[0]) : [];
          rows = json.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v)])));
        }
        resolve({ headers, rows });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Kunne ikke lese filen"));
    if (file.name.endsWith(".csv") || file.name.endsWith(".txt")) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

function applyColumnMap(rows: Record<string, string>[], colMap: ColumnMap): PriceRow[] {
  const result: PriceRow[] = [];
  for (const row of rows) {
    const varenr = (row[colMap.varenr] ?? "").trim();
    const pris = parseNumber(row[colMap.pris] ?? "");
    if (!varenr || isNaN(pris) || pris <= 0) continue;
    result.push({
      varenr,
      beskrivelse: (row[colMap.beskrivelse] ?? "").trim(),
      enhet: colMap.enhet ? (row[colMap.enhet] ?? "").trim() : undefined,
      dimensjon: colMap.dimensjon ? (row[colMap.dimensjon] ?? "").trim() : undefined,
      pris,
    });
  }
  return result;
}

function formatPrice(n: number | undefined): string {
  if (n === undefined) return "—";
  return n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PrissammenlignPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [dbLoading, setDbLoading] = useState<string[]>([]);
  const [dbSelected, setDbSelected] = useState<Record<string, boolean>>({});
  const [comparison, setComparison] = useState<ComparisonRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "diff" | "missing">("all");
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [pendingName, setPendingName] = useState("");
  const [pendingIsOrdered, setPendingIsOrdered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setIsAdmin(d.isAdmin ?? false)).catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    setComparison(buildComparison(sources));
  }, [sources]);

  async function fetchDbSupplier(supplier: string) {
    if (dbLoading.includes(supplier)) return;
    setDbLoading(prev => [...prev, supplier]);
    try {
      const res = await fetch(`/api/admin/prissammenligner?suppliers=${encodeURIComponent(supplier)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Feil");
      const rows: PriceRow[] = (json.data ?? []).map((r: { varenr: string; varebenevnelse: string; dimensjon?: string; enhet?: string; nettopris: number }) => ({
        varenr: r.varenr ?? "",
        beskrivelse: r.varebenevnelse ?? "",
        dimensjon: r.dimensjon,
        enhet: r.enhet,
        pris: Number(r.nettopris ?? 0),
      })).filter((r: PriceRow) => r.varenr && r.pris > 0);
      setSources(prev => {
        const filtered = prev.filter(s => s.id !== `db-${supplier}`);
        return [...filtered, { id: `db-${supplier}`, name: supplier, rows, fromDb: true }];
      });
    } catch (err) {
      alert(`Kunne ikke hente priser for ${supplier}: ${err instanceof Error ? err.message : "Ukjent feil"}`);
    } finally {
      setDbLoading(prev => prev.filter(s => s !== supplier));
    }
  }

  function toggleDbSupplier(supplier: string, checked: boolean) {
    setDbSelected(prev => ({ ...prev, [supplier]: checked }));
    if (checked) {
      fetchDbSupplier(supplier);
    } else {
      setSources(prev => prev.filter(s => s.id !== `db-${supplier}`));
    }
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { headers, rows } = await parseExcelFile(file);
      const detected = autoDetectColumns(headers);
      const colMap: ColumnMap = {
        varenr: detected.varenr ?? headers[0] ?? "",
        beskrivelse: detected.beskrivelse ?? headers[1] ?? "",
        pris: detected.pris ?? headers[2] ?? "",
        enhet: detected.enhet,
        dimensjon: detected.dimensjon,
      };
      setPending({
        name: pendingName || file.name.replace(/\.[^.]+$/, ""),
        headers,
        previewRows: rows.slice(0, 5),
        colMap,
        isOrdered: pendingIsOrdered,
        rawRows: rows,
      });
      if (!pendingName) setPendingName(file.name.replace(/\.[^.]+$/, ""));
    } catch {
      alert("Kunne ikke lese filen. Støttede formater: .xlsx, .xls, .csv, .txt");
    }
    e.target.value = "";
  }

  function commitUpload() {
    if (!pending) return;
    const rows = applyColumnMap(pending.rawRows, pending.colMap);
    if (rows.length === 0) {
      alert("Ingen gyldige rader funnet med valgte kolonner. Sjekk kolonnetilordning.");
      return;
    }
    const id = `upload-${Date.now()}`;
    setSources(prev => [...prev, {
      id,
      name: pending.name || "Ukjent",
      rows,
      isOrdered: pending.isOrdered,
    }]);
    setPending(null);
    setPendingName("");
    setPendingIsOrdered(false);
    setShowUploadPanel(false);
  }

  function removeSource(id: string) {
    setSources(prev => prev.filter(s => s.id !== id));
    // Also uncheck DB checkbox if applicable
    const sup = id.startsWith("db-") ? id.slice(3) : null;
    if (sup) setDbSelected(prev => ({ ...prev, [sup]: false }));
  }

  const activeSources = sources;
  const priceSources = activeSources.filter(s => !s.isOrdered);
  const orderedSource = activeSources.find(s => s.isOrdered);

  const filtered = comparison.filter(row => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!row.varenr.toLowerCase().includes(q) && !row.beskrivelse.toLowerCase().includes(q)) return false;
    }
    if (filter === "diff") {
      const prices = priceSources.map(s => row.cells[s.id]).filter(p => p !== undefined);
      if (prices.length < 2) return false;
      const min = Math.min(...prices as number[]);
      const max = Math.max(...prices as number[]);
      return max - min > 0.01;
    }
    if (filter === "missing") {
      return priceSources.some(s => row.cells[s.id] === undefined);
    }
    return true;
  });

  const totalDiff = useCallback(() => {
    if (priceSources.length < 2) return null;
    let totalSaved = 0, totalBase = 0;
    for (const row of comparison) {
      const prices = priceSources.map(s => row.cells[s.id]).filter(p => p !== undefined) as number[];
      if (prices.length < 2) continue;
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      totalBase += max;
      totalSaved += max - min;
    }
    if (totalBase === 0) return null;
    return ((totalSaved / totalBase) * 100).toFixed(1);
  }, [comparison, priceSources]);

  if (isAdmin === null) {
    return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Du må være innlogget som admin for å bruke prissammenligningen.</p>
        <Link href="/admin" className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">Gå til admin</Link>
      </div>
    );
  }

  const diffPct = totalDiff();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <h1 className="text-xl font-bold text-gray-900">Prissammenligner</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px,1fr]">

          {/* ── Left panel: sources ── */}
          <div className="space-y-4">

            {/* DB suppliers */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Fra prisdatabase</h2>
              <div className="space-y-2">
                {DB_SUPPLIERS.map(sup => {
                  const loaded = sources.some(s => s.id === `db-${sup}`);
                  const loading = dbLoading.includes(sup);
                  return (
                    <label key={sup} className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={dbSelected[sup] ?? false}
                        onChange={e => toggleDbSupplier(sup, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                      />
                      <span className="text-sm text-gray-700">{sup}</span>
                      {loading && <span className="text-xs text-gray-400">laster…</span>}
                      {!loading && loaded && (
                        <span className="text-xs text-green-600">
                          {sources.find(s => s.id === `db-${sup}`)?.rows.length.toLocaleString("nb-NO")} varer
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Uploaded quotes */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Opplastede tilbud</h2>
                <button
                  onClick={() => setShowUploadPanel(p => !p)}
                  className="rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-600 hover:bg-orange-100"
                >
                  + Legg til
                </button>
              </div>

              {sources.filter(s => !s.fromDb).length === 0 && (
                <p className="text-xs text-gray-400">Ingen tilbud lastet opp ennå.</p>
              )}
              <div className="space-y-2">
                {sources.filter(s => !s.fromDb).map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-700">{s.name}</p>
                      <p className="text-xs text-gray-400">
                        {s.rows.length.toLocaleString("nb-NO")} varer{s.isOrdered ? " · faktisk bestilt" : ""}
                      </p>
                    </div>
                    <button onClick={() => removeSource(s.id)} className="shrink-0 text-gray-300 hover:text-red-500 text-sm">✕</button>
                  </div>
                ))}
              </div>

              {/* Upload panel */}
              {showUploadPanel && (
                <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Leverandørnavn</label>
                    <input
                      type="text"
                      placeholder="f.eks. Bygget AS"
                      value={pendingName}
                      onChange={e => setPendingName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pendingIsOrdered}
                      onChange={e => setPendingIsOrdered(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-orange-500"
                    />
                    Faktisk bestilt (referanse)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    className="hidden"
                    onChange={handleFileChosen}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:border-orange-400 hover:text-orange-500"
                  >
                    Velg fil (.xlsx, .csv, .txt)
                  </button>
                  {pending && (
                    <p className="text-xs text-green-600">Fil lest — se kolonnetilordning nedenfor</p>
                  )}
                </div>
              )}
            </div>

            {/* Summary stats */}
            {comparison.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-sm">
                <div className="space-y-1.5 text-gray-600">
                  <div className="flex justify-between">
                    <span>Unike varer</span>
                    <span className="font-medium text-gray-900">{comparison.length.toLocaleString("nb-NO")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Leverandører</span>
                    <span className="font-medium text-gray-900">{priceSources.length}</span>
                  </div>
                  {diffPct !== null && (
                    <div className="flex justify-between">
                      <span>Maks prisforskjell</span>
                      <span className="font-medium text-orange-600">{diffPct}%</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          <div className="space-y-4">

            {/* Column mapping (shown after upload) */}
            {pending && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
                <h2 className="mb-4 text-sm font-semibold text-orange-800">Kolonnetilordning for «{pending.name}»</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(["varenr", "beskrivelse", "pris", "enhet", "dimensjon"] as const).map(field => (
                    <div key={field}>
                      <label className="block text-xs font-medium text-orange-700 mb-1 capitalize">
                        {field === "pris" ? "Nettopris *" : field === "varenr" ? "Varenr *" : field === "beskrivelse" ? "Beskrivelse *" : field}
                      </label>
                      <select
                        value={pending.colMap[field] ?? ""}
                        onChange={e => setPending(p => p ? { ...p, colMap: { ...p.colMap, [field]: e.target.value || undefined } } : p)}
                        className="w-full rounded-lg border border-orange-300 bg-white px-2.5 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                      >
                        <option value="">— ingen —</option>
                        {pending.headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Preview */}
                <div className="mt-4 overflow-x-auto rounded-lg border border-orange-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-orange-100">
                      <tr>
                        {["varenr", "beskrivelse", "pris", "enhet"].map(f => (
                          <th key={f} className="px-3 py-2 text-left font-medium text-orange-700">{f}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pending.previewRows.map((row, i) => (
                        <tr key={i} className="border-t border-orange-100 bg-white">
                          <td className="px-3 py-1.5 text-gray-700">{row[pending.colMap.varenr] ?? "—"}</td>
                          <td className="px-3 py-1.5 text-gray-700 max-w-[200px] truncate">{row[pending.colMap.beskrivelse] ?? "—"}</td>
                          <td className="px-3 py-1.5 text-gray-700">{row[pending.colMap.pris] ?? "—"}</td>
                          <td className="px-3 py-1.5 text-gray-700">{pending.colMap.enhet ? (row[pending.colMap.enhet] ?? "—") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={commitUpload}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
                  >
                    Legg til i sammenligning
                  </button>
                  <button
                    onClick={() => { setPending(null); setPendingName(""); }}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}

            {/* Comparison table */}
            {comparison.length > 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-3">
                  <input
                    type="text"
                    placeholder="Søk varenr eller beskrivelse…"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                  />
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                    {(["all", "diff", "missing"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-3 py-1.5 transition-colors ${filter === f ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                      >
                        {f === "all" ? "Alle" : f === "diff" ? "Prisforskjell" : "Mangler"}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400">{filtered.length.toLocaleString("nb-NO")} rader</span>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs">
                      <tr>
                        <th className="sticky left-0 z-10 bg-gray-50 px-3 py-3 text-left font-medium text-gray-500 min-w-[90px]">Varenr</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-500 min-w-[200px]">Beskrivelse</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-500">Dim.</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-500">Enhet</th>
                        {priceSources.map(s => (
                          <th key={s.id} className="px-3 py-3 text-right font-medium text-gray-700 min-w-[110px] whitespace-nowrap">
                            {s.name}
                          </th>
                        ))}
                        {orderedSource && (
                          <th className="px-3 py-3 text-right font-medium text-blue-600 min-w-[110px] whitespace-nowrap">
                            {orderedSource.name} ✓
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={4 + priceSources.length + (orderedSource ? 1 : 0)} className="py-8 text-center text-sm text-gray-400">
                            Ingen varer funnet
                          </td>
                        </tr>
                      )}
                      {filtered.map(row => {
                        const presentPrices = priceSources
                          .map(s => row.cells[s.id])
                          .filter((p): p is number => p !== undefined);
                        const minPrice = presentPrices.length ? Math.min(...presentPrices) : null;

                        return (
                          <tr key={row.varenr} className="hover:bg-gray-50">
                            <td className="sticky left-0 z-10 bg-white px-3 py-2 font-mono text-xs text-gray-600 group-hover:bg-gray-50">
                              {row.varenr}
                            </td>
                            <td className="px-3 py-2 text-gray-700 max-w-xs">
                              <span className="line-clamp-2">{row.beskrivelse}</span>
                            </td>
                            <td className="px-3 py-2 text-gray-400 text-xs">{row.dimensjon ?? ""}</td>
                            <td className="px-3 py-2 text-gray-400 text-xs">{row.enhet ?? ""}</td>
                            {priceSources.map(s => {
                              const pris = row.cells[s.id];
                              const rank = row.ranks[s.id];
                              const isCheapest = rank === 1 && presentPrices.length > 1;
                              return (
                                <td key={s.id} className="px-3 py-2 text-right">
                                  {pris === undefined ? (
                                    <span className="text-gray-300">—</span>
                                  ) : (
                                    <span className={`inline-flex items-center gap-1 ${isCheapest ? "font-semibold text-green-700" : "text-gray-700"}`}>
                                      {rank !== undefined && presentPrices.length > 1 && (
                                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${RANK_COLORS[rank] ?? "bg-gray-100 text-gray-500 border-gray-300"}`}>
                                          {rank}
                                        </span>
                                      )}
                                      {formatPrice(pris)}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            {orderedSource && (
                              <td className="px-3 py-2 text-right">
                                {row.cells[orderedSource.id] === undefined ? (
                                  <span className="text-gray-300">—</span>
                                ) : (
                                  <span className={`font-medium ${minPrice !== null && row.cells[orderedSource.id]! > minPrice ? "text-red-600" : "text-blue-600"}`}>
                                    {formatPrice(row.cells[orderedSource.id])}
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="mt-4 text-sm font-medium text-gray-500">Ingen data å sammenligne ennå</p>
                <p className="mt-1 text-xs text-gray-400">
                  Velg leverandører fra databasen eller last opp tilbudsfiler for å starte.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
