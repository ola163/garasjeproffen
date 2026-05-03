"use client";

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
// @ts-ignore
import * as XLSX from "xlsx";
import Link from "next/link";
import CatalogLinkWizard, { WizardResult } from "@/components/admin/CatalogLinkWizard";

// ── Types ──────────────────────────────────────────────────────────────────

interface ProjectLineItem {
  varenr: string;
  description: string;
  quantity: number;
  enhet?: string;
  dimensjon?: string;
  amount?: number; // internal price from the quote
}

interface ProjectSummary {
  id: string;
  ticket_number: string;
  customer_name: string;
  status: string;
  created_at: string;
  varenr_count: number;
  line_items: ProjectLineItem[];
}

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
  fromDb?: boolean;
  hasUpload?: boolean; // merged source where an uploaded quote overrides DB
}

interface ComparisonRow {
  varenr: string;
  beskrivelse: string;
  qty: number;
  enhet?: string;
  dimensjon?: string;
  cells: Record<string, number | undefined>; // sourceId -> unit price
  ranks: Record<string, number>; // 1 = cheapest
  internalPrice?: number; // from the quote itself
  fromProject: boolean; // false = only in uploaded source, not in project
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
  rawRows: Record<string, string>[];
  isPdf?: boolean;
  pdfRows?: PriceRow[]; // pre-parsed from PDF
}

const RANK_COLORS: Record<number, string> = {
  1: "bg-green-100 text-green-800 border-green-300",
  2: "bg-yellow-100 text-yellow-800 border-yellow-300",
  3: "bg-orange-100 text-orange-800 border-orange-300",
  4: "bg-red-100 text-red-700 border-red-300",
};

// ── Utilities ──────────────────────────────────────────────────────────────

function parseNumber(s: string): number {
  if (!s) return NaN;
  return parseFloat(s.replace(/\s/g, "").replace(/\.(?=\d{3})/g, "").replace(",", "."));
}

function autoDetectColumns(headers: string[]): Partial<ColumnMap> {
  const lower = headers.map(h => h.toLowerCase());
  const find = (...terms: string[]) => headers[lower.findIndex(h => terms.some(t => h.includes(t)))] ?? "";
  return {
    varenr: find("varenr", "artnr", "art nr", "art.nr", "artikkelnr", "item no"),
    beskrivelse: find("benevnelse", "beskrivelse", "navn", "name", "item", "description", "tekst"),
    pris: find("nettopris", "netto", "pris", "price", "beløp", "enhetspris"),
    enhet: find("enhet", "unit"),
    dimensjon: find("dimensjon", "dim", "size"),
  };
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
      enhet: colMap.enhet ? (row[colMap.enhet] ?? "").trim() || undefined : undefined,
      dimensjon: colMap.dimensjon ? (row[colMap.dimensjon] ?? "").trim() || undefined : undefined,
      pris,
    });
  }
  return result;
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
          const text = new TextDecoder("utf-8").decode(data as ArrayBuffer);
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
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error("Kunne ikke lese filen"));
    reader.readAsArrayBuffer(file);
  });
}

function formatPrice(n: number | undefined): string {
  if (n === undefined) return "—";
  return n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rowKey(varenr: string, beskrivelse: string): string {
  const v = varenr.trim().toLowerCase();
  return v || `#${beskrivelse.trim().toLowerCase().slice(0, 80)}`;
}

function buildComparison(projectItems: ProjectLineItem[], sources: Source[]): ComparisonRow[] {
  // Build rows in order: project items first, then uploaded-source-only rows
  const seen = new Set<string>();
  type RowDef = { key: string; varenr: string; beskrivelse: string; qty: number; enhet?: string; dimensjon?: string; fromProject: boolean; internalPrice?: number };
  const rowDefs: RowDef[] = [];

  for (const item of projectItems) {
    const key = rowKey(item.varenr, item.description);
    if (seen.has(key)) continue;
    seen.add(key);
    rowDefs.push({ key, varenr: item.varenr.trim(), beskrivelse: item.description, qty: item.quantity ?? 1, enhet: item.enhet, dimensjon: item.dimensjon, fromProject: true, internalPrice: item.amount });
  }

  // Add rows from uploaded (non-DB) sources not already covered by project
  for (const src of sources) {
    if (src.fromDb) continue;
    for (const row of src.rows) {
      const key = rowKey(row.varenr, row.beskrivelse);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rowDefs.push({ key, varenr: row.varenr.trim(), beskrivelse: row.beskrivelse, qty: 1, enhet: row.enhet, dimensjon: row.dimensjon, fromProject: false });
    }
  }

  return rowDefs.map(({ key, varenr, beskrivelse, qty, enhet, dimensjon, fromProject, internalPrice }) => {
    const cells: Record<string, number | undefined> = {};
    for (const src of sources) {
      const match = src.rows.find(r => rowKey(r.varenr, r.beskrivelse) === key);
      if (match) cells[src.id] = match.pris;
    }
    const sortedByPrice = sources
      .filter(s => cells[s.id] !== undefined)
      .sort((a, b) => (cells[a.id] ?? Infinity) - (cells[b.id] ?? Infinity));
    const ranks: Record<string, number> = {};
    sortedByPrice.forEach((s, i) => { ranks[s.id] = i + 1; });
    return { varenr, beskrivelse, qty, enhet, dimensjon, cells, ranks, internalPrice, fromProject };
  });
}

// Merge sources by supplier name: uploaded prices override DB prices per varenr.
// Sources with the same name are collapsed into one effective source.
function mergeEffectiveSources(sources: Source[]): Source[] {
  const byName = new Map<string, { db?: Source; uploads: Source[] }>();
  for (const src of sources) {
    if (!byName.has(src.name)) byName.set(src.name, { uploads: [] });
    const entry = byName.get(src.name)!;
    if (src.fromDb) entry.db = src;
    else entry.uploads.push(src);
  }

  const result: Source[] = [];
  for (const [name, { db, uploads }] of byName) {
    if (uploads.length === 0) {
      if (db) result.push(db);
      continue;
    }
    // Merge all uploads (last write wins per varenr)
    const uploadMap = new Map<string, PriceRow>();
    for (const src of uploads) {
      for (const row of src.rows) uploadMap.set(row.varenr.trim().toLowerCase(), row);
    }
    const uploadedRows = Array.from(uploadMap.values());

    if (!db) {
      const last = uploads[uploads.length - 1];
      result.push({ ...last, name, rows: uploadedRows });
    } else {
      // Uploaded takes priority; DB fills in varenrs not in uploaded file
      const uploadedKeys = new Set(uploadMap.keys());
      const dbFallback = db.rows.filter(r => !uploadedKeys.has(r.varenr.trim().toLowerCase()));
      result.push({ id: `merged-${name}`, name, rows: [...uploadedRows, ...dbFallback], hasUpload: true });
    }
  }
  return result;
}

// ── Component ──────────────────────────────────────────────────────────────

function PrissammenlignInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Dynamic supplier list from DB + registry
  const [dbSuppliers, setDbSuppliers] = useState<string[]>([]);

  // Project
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const pendingProjectId = searchParams.get("project");

  // DB suppliers
  const [dbSelected, setDbSelected] = useState<Record<string, boolean>>({});
  const [dbLoading, setDbLoading] = useState<string[]>([]);
  const [sources, setSources] = useState<Source[]>([]);

  // File upload
  const [showUpload, setShowUpload] = useState(false);
  const [pendingName, setPendingName] = useState("");
  const [pending, setPending] = useState<PendingUpload | null>(null);
  const [pdfUploading, setPdfUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Table
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "diff" | "missing">("all");

  // Wizard after upload — sourceId set when re-linking an existing committed source
  const [wizardSource, setWizardSource] = useState<{ name: string; rows: PriceRow[]; sourceId?: string } | null>(null);

  // Apply modal
  const [applySource, setApplySource] = useState<Source | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{ updatedCount: number; missedCount: number } | null>(null);

  // Manual row ordering
  const [manualMode, setManualMode] = useState(false);
  const [rowOrder, setRowOrder] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => setIsAdmin(d.isAdmin ?? false))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/prissammenligner/suppliers")
      .then(r => r.json())
      .then(d => {
        const list: string[] = d.suppliers ?? [];
        setDbSuppliers(list);
        if (list.length > 0) setPendingName(prev => prev || list[0]);
      })
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setProjectsLoading(true);
    fetch("/api/admin/prissammenligner/projects")
      .then(r => r.json())
      .then(d => setProjectList(d.data ?? []))
      .catch(() => {})
      .finally(() => setProjectsLoading(false));
  }, [isAdmin]);

  // When project changes, clear sources and re-fetch selected DB suppliers
  // Auto-select project from URL param once project list is loaded
  useEffect(() => {
    if (!pendingProjectId || !projectList.length || selectedProject) return;
    const found = projectList.find(p => p.id === pendingProjectId);
    if (found) selectProject(found);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingProjectId, projectList]);

  function selectProject(project: ProjectSummary) {
    setSelectedProject(project);
    setShowProjectPicker(false);
    setProjectSearch("");
    setSources([]);
    const selected = Object.entries(dbSelected).filter(([, v]) => v).map(([k]) => k);
    for (const sup of selected) {
      fetchDbSupplier(sup, project.line_items.map(i => i.varenr));
    }
  }

  const applyToQuote = useCallback(async (source: Source) => {
    if (!selectedProject) return;
    setApplying(true);
    try {
      const items = source.rows.map(r => ({ varenr: r.varenr, unitPrice: r.pris }));
      const res = await fetch("/api/admin/prissammenligner/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: selectedProject.id, supplierName: source.name, items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Feil");
      setApplyResult({ updatedCount: json.updatedCount, missedCount: json.missedCount });
    } catch (err) {
      alert(`Feil: ${err instanceof Error ? err.message : "Ukjent feil"}`);
      setApplySource(null);
    } finally {
      setApplying(false);
    }
  }, [selectedProject]);

  async function fetchDbSupplier(supplier: string, varenrs?: string[]) {
    const project = selectedProject;
    const effectiveVarenrs = varenrs ?? project?.line_items.map(i => i.varenr) ?? [];
    if (effectiveVarenrs.length === 0) return;
    setDbLoading(prev => [...prev, supplier]);
    try {
      const params = new URLSearchParams({
        suppliers: supplier,
        varenrs: effectiveVarenrs.join(","),
      });
      const res = await fetch(`/api/admin/prissammenligner?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Feil");
      const rows: PriceRow[] = (json.data ?? []).map((r: { varenr: string; varebenevnelse: string; dimensjon?: string; enhet?: string; nettopris: number }) => ({
        varenr: r.varenr ?? "",
        beskrivelse: r.varebenevnelse ?? "",
        dimensjon: r.dimensjon,
        enhet: r.enhet,
        pris: Number(r.nettopris ?? 0),
      })).filter((r: PriceRow) => r.varenr && r.pris > 0);
      setSources(prev => [...prev.filter(s => s.id !== `db-${supplier}`), { id: `db-${supplier}`, name: supplier, rows, fromDb: true }]);
    } catch (err) {
      alert(`Feil ved henting av priser for ${supplier}: ${err instanceof Error ? err.message : "Ukjent feil"}`);
    } finally {
      setDbLoading(prev => prev.filter(s => s !== supplier));
    }
  }

  function toggleDbSupplier(supplier: string, checked: boolean) {
    setDbSelected(prev => ({ ...prev, [supplier]: checked }));
    if (checked) {
      if (selectedProject) fetchDbSupplier(supplier);
    } else {
      setSources(prev => prev.filter(s => s.id !== `db-${supplier}`));
    }
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const name = pendingName || file.name.replace(/\.[^.]+$/, "");

    if (file.name.toLowerCase().endsWith(".pdf")) {
      // Send to server for extraction
      setPdfUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/admin/prissammenligner/pdf", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Feil");
        const pdfRows: PriceRow[] = json.rows ?? [];
        // Show as column-mapping-less preview (already parsed)
        setPending({
          name,
          headers: ["varenr", "beskrivelse", "pris", "enhet"],
          previewRows: pdfRows.slice(0, 5).map(r => ({ varenr: r.varenr, beskrivelse: r.beskrivelse, pris: String(r.pris), enhet: r.enhet ?? "" })),
          colMap: { varenr: "varenr", beskrivelse: "beskrivelse", pris: "pris" },
          rawRows: [],
          isPdf: true,
          pdfRows,
        });
        if (!pendingName) setPendingName(name);
      } catch (err) {
        alert(`Kunne ikke lese PDF: ${err instanceof Error ? err.message : "Ukjent feil"}`);
      } finally {
        setPdfUploading(false);
      }
    } else {
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
        setPending({ name, headers, previewRows: rows.slice(0, 5), colMap, rawRows: rows });
        if (!pendingName) setPendingName(name);
      } catch {
        alert("Kunne ikke lese filen. Støtter .xlsx, .xls, .csv, .txt, .pdf");
      }
    }
  }

  function closeWizard() {
    setWizardSource(null);
    setPending(null);
    setPendingName(dbSuppliers[0] ?? "");
    setShowUpload(false);
  }

  function commitUpload() {
    if (!pending) return;
    const rows = pending.isPdf
      ? (pending.pdfRows ?? [])
      : applyColumnMap(pending.rawRows, pending.colMap);
    if (rows.length === 0) {
      alert("Ingen gyldige rader funnet. Sjekk kolonnetilordning.");
      return;
    }
    setWizardSource({ name: pending.name || "Ukjent", rows });
  }

  function openWizardForSource(source: Source) {
    // Only rows that haven't been linked to a GPV varenr yet
    const unlinked = source.rows.filter(r => !r.varenr.startsWith("GPV-"));
    if (unlinked.length === 0) return;
    setWizardSource({ name: source.name, rows: unlinked, sourceId: source.id });
  }

  function handleWizardDone(results: WizardResult[]) {
    if (!wizardSource) return;
    const indexMap = new Map(results.map(r => [r.itemIndex, r.gp_varenr]));
    const translatedRows = wizardSource.rows.map((r, idx) => ({
      ...r,
      varenr: indexMap.get(idx) ?? r.varenr,
    }));

    if (wizardSource.sourceId) {
      // Merge translated rows back into the existing source
      setSources(prev => prev.map(s => {
        if (s.id !== wizardSource.sourceId) return s;
        // Build a lookup of wizard rows by original varenr+description key
        const wizardKeySet = new Set(
          wizardSource.rows.map(r => rowKey(r.varenr, r.beskrivelse))
        );
        const kept = s.rows.filter(r => !wizardKeySet.has(rowKey(r.varenr, r.beskrivelse)));
        return { ...s, rows: [...kept, ...translatedRows] };
      }));
      closeWizard();
    } else {
      // New upload — add as a new source
      setSources(prev => [...prev, { id: `upload-${Date.now()}`, name: wizardSource.name, rows: translatedRows }]);
      closeWizard();
    }
  }

  function removeSource(id: string) {
    setSources(prev => prev.filter(s => s.id !== id));
    const sup = id.startsWith("db-") ? id.slice(3) : null;
    if (sup) setDbSelected(prev => ({ ...prev, [sup]: false }));
  }

  const projectItems = selectedProject?.line_items ?? [];
  // Merge sources by name so uploaded quotes override DB prices
  const effectiveSources = useMemo(() => mergeEffectiveSources(sources), [sources]);
  const comparison = useMemo(() => buildComparison(projectItems, effectiveSources), [projectItems, effectiveSources]);

  const filtered = useMemo(() => comparison.filter(row => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!row.varenr.toLowerCase().includes(q) && !row.beskrivelse.toLowerCase().includes(q)) return false;
    }
    if (filter === "diff") {
      const prices = effectiveSources.map(s => row.cells[s.id]).filter((p): p is number => p !== undefined);
      if (prices.length < 2) return false;
      return Math.max(...prices) - Math.min(...prices) > 0.01;
    }
    if (filter === "missing") {
      return effectiveSources.some(s => row.cells[s.id] === undefined);
    }
    return true;
  }), [comparison, searchQuery, filter, effectiveSources]);

  // Per-supplier totals (unit price × qty) — only project items count toward totals
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const row of comparison) {
      if (!row.fromProject) continue;
      for (const src of effectiveSources) {
        const p = row.cells[src.id];
        if (p !== undefined) t[src.id] = (t[src.id] ?? 0) + p * row.qty;
      }
    }
    return t;
  }, [comparison, effectiveSources]);

  // Fast lookup for manual mode
  const comparisonMap = useMemo(() => {
    const m = new Map<string, ComparisonRow>();
    for (const row of comparison) m.set(rowKey(row.varenr, row.beskrivelse), row);
    return m;
  }, [comparison]);

  // Sync manual order when comparison changes (add new keys at end, drop removed)
  useEffect(() => {
    if (!manualMode) return;
    const existingKeys = new Set(rowOrder);
    const allKeys = comparison.map(r => rowKey(r.varenr, r.beskrivelse));
    const newKeys = allKeys.filter(k => !existingKeys.has(k));
    const validKeys = rowOrder.filter(k => comparisonMap.has(k));
    if (newKeys.length > 0 || validKeys.length !== rowOrder.length) {
      setRowOrder([...validKeys, ...newKeys]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparison, manualMode]);

  function enterManualMode() {
    setRowOrder(comparison.map(r => rowKey(r.varenr, r.beskrivelse)));
    setManualMode(true);
  }

  function moveRow(key: string, dir: "up" | "down") {
    setRowOrder(prev => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const newIdx = dir === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }

  // A row is "confident" if it carries a GPV-catalog varenr (wizard-linked or DB-matched)
  function isConfident(row: ComparisonRow): boolean {
    return row.varenr.startsWith("GPV-");
  }

  // Rows to render: manual order (with filter applied) or default filtered
  const displayRows = useMemo(() => {
    if (!manualMode) return filtered;
    const applyFilter = (r: ComparisonRow) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!r.varenr.toLowerCase().includes(q) && !r.beskrivelse.toLowerCase().includes(q)) return false;
      }
      if (filter === "diff") {
        const prices = effectiveSources.map(s => r.cells[s.id]).filter((p): p is number => p !== undefined);
        if (prices.length < 2) return false;
        return Math.max(...prices) - Math.min(...prices) > 0.01;
      }
      if (filter === "missing") return effectiveSources.some(s => r.cells[s.id] === undefined);
      return true;
    };
    return rowOrder.map(k => comparisonMap.get(k)).filter((r): r is ComparisonRow => !!r && applyFilter(r));
  }, [manualMode, rowOrder, comparisonMap, filtered, searchQuery, filter, effectiveSources]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.toLowerCase();
    return q
      ? projectList.filter(p => p.ticket_number.toLowerCase().includes(q) || p.customer_name.toLowerCase().includes(q))
      : projectList;
  }, [projectList, projectSearch]);

  const cheapestTotal = effectiveSources.length > 1
    ? Math.min(...effectiveSources.map(s => totals[s.id] ?? Infinity).filter(v => v < Infinity))
    : null;

  if (isAdmin === null) {
    return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Du må være innlogget som admin.</p>
        <Link href="/admin" className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600">Gå til admin</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Admin</Link>
          <h1 className="text-xl font-bold text-gray-900">Prissammenligner</h1>
          {selectedProject && (
            <Link
              href={`/admin/quotes/${selectedProject.id}`}
              className="ml-auto rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100"
            >
              ← Tilbake til {selectedProject.ticket_number}
            </Link>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px,1fr]">

          {/* ── Left panel ── */}
          <div className="space-y-4">

            {/* Project picker */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Velg prosjekt</h2>

              {selectedProject ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                    <p className="text-sm font-semibold text-orange-800">{selectedProject.ticket_number}</p>
                    <p className="text-xs text-orange-700">{selectedProject.customer_name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {selectedProject.varenr_count} varer med varenr
                    </p>
                  </div>
                  <button
                    onClick={() => setShowProjectPicker(p => !p)}
                    className="text-xs text-orange-500 hover:underline"
                  >
                    Bytt prosjekt
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowProjectPicker(true)}
                  className="w-full rounded-lg border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors"
                >
                  {projectsLoading ? "Laster prosjekter…" : "Velg prosjekt →"}
                </button>
              )}

              {/* Project list */}
              {showProjectPicker && (
                <div className="mt-3 space-y-2">
                  <input
                    type="text"
                    placeholder="Søk ticket eller kunde…"
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                    autoFocus
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                  />
                  <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-gray-100 bg-gray-50 p-1">
                    {filteredProjects.length === 0 && (
                      <p className="py-4 text-center text-xs text-gray-400">Ingen prosjekter funnet</p>
                    )}
                    {filteredProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => selectProject(p)}
                        className="w-full rounded-lg px-3 py-2 text-left hover:bg-white hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-semibold text-gray-700">{p.ticket_number}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${p.varenr_count > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {p.varenr_count} varer
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{p.customer_name}</p>
                        <p className="text-[10px] text-gray-400">{new Date(p.created_at).toLocaleDateString("nb-NO")}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* DB suppliers */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Leverandørpriser (database)</h2>
              {!selectedProject && (
                <p className="text-xs text-gray-400 mb-2">Velg prosjekt først</p>
              )}
              <div className="space-y-2">
                {dbSuppliers.length === 0 && (
                  <p className="text-xs text-gray-400 animate-pulse">Laster leverandører…</p>
                )}
                {dbSuppliers.map(sup => {
                  const loaded = sources.some(s => s.id === `db-${sup}`);
                  const loading = dbLoading.includes(sup);
                  const count = sources.find(s => s.id === `db-${sup}`)?.rows.length;
                  return (
                    <label key={sup} className={`flex items-center gap-2.5 cursor-pointer select-none ${!selectedProject ? "opacity-40 pointer-events-none" : ""}`}>
                      <input
                        type="checkbox"
                        checked={dbSelected[sup] ?? false}
                        onChange={e => toggleDbSupplier(sup, e.target.checked)}
                        disabled={!selectedProject}
                        className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                      />
                      <span className="text-sm text-gray-700">{sup}</span>
                      {loading && <span className="text-xs text-gray-400 animate-pulse">laster…</span>}
                      {!loading && loaded && (
                        <span className="text-xs text-green-600">{count} treff</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* File upload */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">Last opp tilbud</h2>
                <button
                  onClick={() => setShowUpload(p => !p)}
                  className="rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-600 hover:bg-orange-100"
                >
                  + Legg til
                </button>
              </div>

              {sources.filter(s => !s.fromDb).length === 0 && (
                <p className="text-xs text-gray-400">Ingen tilbud lastet opp.</p>
              )}
              <div className="space-y-2">
                {sources.filter(s => !s.fromDb).map(s => {
                  const unlinkedCount = s.rows.filter(r => !r.varenr.startsWith("GPV-")).length;
                  return (
                    <div key={s.id} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-700">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.rows.length} varer{unlinkedCount > 0 ? ` · ${unlinkedCount} ukoblet` : ""}</p>
                        </div>
                        <button onClick={() => removeSource(s.id)} className="shrink-0 text-gray-300 hover:text-red-500 text-xs">✕</button>
                      </div>
                      {unlinkedCount > 0 && (
                        <button
                          onClick={() => openWizardForSource(s)}
                          className="mt-1.5 w-full rounded-md bg-blue-50 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100"
                        >
                          Knytt {unlinkedCount} varenr →
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {showUpload && (
                <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Leverandørnavn</label>
                    <select
                      value={pendingName}
                      onChange={e => setPendingName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                    >
                      {dbSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt,.pdf"
                    className="hidden"
                    onChange={handleFileChosen}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={pdfUploading}
                    className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:border-orange-400 hover:text-orange-500 disabled:opacity-50"
                  >
                    {pdfUploading ? "Analyserer PDF…" : "Velg fil (.xlsx, .csv, .txt, .pdf)"}
                  </button>
                </div>
              )}
            </div>

            {/* Stats + Velg tilbud */}
            {comparison.length > 0 && effectiveSources.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm text-sm space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Totalpris (mengde × enhetspris)</p>
                {effectiveSources.map(s => {
                  const total = totals[s.id];
                  const isCheapest = cheapestTotal !== null && total === cheapestTotal;
                  return (
                    <div key={s.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`truncate font-medium ${isCheapest ? "text-green-700" : "text-gray-700"}`}>{s.name}</span>
                          {s.hasUpload && <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-semibold text-orange-600">tilbud</span>}
                        </div>
                        <span className={`font-semibold tabular-nums ${isCheapest ? "text-green-700" : "text-gray-800"}`}>
                          {total !== undefined ? formatPrice(total) : "—"}
                        </span>
                      </div>
                      {selectedProject && (
                        <button
                          onClick={() => { setApplySource(s); setApplyResult(null); }}
                          className={`w-full rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                            isCheapest
                              ? "border-green-400 bg-green-50 text-green-700 hover:bg-green-100"
                              : "border-gray-200 text-gray-500 hover:border-orange-300 hover:text-orange-600"
                          }`}
                        >
                          {isCheapest ? "✓ Velg dette tilbudet" : "Velg dette tilbudet"}
                        </button>
                      )}
                    </div>
                  );
                })}
                {cheapestTotal !== null && effectiveSources.length > 1 && (() => {
                  const maxTotal = Math.max(...effectiveSources.map(s => totals[s.id] ?? 0));
                  const diff = maxTotal - cheapestTotal;
                  return diff > 0 ? (
                    <div className="border-t border-gray-100 pt-2 text-xs text-orange-600 font-medium">
                      Maks besparelse: {formatPrice(diff)} ({((diff / maxTotal) * 100).toFixed(1)}%)
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          <div className="space-y-4">

            {/* Column mapping */}
            {pending && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
                <h2 className="mb-1 text-sm font-semibold text-orange-800">
                  {pending.isPdf ? `PDF hentet: «${pending.name}»` : `Kolonnetilordning for «${pending.name}»`}
                </h2>
                {pending.isPdf ? (
                  <p className="mb-4 text-xs text-orange-600">
                    {pending.pdfRows?.length ?? 0} rader automatisk gjenkjent fra PDF.
                  </p>
                ) : (
                  <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {(["varenr", "beskrivelse", "pris", "enhet", "dimensjon"] as const).map(field => (
                      <div key={field}>
                        <label className="block text-xs font-medium text-orange-700 mb-1">
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
                )}

                <div className="overflow-x-auto rounded-lg border border-orange-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-orange-100">
                      <tr>
                        {["Varenr", "Beskrivelse", "Pris", "Enhet"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-orange-700">{h}</th>
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
                    onClick={() => { setPending(null); setPendingName(dbSuppliers[0] ?? ""); }}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!selectedProject && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-white p-16 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="mt-4 text-sm font-medium text-gray-500">Velg et prosjekt til venstre</p>
                <p className="mt-1 text-xs text-gray-400">Sammenligningen viser kun varer med varenr fra tilbudet.</p>
              </div>
            )}

            {/* Comparison table */}
            {selectedProject && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
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
                  <span className="text-xs text-gray-400">{filtered.length} / {comparison.length} varer</span>
                  {effectiveSources.length > 0 && comparison.length > 0 && (
                    <button
                      onClick={() => manualMode ? setManualMode(false) : enterManualMode()}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        manualMode
                          ? "bg-blue-600 text-white hover:bg-blue-700"
                          : "border border-gray-200 text-gray-500 hover:border-blue-300 hover:text-blue-600"
                      }`}
                    >
                      {manualMode ? "✓ Avslutt sortering" : "Sorter manuelt"}
                    </button>
                  )}
                </div>
                {manualMode && (
                  <div className="flex items-center gap-3 border-b border-blue-100 bg-blue-50 px-4 py-2 text-xs text-blue-700">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" />
                    <span>GPV-varenr match — låst</span>
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400 ml-3" />
                    <span>Usikker match — kan flyttes</span>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs">
                      <tr>
                        {manualMode && <th className="w-10 px-1 py-3" />}
                        <th className="sticky left-0 z-10 bg-gray-50 px-3 py-3 text-left font-medium text-gray-500 min-w-[90px]">Varenr</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-500 min-w-[200px]">Beskrivelse</th>
                        <th className="px-3 py-3 text-right font-medium text-gray-500 min-w-[50px]">Mengde</th>
                        <th className="px-3 py-3 text-left font-medium text-gray-500">Enhet</th>
                        {effectiveSources.map(s => (
                          <th key={s.id} className="px-3 py-3 text-right font-medium text-gray-700 min-w-[120px] whitespace-nowrap">
                            <span>{s.name}</span>
                            {s.hasUpload
                              ? <span className="ml-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-semibold text-orange-600">tilbud</span>
                              : <span className="ml-1 text-[9px] font-normal text-gray-400">DB</span>}
                          </th>
                        ))}
                        {effectiveSources.length > 0 && (
                          <th className="px-3 py-3 text-right font-medium text-gray-500 min-w-[100px]">Billigst total</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {effectiveSources.length === 0 && comparison.length > 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-sm text-gray-400">
                            Velg leverandører eller last opp tilbud for å sammenligne priser
                          </td>
                        </tr>
                      )}
                      {displayRows.length === 0 && effectiveSources.length > 0 && (
                        <tr>
                          <td colSpan={5 + effectiveSources.length + (manualMode ? 1 : 0)} className="py-8 text-center text-sm text-gray-400">
                            Ingen varer funnet
                          </td>
                        </tr>
                      )}
                      {displayRows.map((row, rowIdx) => {
                        const presentPrices = effectiveSources
                          .map(s => row.cells[s.id])
                          .filter((p): p is number => p !== undefined);
                        const minUnitPrice = presentPrices.length ? Math.min(...presentPrices) : null;
                        const cheapestTotal = minUnitPrice !== null ? minUnitPrice * row.qty : null;
                        const key = rowKey(row.varenr, row.beskrivelse);
                        const confident = isConfident(row);

                        return (
                          <tr key={key} className={`hover:bg-gray-50/50 ${!row.fromProject ? "bg-blue-50/30 italic" : ""} ${manualMode && !confident ? "bg-yellow-50/30" : ""}`}>
                            {manualMode && (
                              <td className="px-1 py-2 text-center">
                                {confident ? (
                                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" title="GPV-varenr match — låst" />
                                ) : (
                                  <div className="flex flex-col items-center gap-0.5">
                                    <button
                                      onClick={() => moveRow(key, "up")}
                                      disabled={rowIdx === 0}
                                      className="leading-none text-gray-400 hover:text-blue-600 disabled:opacity-20"
                                      title="Flytt opp"
                                    >▲</button>
                                    <button
                                      onClick={() => moveRow(key, "down")}
                                      disabled={rowIdx === displayRows.length - 1}
                                      className="leading-none text-gray-400 hover:text-blue-600 disabled:opacity-20"
                                      title="Flytt ned"
                                    >▼</button>
                                  </div>
                                )}
                              </td>
                            )}
                            <td className="sticky left-0 z-10 bg-white px-3 py-2.5 font-mono text-xs text-gray-500">
                              <div className="flex items-center gap-1.5">
                                {row.varenr || <span className="text-gray-300 not-italic">—</span>}
                                {manualMode && (
                                  <span
                                    className={`inline-block h-2 w-2 rounded-full shrink-0 ${confident ? "bg-green-400" : "bg-yellow-400"}`}
                                    title={confident ? "100% GPV-match" : "Usikker match"}
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-gray-800">
                              <span className="line-clamp-2 text-xs">{row.beskrivelse}</span>
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{row.fromProject ? row.qty : <span className="text-gray-300 not-italic">—</span>}</td>
                            <td className="px-3 py-2.5 text-xs text-gray-400">{row.enhet ?? ""}</td>
                            {effectiveSources.map(s => {
                              const pris = row.cells[s.id];
                              const rank = row.ranks[s.id];
                              const isCheapest = rank === 1 && presentPrices.length > 1;
                              return (
                                <td key={s.id} className="px-3 py-2.5 text-right">
                                  {pris === undefined ? (
                                    <span className="text-gray-200">—</span>
                                  ) : (
                                    <div className={`inline-flex flex-col items-end ${isCheapest ? "text-green-700" : "text-gray-700"}`}>
                                      <span className="inline-flex items-center gap-1">
                                        {presentPrices.length > 1 && rank !== undefined && (
                                          <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold ${RANK_COLORS[rank] ?? "bg-gray-100 text-gray-500 border-gray-300"}`}>
                                            {rank}
                                          </span>
                                        )}
                                        <span className={`text-xs tabular-nums ${isCheapest ? "font-semibold" : ""}`}>{formatPrice(pris)}</span>
                                      </span>
                                      {row.qty > 1 && (
                                        <span className="text-[10px] tabular-nums text-gray-400">= {formatPrice(pris * row.qty)}</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            {effectiveSources.length > 0 && (
                              <td className="px-3 py-2.5 text-right text-xs tabular-nums text-green-700 font-medium">
                                {cheapestTotal !== null ? formatPrice(cheapestTotal) : <span className="text-gray-200">—</span>}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {/* Totals row */}
                      {effectiveSources.length > 0 && comparison.length > 0 && (
                        <tr className="bg-gray-50 font-semibold text-sm border-t-2 border-gray-200">
                          {manualMode && <td />}
                          <td className="sticky left-0 bg-gray-50 px-3 py-3 text-gray-700" colSpan={3}>Totalt</td>
                          <td />
                          {effectiveSources.map(s => {
                            const total = totals[s.id];
                            const isCheapest = cheapestTotal !== null && total === cheapestTotal;
                            return (
                              <td key={s.id} className={`px-3 py-3 text-right tabular-nums ${isCheapest ? "text-green-700" : "text-gray-700"}`}>
                                {total !== undefined ? formatPrice(total) : "—"}
                              </td>
                            );
                          })}
                          <td className="px-3 py-3 text-right tabular-nums text-green-700">
                            {cheapestTotal !== null ? formatPrice(cheapestTotal) : "—"}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Catalog link wizard after upload */}
      {wizardSource && (
        <CatalogLinkWizard
          supplier={wizardSource.name}
          items={wizardSource.rows.map(r => ({ varenr: r.varenr, name: r.beskrivelse, dimensjon: r.dimensjon, enhet: r.enhet, nettopris: r.pris }))}
          onDone={handleWizardDone}
          onCancel={() => {
            if (wizardSource.sourceId) {
              // Re-linking existing source — just close, don't touch source rows
              closeWizard();
            } else {
              // New upload — commit as-is without any translations
              setSources(prev => [...prev, { id: `upload-${Date.now()}`, name: wizardSource.name, rows: wizardSource.rows }]);
              closeWizard();
            }
          }}
          cancelLabel={wizardSource.sourceId ? "Lukk" : "Hopp over – last opp uten kobling"}
        />
      )}

      {/* Apply modal */}
      {applySource && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            {applyResult ? (
              <>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-gray-900">Tilbud overført!</h2>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium text-green-700">{applyResult.updatedCount} varer</span> ble oppdatert med priser fra {applySource.name}.
                  {applyResult.missedCount > 0 && (
                    <span className="text-orange-600"> {applyResult.missedCount} varer mangler varenr-treff og beholdt sin pris.</span>
                  )}
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => router.push(`/admin/quotes/${selectedProject.id}`)}
                    className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
                  >
                    Gå til tilbudet →
                  </button>
                  <button
                    onClick={() => { setApplySource(null); setApplyResult(null); }}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50"
                  >
                    Lukk
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold text-gray-900">Overfør tilbud til prosjekt?</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Priser fra <span className="font-medium">{applySource.name}</span> vil bli satt på
                  alle varer med varenr-treff i <span className="font-medium">{selectedProject.ticket_number} – {selectedProject.customer_name}</span>.
                </p>
                <div className="mt-3 rounded-lg bg-gray-50 p-3 text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Leverandør</span>
                    <span className="font-medium text-gray-700">{applySource.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Varer tilgjengelig</span>
                    <span className="font-medium text-gray-700">{applySource.rows.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Prosjektvarer med varenr</span>
                    <span className="font-medium text-gray-700">{selectedProject.varenr_count}</span>
                  </div>
                  {totals[applySource.id] !== undefined && (
                    <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                      <span>Estimert totalsum</span>
                      <span className="font-semibold text-gray-900">{formatPrice(totals[applySource.id])}</span>
                    </div>
                  )}
                </div>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => applyToQuote(applySource)}
                    disabled={applying}
                    className="flex-1 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {applying ? "Overfører…" : "Overfør priser"}
                  </button>
                  <button
                    onClick={() => setApplySource(null)}
                    disabled={applying}
                    className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Avbryt
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PrissammenlignPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-400">Laster…</div>}>
      <PrissammenlignInner />
    </Suspense>
  );
}
