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

interface SavedComparisonState {
  dbSelected?: Record<string, boolean>;
  manualAssignments?: ManualAssignment[];
  priceOverrides?: Record<string, number>;
  extraRows?: ExtraRow[];
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
  antall?: number;
}

interface Source {
  id: string;
  name: string;
  rows: PriceRow[];
  fromDb?: boolean;
  hasUpload?: boolean; // merged source where an uploaded quote overrides DB
}

interface ExtraRow {
  id: string;
  varenr: string;
  beskrivelse: string;
  qty: number;
  enhet?: string;
}

interface ComparisonRow {
  varenr: string;
  beskrivelse: string;
  qty: number;
  enhet?: string;
  dimensjon?: string;
  cells: Record<string, number | undefined>; // sourceId -> unit price
  ranks: Record<string, number>; // 1 = cheapest
  internalPrice?: number;
  fromProject: boolean;
  isExtra?: boolean;
  extraRowId?: string;
  fromReserve?: Record<string, boolean>; // sourceId -> true if filled from reserve assignment
  supplierQty?: Record<string, number | undefined>; // sourceId -> quantity from supplier's uploaded offer
}

interface ColumnMap {
  varenr: string;
  beskrivelse: string;
  pris: string;
  enhet?: string;
  dimensjon?: string;
  antall?: string;
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
    antall: find("antall", "qty", "quantity", "mengde", "antal"),
  };
}

function applyColumnMap(rows: Record<string, string>[], colMap: ColumnMap): PriceRow[] {
  const result: PriceRow[] = [];
  for (const row of rows) {
    const varenr = (row[colMap.varenr] ?? "").trim();
    const pris = parseNumber(row[colMap.pris] ?? "");
    if (!varenr || isNaN(pris) || pris <= 0) continue;
    const antallRaw = colMap.antall ? parseNumber(row[colMap.antall] ?? "") : NaN;
    result.push({
      varenr,
      beskrivelse: (row[colMap.beskrivelse] ?? "").trim(),
      enhet: colMap.enhet ? (row[colMap.enhet] ?? "").trim() || undefined : undefined,
      dimensjon: colMap.dimensjon ? (row[colMap.dimensjon] ?? "").trim() || undefined : undefined,
      antall: !isNaN(antallRaw) && antallRaw > 0 ? antallRaw : undefined,
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

interface ManualAssignment {
  projectRowKey: string;  // key of the project row this reserve item is assigned to
  sourceId: string;       // which source (supplier) it comes from
  reserveVarenr: string;  // the supplier varenr from reserve
  reservePris: number;
  reserveBeskrivelse: string;
  reserveDimensjon?: string;
}

// Project items are always the anchor — their order is fixed.
// Supplier items not matching any project item go to reserve (handled separately).
function buildComparison(
  projectItems: ProjectLineItem[],
  extraItems: ExtraRow[],
  sources: Source[],
  manualAssignments: ManualAssignment[],
): ComparisonRow[] {
  const seen = new Set<string>();
  const rowDefs: { key: string; varenr: string; beskrivelse: string; qty: number; enhet?: string; dimensjon?: string; internalPrice?: number; isExtra?: boolean; extraRowId?: string }[] = [];

  for (const item of projectItems) {
    const key = rowKey(item.varenr, item.description);
    if (seen.has(key)) continue;
    seen.add(key);
    rowDefs.push({ key, varenr: item.varenr.trim(), beskrivelse: item.description, qty: item.quantity ?? 1, enhet: item.enhet, dimensjon: item.dimensjon, internalPrice: item.amount });
  }
  for (const item of extraItems) {
    const key = rowKey(item.varenr, item.beskrivelse);
    if (seen.has(key)) continue;
    seen.add(key);
    rowDefs.push({ key, varenr: item.varenr.trim(), beskrivelse: item.beskrivelse, qty: item.qty, enhet: item.enhet, isExtra: true, extraRowId: item.id });
  }

  return rowDefs.map(({ key, varenr, beskrivelse, qty, enhet, dimensjon, internalPrice, isExtra, extraRowId }) => {
    const cells: Record<string, number | undefined> = {};
    // Track which cells come from manual reserve assignments (for visual indicator)
    const fromReserve: Record<string, boolean> = {};
    const supplierQty: Record<string, number | undefined> = {};

    for (const src of sources) {
      // 1. Exact match by varenr key
      const match = src.rows.find(r => rowKey(r.varenr, r.beskrivelse) === key);
      if (match) {
        cells[src.id] = match.pris;
        if (match.antall != null) supplierQty[src.id] = match.antall;
        continue;
      }
      // 2. Manual reserve assignment
      const manual = manualAssignments.find(a => a.projectRowKey === key && a.sourceId === src.id);
      if (manual) { cells[src.id] = manual.reservePris; fromReserve[src.id] = true; }
    }
    const sortedByPrice = sources
      .filter(s => cells[s.id] !== undefined)
      .sort((a, b) => (cells[a.id] ?? Infinity) - (cells[b.id] ?? Infinity));
    const ranks: Record<string, number> = {};
    sortedByPrice.forEach((s, i) => { ranks[s.id] = i + 1; });
    return { varenr, beskrivelse, qty, enhet, dimensjon, cells, ranks, internalPrice, fromProject: true, isExtra, extraRowId, fromReserve, supplierQty };
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

  // Save comparison state to Supabase
  const [savingState, setSavingState] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveStateError, setSaveStateError] = useState(false);

  // Save uploaded source rows to price DB
  const [savingSource, setSavingSource] = useState<string | null>(null);
  const [savedSourceResult, setSavedSourceResult] = useState<Record<string, { ok: boolean; count: number }>>({});

  // Save quote items to price DB
  const [saveToDb, setSaveToDb] = useState(false);
  const [savingToDb, setSavingToDb] = useState(false);
  const [saveToDbSupplier, setSaveToDbSupplier] = useState("");
  const [saveToDbResult, setSaveToDbResult] = useState<{ ok: boolean; count: number } | null>(null);

  // Manual price overrides: key = `${rowKey}|${sourceId}`, value = unit price
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const [editingCell, setEditingCell] = useState<{ rowKey: string; sourceId: string } | null>(null);
  const [cellEditUnit, setCellEditUnit] = useState("");
  const [cellEditTotal, setCellEditTotal] = useState("");

  // Catalog picker for varenr editing
  const [varenrPicker, setVarenrPicker] = useState<{ rowKey: string; currentVarenr: string; beskrivelse: string } | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("");
  const [catalogProducts, setCatalogProducts] = useState<Array<{ id: string; varenr: string; name: string; unit?: string }>>([]);
  const [catalogCategories, setCatalogCategories] = useState<Array<{ id: string; label: string }>>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Reserve assignment
  const [manualAssignments, setManualAssignments] = useState<ManualAssignment[]>([]);
  const [assignPicker, setAssignPicker] = useState<{ projectRowKey: string; sourceId: string } | null>(null);
  const [showReserve, setShowReserve] = useState(true);

  // Manually added rows
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([]);
  const [editingExtraCell, setEditingExtraCell] = useState<{ id: string; field: "varenr" | "beskrivelse" | "qty" | "enhet" } | null>(null);

  // Reserve section: link-to-row picker
  const [reserveLinkPicker, setReserveLinkPicker] = useState<{ sourceId: string; row: PriceRow } | null>(null);

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

  // Persist comparison state per project
  useEffect(() => {
    if (!selectedProject) return;
    try {
      localStorage.setItem(`pris_state_${selectedProject.id}`, JSON.stringify({ dbSelected, manualAssignments, priceOverrides, extraRows }));
    } catch { /* non-fatal */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.id, dbSelected, manualAssignments, priceOverrides, extraRows]);

  useEffect(() => {
    if (!varenrPicker) return;
    if (catalogCategories.length === 0) {
      fetch("/api/admin/katalog/kategorier")
        .then(r => r.json())
        .then(d => setCatalogCategories(d.data ?? []))
        .catch(() => {});
    }
    setCatalogLoading(true);
    const params = new URLSearchParams({ limit: "50" });
    if (catalogSearch.trim()) params.set("q", catalogSearch.trim());
    if (catalogCategory) params.set("category", catalogCategory);
    const timer = setTimeout(() => {
      fetch(`/api/admin/katalog?${params}`)
        .then(r => r.json())
        .then(d => setCatalogProducts(d.data ?? []))
        .catch(() => {})
        .finally(() => setCatalogLoading(false));
    }, catalogSearch ? 250 : 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [varenrPicker, catalogSearch, catalogCategory]);

  async function selectProject(project: ProjectSummary) {
    setSelectedProject(project);
    setShowProjectPicker(false);
    setProjectSearch("");
    setSources([]);
    setManualAssignments([]);
    setLastSaved(null);
    setSaveStateError(false);
    setExtraRows([]);
    setPriceOverrides({});

    // Try Supabase first; fall back to localStorage
    let saved: SavedComparisonState | null = null;
    try {
      const res = await fetch(`/api/admin/prissammenligner/state?quoteId=${project.id}`);
      const d = await res.json() as { state: SavedComparisonState | null };
      saved = d.state;
    } catch { /* ignore */ }
    if (!saved) {
      try {
        const raw = localStorage.getItem(`pris_state_${project.id}`);
        if (raw) saved = JSON.parse(raw) as SavedComparisonState;
      } catch { /* ignore */ }
    }

    let effectiveDbSelected = dbSelected;
    let effectiveExtraRows: ExtraRow[] = [];
    if (saved) {
      if (saved.dbSelected && typeof saved.dbSelected === "object") {
        effectiveDbSelected = saved.dbSelected;
        setDbSelected(saved.dbSelected);
      }
      if (Array.isArray(saved.manualAssignments)) setManualAssignments(saved.manualAssignments);
      if (saved.priceOverrides && typeof saved.priceOverrides === "object") setPriceOverrides(saved.priceOverrides);
      if (Array.isArray(saved.extraRows)) {
        effectiveExtraRows = saved.extraRows;
        setExtraRows(saved.extraRows);
      }
    }

    const allVarenrs = [
      ...project.line_items.map(i => i.varenr),
      ...effectiveExtraRows.map(r => r.varenr).filter(Boolean),
    ];
    const selected = Object.entries(effectiveDbSelected).filter(([, v]) => v).map(([k]) => k);
    for (const sup of selected) {
      fetchDbSupplier(sup, allVarenrs);
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

  async function saveQuoteItemsToDb() {
    if (!selectedProject) return;
    const supplier = saveToDbSupplier || dbSuppliers[0];
    if (!supplier) return;
    setSavingToDb(true);
    setSaveToDbResult(null);
    try {
      const eligible = selectedProject.line_items.filter(i => i.varenr?.trim() && i.amount !== undefined && i.amount > 0);
      const rows = eligible.map(i => ({
        varenr: i.varenr.trim(),
        varebenevnelse: i.description || "",
        dimensjon: i.dimensjon ?? "",
        enhet: i.enhet ?? "",
        bruttopris: i.amount!,
        nettopris: i.amount!,
        antall: 1,
        mva_pst: 25,
      }));
      const res = await fetch("/api/admin/supplier-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier, rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Feil");
      setSaveToDbResult({ ok: true, count: json.inserted });
    } catch {
      setSaveToDbResult({ ok: false, count: 0 });
    } finally {
      setSavingToDb(false);
    }
  }

  async function saveComparisonState() {
    if (!selectedProject) return;
    setSavingState(true);
    setSaveStateError(false);
    try {
      const state: SavedComparisonState = { dbSelected, manualAssignments, priceOverrides, extraRows };
      const res = await fetch("/api/admin/prissammenligner/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: selectedProject.id, state }),
      });
      if (!res.ok) throw new Error();
      setLastSaved(new Date());
    } catch {
      setSaveStateError(true);
    } finally {
      setSavingState(false);
    }
  }

  async function saveSourceToDb(source: Source) {
    const supplier = source.name;
    setSavingSource(source.id);
    setSavedSourceResult(prev => { const next = { ...prev }; delete next[source.id]; return next; });
    try {
      const rows = source.rows.map(r => ({
        varenr: r.varenr.trim(),
        varebenevnelse: r.beskrivelse || "",
        dimensjon: r.dimensjon ?? "",
        enhet: r.enhet ?? "",
        bruttopris: r.pris,
        nettopris: r.pris,
        antall: r.antall ?? 1,
        mva_pst: 25,
      }));
      const res = await fetch("/api/admin/supplier-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier, rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Feil");
      setSavedSourceResult((prev: Record<string, { ok: boolean; count: number }>) => ({ ...prev, [source.id]: { ok: true, count: json.inserted } }));
    } catch {
      setSavedSourceResult((prev: Record<string, { ok: boolean; count: number }>) => ({ ...prev, [source.id]: { ok: false, count: 0 } }));
    } finally {
      setSavingSource(null);
    }
  }

  const projectItems = selectedProject?.line_items ?? [];
  const effectiveSources = useMemo(() => mergeEffectiveSources(sources), [sources]);
  const comparison = useMemo(() => buildComparison(projectItems, extraRows, effectiveSources, manualAssignments), [projectItems, extraRows, effectiveSources, manualAssignments]);

  // Apply manual price overrides on top of DB/upload prices, then re-rank
  const effectiveComparison = useMemo(() => {
    if (Object.keys(priceOverrides).length === 0) return comparison;
    return comparison.map((row: ComparisonRow) => {
      const rKey = rowKey(row.varenr, row.beskrivelse);
      const cells: Record<string, number | undefined> = { ...row.cells };
      for (const src of effectiveSources) {
        const ov = priceOverrides[`${rKey}|${src.id}`];
        if (ov !== undefined) cells[src.id] = ov;
      }
      const sorted = effectiveSources
        .filter((s: Source) => cells[s.id] !== undefined)
        .sort((a: Source, b: Source) => (cells[a.id] ?? Infinity) - (cells[b.id] ?? Infinity));
      const ranks: Record<string, number> = {};
      sorted.forEach((s: Source, i: number) => { ranks[s.id] = i + 1; });
      return { ...row, cells, ranks };
    });
  }, [comparison, priceOverrides, effectiveSources]);

  // Reserve: supplier rows that don't match any project item
  const reserveBySource = useMemo(() => {
    const projectKeys = new Set([
      ...projectItems.map((i: ProjectLineItem) => rowKey(i.varenr, i.description)),
      ...extraRows.map((r: ExtraRow) => rowKey(r.varenr, r.beskrivelse)),
    ]);
    const result: Record<string, Array<PriceRow & { assignedTo?: string }>> = {};
    for (const src of effectiveSources) {
      const rows = src.rows
        .filter(r => !projectKeys.has(rowKey(r.varenr, r.beskrivelse)))
        .map(r => ({
          ...r,
          assignedTo: manualAssignments.find(a => a.sourceId === src.id && a.reserveVarenr === r.varenr)?.projectRowKey,
        }));
      if (rows.length > 0) result[src.id] = rows;
    }
    return result;
  }, [effectiveSources, projectItems, extraRows, manualAssignments]);

  const totalReserveCount = Object.values(reserveBySource).reduce((s, arr) => s + arr.length, 0);

  function assignReserve(projectRowKey: string, sourceId: string, row: PriceRow) {
    setManualAssignments(prev => {
      const filtered = prev.filter(a => !(a.projectRowKey === projectRowKey && a.sourceId === sourceId));
      return [...filtered, { projectRowKey, sourceId, reserveVarenr: row.varenr, reservePris: row.pris, reserveBeskrivelse: row.beskrivelse, reserveDimensjon: row.dimensjon }];
    });
    setAssignPicker(null);
  }

  function removeAssignment(projectRowKey: string, sourceId: string) {
    setManualAssignments(prev => prev.filter(a => !(a.projectRowKey === projectRowKey && a.sourceId === sourceId)));
  }

  function openCellEdit(rKey: string, sourceId: string, currentPris: number | undefined, qty: number) {
    const u = currentPris ?? 0;
    setCellEditUnit(u > 0 ? u.toFixed(2) : "");
    setCellEditTotal(u > 0 && qty > 0 ? (u * qty).toFixed(2) : "");
    setEditingCell({ rowKey: rKey, sourceId });
  }

  function saveCellEdit(rKey: string, sourceId: string) {
    const u = parseFloat(cellEditUnit);
    if (!isNaN(u) && u > 0) {
      setPriceOverrides((prev: Record<string, number>) => ({ ...prev, [`${rKey}|${sourceId}`]: u }));
    } else {
      setPriceOverrides((prev: Record<string, number>) => {
        const next = { ...prev };
        delete next[`${rKey}|${sourceId}`];
        return next;
      });
    }
    setEditingCell(null);
  }

  async function selectVarenrFromCatalog(product: { varenr: string }) {
    if (!varenrPicker || !selectedProject) return;
    const oldVarenr = varenrPicker.currentVarenr;
    const newVarenr = product.varenr;
    setVarenrPicker(null);
    if (newVarenr === oldVarenr) return;
    try {
      const res = await fetch("/api/admin/prissammenligner/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: selectedProject.id, oldVarenr, newVarenr }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Feil");
      const newVarenrs = selectedProject.line_items.map((i: ProjectLineItem) => i.varenr === oldVarenr ? newVarenr : i.varenr);
      setSelectedProject((prev: ProjectSummary | null) => prev ? {
        ...prev,
        line_items: prev.line_items.map((i: ProjectLineItem) => i.varenr === oldVarenr ? { ...i, varenr: newVarenr } : i),
      } : null);
      for (const [sup, checked] of Object.entries(dbSelected)) {
        if (checked) fetchDbSupplier(sup, newVarenrs);
      }
    } catch (err) {
      alert(`Kunne ikke lagre varenr: ${err instanceof Error ? err.message : "Ukjent feil"}`);
    }
  }

  const filtered = useMemo(() => effectiveComparison.filter((row: ComparisonRow) => {
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
  }), [effectiveComparison, searchQuery, filter, effectiveSources]);

  // Per-supplier totals — uses supplier's quoted antall × pris when available,
  // otherwise falls back to project qty × pris
  const totals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const row of effectiveComparison) {
      if (!row.fromProject) continue;
      for (const src of effectiveSources) {
        const p = row.cells[src.id];
        if (p === undefined) continue;
        const supQty = (row.supplierQty as Record<string, number | undefined> | undefined)?.[src.id];
        t[src.id] = (t[src.id] ?? 0) + (supQty !== undefined ? supQty * p : p * row.qty);
      }
    }
    return t;
  }, [effectiveComparison, effectiveSources]);

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

            {/* Save comparison state */}
            {selectedProject && (
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={saveComparisonState}
                  disabled={savingState}
                  className="flex-1 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors"
                >
                  {savingState ? "Lagrer…" : "Lagre sammenligning"}
                </button>
                {lastSaved && !saveStateError && (
                  <span className="text-[10px] text-green-600 whitespace-nowrap">✓ {lastSaved.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" })}</span>
                )}
                {saveStateError && (
                  <span className="text-[10px] text-red-500 whitespace-nowrap">Feil!</span>
                )}
              </div>
            )}

            {/* Save quote items to price DB */}
            {selectedProject && (() => {
              const withVarenr = selectedProject.line_items.filter(i => i.varenr?.trim());
              if (withVarenr.length === 0) return null;
              const withPrice = withVarenr.filter(i => i.amount !== undefined && i.amount > 0);
              const sup = saveToDbSupplier || dbSuppliers[0] || "";
              return (
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <h2 className="mb-1 text-sm font-semibold text-gray-700">Lagre tilbudspriser til database</h2>
                  <p className="mb-3 text-xs text-gray-400">
                    {withVarenr.length} varer med varenr
                    {withPrice.length < withVarenr.length && ` · ${withPrice.length} har pris satt`}
                  </p>
                  {saveToDb ? (
                    <div className="space-y-2">
                      <select
                        value={sup}
                        onChange={e => setSaveToDbSupplier(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-orange-400 focus:outline-none"
                      >
                        {dbSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={saveQuoteItemsToDb}
                          disabled={savingToDb || !sup || withPrice.length === 0}
                          className="flex-1 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                        >
                          {savingToDb ? "Lagrer…" : withPrice.length === 0 ? "Ingen priser satt" : `Lagre ${withPrice.length} varer`}
                        </button>
                        <button
                          onClick={() => { setSaveToDb(false); setSaveToDbResult(null); }}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                        >
                          Avbryt
                        </button>
                      </div>
                      {saveToDbResult && (
                        <p className={`text-xs font-medium ${saveToDbResult.ok ? "text-green-600" : "text-red-500"}`}>
                          {saveToDbResult.ok ? `✓ ${saveToDbResult.count} varer lagret til ${sup}` : "Feil ved lagring"}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setSaveToDb(true); setSaveToDbResult(null); }}
                      className="w-full rounded-lg border border-dashed border-orange-300 py-2 text-xs text-orange-600 hover:border-orange-500 hover:bg-orange-50 transition-colors"
                    >
                      Lagre varenr + priser til database →
                    </button>
                  )}
                </div>
              );
            })()}

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
                      <button
                        onClick={() => saveSourceToDb(s)}
                        disabled={savingSource === s.id}
                        className="mt-1.5 w-full rounded-md bg-green-50 py-1 text-xs font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        {savingSource === s.id ? "Lagrer…" : "Lagre til prisdatabase"}
                      </button>
                      {savedSourceResult[s.id] && (
                        <p className={`mt-1 text-[10px] font-medium text-center ${savedSourceResult[s.id].ok ? "text-green-600" : "text-red-500"}`}>
                          {savedSourceResult[s.id].ok ? `✓ ${savedSourceResult[s.id].count} varer lagret` : "Feil ved lagring"}
                        </p>
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
                    {(["varenr", "beskrivelse", "pris", "enhet", "dimensjon", "antall"] as const).map(field => (
                      <div key={field}>
                        <label className="block text-xs font-medium text-orange-700 mb-1">
                          {field === "pris" ? "Nettopris *" : field === "varenr" ? "Varenr *" : field === "beskrivelse" ? "Beskrivelse *" : field === "antall" ? "Antall" : field}
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
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-xs">
                      <tr>
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
                      {filtered.length === 0 && effectiveSources.length > 0 && (
                        <tr>
                          <td colSpan={5 + effectiveSources.length} className="py-8 text-center text-sm text-gray-400">
                            Ingen varer funnet
                          </td>
                        </tr>
                      )}
                      {filtered.map(row => {
                        const presentPrices = effectiveSources
                          .map(s => row.cells[s.id])
                          .filter((p): p is number => p !== undefined);
                        const minUnitPrice = presentPrices.length ? Math.min(...presentPrices) : null;
                        // Cheapest line total uses supplier antall if available, else project qty
                        const cheapestTotal = (() => {
                          if (minUnitPrice === null) return null;
                          const lineTotals = effectiveSources
                            .map(s => {
                              const p = row.cells[s.id];
                              if (p === undefined) return Infinity;
                              const supQty = row.supplierQty?.[s.id];
                              return supQty !== undefined ? supQty * p : p * row.qty;
                            })
                            .filter(v => v < Infinity);
                          return lineTotals.length ? Math.min(...lineTotals) : null;
                        })();
                        const key = rowKey(row.varenr, row.beskrivelse);

                        return (
                          <tr key={key} className={`hover:bg-gray-50/50 ${row.isExtra ? "bg-blue-50/30" : ""}`}>
                            <td className="sticky left-0 z-10 bg-white px-3 py-2.5 font-mono text-xs text-gray-500">
                              {row.isExtra ? (
                                <input
                                  type="text"
                                  value={row.varenr}
                                  placeholder="Varenr"
                                  onChange={(e: { target: { value: string } }) => setExtraRows((prev: ExtraRow[]) => prev.map((r: ExtraRow) => r.id === row.extraRowId ? { ...r, varenr: e.target.value } : r))}
                                  className="w-20 rounded border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-xs focus:border-blue-400 focus:outline-none"
                                />
                              ) : (
                                <button
                                  className="group flex items-center gap-1 text-left font-mono text-xs text-gray-500 hover:text-orange-500"
                                  title="Klikk for å endre varenr fra katalogen"
                                  onClick={() => { setVarenrPicker({ rowKey: key, currentVarenr: row.varenr, beskrivelse: row.beskrivelse }); setCatalogSearch(""); setCatalogCategory(""); setCatalogProducts([]); }}
                                >
                                  <span>{row.varenr || <span className="text-gray-300 italic">legg til</span>}</span>
                                  <span className="hidden group-hover:inline text-[10px] text-orange-400">✎</span>
                                </button>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-gray-800">
                              {row.isExtra ? (
                                <input
                                  type="text"
                                  value={row.beskrivelse}
                                  placeholder="Beskrivelse"
                                  onChange={(e: { target: { value: string } }) => setExtraRows((prev: ExtraRow[]) => prev.map((r: ExtraRow) => r.id === row.extraRowId ? { ...r, beskrivelse: e.target.value } : r))}
                                  className="w-full rounded border border-blue-200 bg-white px-1.5 py-0.5 text-xs focus:border-blue-400 focus:outline-none"
                                />
                              ) : (
                                <span className="line-clamp-2 text-xs">{row.beskrivelse}</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                              {row.isExtra ? (
                                <input
                                  type="number" min={1} step={1}
                                  value={row.qty}
                                  onChange={(e: { target: { value: string } }) => setExtraRows((prev: ExtraRow[]) => prev.map((r: ExtraRow) => r.id === row.extraRowId ? { ...r, qty: parseFloat(e.target.value) || 1 } : r))}
                                  className="w-14 rounded border border-blue-200 bg-white px-1 py-0.5 text-right text-xs focus:border-blue-400 focus:outline-none"
                                />
                              ) : row.fromProject ? row.qty : <span className="text-gray-300 not-italic">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-gray-400">{row.enhet ?? ""}</td>
                            {effectiveSources.map(s => {
                              const pris = row.cells[s.id];
                              const rank = row.ranks[s.id];
                              const isCheapest = rank === 1 && presentPrices.length > 1;
                              const isReserve = row.fromReserve?.[s.id] ?? false;
                              const hasReserveRows = (reserveBySource[s.id]?.length ?? 0) > 0;
                              const pickingThis = assignPicker?.projectRowKey === key && assignPicker?.sourceId === s.id;

                              const isEditing = editingCell?.rowKey === key && editingCell?.sourceId === s.id;
                              const isOverridden = priceOverrides[`${key}|${s.id}`] !== undefined;

                              return (
                                <td key={s.id} className="px-3 py-2.5 text-right relative">
                                  {isEditing ? (
                                    /* ── Edit mode ── */
                                    <div className="space-y-1 py-0.5 min-w-[96px]">
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-[9px] text-gray-400">kr/enhet</span>
                                        <input
                                          autoFocus
                                          type="number" min={0} step={0.01}
                                          value={cellEditUnit}
                                          onChange={e => {
                                            setCellEditUnit(e.target.value);
                                            const u = parseFloat(e.target.value);
                                            if (!isNaN(u)) setCellEditTotal((u * row.qty).toFixed(2));
                                          }}
                                          onKeyDown={e => {
                                            if (e.key === "Enter") saveCellEdit(key, s.id);
                                            if (e.key === "Escape") setEditingCell(null);
                                          }}
                                          className="w-20 rounded border border-orange-400 px-1 py-0.5 text-xs text-right focus:outline-none"
                                        />
                                      </div>
                                      {row.qty > 1 && (
                                        <div className="flex items-center justify-end gap-1">
                                          <span className="text-[9px] text-gray-400">total×{row.qty}</span>
                                          <input
                                            type="number" min={0} step={0.01}
                                            value={cellEditTotal}
                                            onChange={e => {
                                              setCellEditTotal(e.target.value);
                                              const t = parseFloat(e.target.value);
                                              if (!isNaN(t) && row.qty > 0) setCellEditUnit((t / row.qty).toFixed(2));
                                            }}
                                            onKeyDown={e => {
                                              if (e.key === "Enter") saveCellEdit(key, s.id);
                                              if (e.key === "Escape") setEditingCell(null);
                                            }}
                                            className="w-20 rounded border border-orange-300 px-1 py-0.5 text-xs text-right focus:outline-none"
                                          />
                                        </div>
                                      )}
                                      <div className="flex justify-end gap-2">
                                        <button onClick={() => saveCellEdit(key, s.id)} className="text-[10px] font-semibold text-orange-500 hover:text-orange-700">✓ Lagre</button>
                                        <button onClick={() => setEditingCell(null)} className="text-[10px] text-gray-400 hover:text-gray-600">Avbryt</button>
                                      </div>
                                    </div>
                                  ) : pris === undefined ? (
                                    /* ── No price: reserve picker + manual entry ── */
                                    <div className="flex flex-col items-end gap-0.5">
                                      {hasReserveRows && (
                                        <div className="relative inline-block">
                                          <button
                                            onClick={() => setAssignPicker(pickingThis ? null : { projectRowKey: key, sourceId: s.id })}
                                            className="rounded border border-dashed border-blue-300 px-2 py-0.5 text-[11px] text-blue-500 hover:bg-blue-50"
                                          >
                                            + reserve
                                          </button>
                                          {pickingThis && (
                                            <div className="absolute right-0 top-7 z-30 w-72 rounded-xl border border-blue-200 bg-white shadow-xl">
                                              <p className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-700">Velg reservevare fra {s.name}</p>
                                              <div className="max-h-52 overflow-y-auto">
                                                {(reserveBySource[s.id] ?? []).map(r => (
                                                  <button
                                                    key={r.varenr}
                                                    onClick={() => assignReserve(key, s.id, r)}
                                                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-blue-50 border-b border-gray-50 last:border-0"
                                                  >
                                                    <div className="flex items-center justify-between gap-2">
                                                      <span className="font-mono text-[10px] text-gray-500">{r.varenr}</span>
                                                      <span className="text-xs font-semibold text-gray-800">{formatPrice(r.pris)}</span>
                                                    </div>
                                                    <span className="truncate text-[11px] text-gray-600">{[r.beskrivelse, r.dimensjon].filter(Boolean).join(" ")}</span>
                                                    {r.assignedTo && <span className="text-[10px] text-orange-500">↳ allerede tilknyttet annen rad</span>}
                                                  </button>
                                                ))}
                                              </div>
                                              <button onClick={() => setAssignPicker(null)} className="w-full border-t border-gray-100 py-1.5 text-xs text-gray-400 hover:bg-gray-50">Avbryt</button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      <button
                                        onClick={() => openCellEdit(key, s.id, undefined, row.qty)}
                                        className="text-[10px] text-orange-400 hover:text-orange-600 hover:underline"
                                      >+ pris</button>
                                    </div>
                                  ) : (
                                    /* ── Has price: display + click to edit ── */
                                    <div
                                      className={`group/pris inline-flex flex-col items-end cursor-pointer rounded px-1 -mx-1 hover:bg-orange-50 transition-colors ${isCheapest ? "text-green-700" : "text-gray-700"}`}
                                      onClick={() => openCellEdit(key, s.id, pris, row.qty)}
                                      title="Klikk for å endre pris"
                                    >
                                      <span className="inline-flex items-center gap-1">
                                        {presentPrices.length > 1 && rank !== undefined && (
                                          <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-bold ${RANK_COLORS[rank] ?? "bg-gray-100 text-gray-500 border-gray-300"}`}>
                                            {rank}
                                          </span>
                                        )}
                                        <span className={`text-xs tabular-nums ${isCheapest ? "font-semibold" : ""}`}>{formatPrice(pris)}</span>
                                        {isReserve && (
                                          <button
                                            onClick={e => { e.stopPropagation(); removeAssignment(key, s.id); }}
                                            title="Fjern reservetilknytning"
                                            className="ml-0.5 text-[10px] text-yellow-500 hover:text-red-500"
                                          >~</button>
                                        )}
                                        <span className="hidden group-hover/pris:inline text-[9px] text-orange-400">✎</span>
                                      </span>
                                      {isReserve && <span className="text-[9px] text-yellow-600 italic">reserve</span>}
                                      {isOverridden && <span className="text-[9px] text-orange-500 italic">manuell</span>}
                                      {(() => {
                                        const supQty = (row.supplierQty as Record<string, number | undefined> | undefined)?.[s.id];
                                        if (supQty !== undefined && supQty !== row.qty) {
                                          return (
                                            <>
                                              <span className="text-[10px] tabular-nums font-semibold text-purple-600">= {formatPrice(supQty * pris)}</span>
                                              <span className="text-[9px] tabular-nums text-purple-400" title={`Leverandøren tilbyr ${supQty} ${row.enhet ?? ""} — prosjektet trenger ${row.qty}`}>Lev: {supQty} / Proj: {row.qty}</span>
                                            </>
                                          );
                                        }
                                        return row.qty > 1 ? (
                                          <span className="text-[10px] tabular-nums text-gray-400">= {formatPrice(pris * row.qty)}</span>
                                        ) : null;
                                      })()}
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
                            {row.isExtra && (
                              <td className="px-2 py-2.5">
                                <button
                                  onClick={() => setExtraRows((prev: ExtraRow[]) => prev.filter((r: ExtraRow) => r.id !== row.extraRowId))}
                                  className="text-gray-300 hover:text-red-500 text-xs transition-colors"
                                  title="Fjern linje"
                                >✕</button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                      {/* Add row button */}
                      <tr>
                        <td colSpan={4 + effectiveSources.length + (effectiveSources.length > 0 ? 1 : 0)} className="px-3 py-2">
                          <button
                            onClick={() => setExtraRows((prev: ExtraRow[]) => [...prev, { id: `extra-${Date.now()}`, varenr: "", beskrivelse: "", qty: 1 }])}
                            className="text-xs text-blue-500 hover:text-blue-700 hover:underline"
                          >
                            + Legg til linje
                          </button>
                        </td>
                      </tr>
                      {/* Totals row */}
                      {effectiveSources.length > 0 && effectiveComparison.length > 0 && (
                        <tr className="bg-gray-50 font-semibold text-sm border-t-2 border-gray-200">
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

            {/* ── Reserve section ─────────────────────────────────────── */}
            {totalReserveCount > 0 && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 shadow-sm">
                <button
                  onClick={() => setShowReserve(v => !v)}
                  className="flex w-full items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-yellow-800">Reserve — varer uten prosjektmatch</span>
                    <span className="rounded-full bg-yellow-200 px-2 py-0.5 text-xs font-bold text-yellow-800">{totalReserveCount}</span>
                  </div>
                  <span className={`text-yellow-600 text-xs transition-transform ${showReserve ? "rotate-180" : ""}`}>▾</span>
                </button>

                {showReserve && (
                  <div className="border-t border-yellow-200 px-4 pb-4 pt-2 space-y-4">
                    <p className="text-xs text-yellow-700">
                      Disse varene fra leverandøren matcher ikke noe prosjektvarenr. Trykk <strong>+ reserve</strong> på en tom celle i tabellen over for å tilknytte en reservevare til en prosjektrad for sammenligning.
                    </p>
                    {effectiveSources.map(src => {
                      const rows = reserveBySource[src.id];
                      if (!rows?.length) return null;
                      return (
                        <div key={src.id}>
                          <p className="mb-2 text-xs font-semibold text-yellow-800">{src.name} ({rows.length})</p>
                          <div className="overflow-x-auto rounded-lg border border-yellow-200 bg-white">
                            <table className="min-w-full text-xs">
                              <thead className="bg-yellow-50 text-[10px] text-yellow-700">
                                <tr>
                                  <th className="px-3 py-2 text-left font-medium">Varenr</th>
                                  <th className="px-3 py-2 text-left font-medium">Beskrivelse</th>
                                  <th className="px-3 py-2 text-left font-medium">Dimensjon</th>
                                  <th className="px-3 py-2 text-right font-medium">Nettopris</th>
                                  <th className="px-3 py-2 text-left font-medium">Tilknyttet rad</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-yellow-50">
                                {rows.map(r => {
                                  const isLinking = reserveLinkPicker?.sourceId === src.id && reserveLinkPicker?.row.varenr === r.varenr;
                                  return (
                                    <tr key={r.varenr} className={r.assignedTo ? "bg-orange-50" : "hover:bg-yellow-50/50"}>
                                      <td className="px-3 py-2 font-mono text-gray-600">{r.varenr}</td>
                                      <td className="px-3 py-2 text-gray-700 max-w-[180px] truncate">{r.beskrivelse}</td>
                                      <td className="px-3 py-2 text-gray-400">{r.dimensjon ?? "—"}</td>
                                      <td className="px-3 py-2 text-right font-semibold text-gray-800">{formatPrice(r.pris)}</td>
                                      <td className="px-3 py-2 min-w-[220px]">
                                        {r.assignedTo ? (
                                          <div className="flex items-center gap-2">
                                            <span className="rounded bg-orange-100 px-1.5 py-0.5 font-mono text-[10px] text-orange-700">{r.assignedTo}</span>
                                            <button
                                              onClick={() => {
                                                const a = manualAssignments.find(a => a.sourceId === src.id && a.reserveVarenr === r.varenr);
                                                if (a) removeAssignment(a.projectRowKey, src.id);
                                              }}
                                              className="text-[10px] text-red-400 hover:text-red-600"
                                            >Fjern</button>
                                          </div>
                                        ) : isLinking ? (
                                          <div className="space-y-1">
                                            <p className="text-[10px] font-medium text-gray-600">Velg rad å knytte til:</p>
                                            <div className="max-h-40 overflow-y-auto rounded border border-yellow-200 bg-white">
                                              {effectiveComparison.map(compRow => (
                                                <button
                                                  key={rowKey(compRow.varenr, compRow.beskrivelse)}
                                                  onClick={() => {
                                                    assignReserve(rowKey(compRow.varenr, compRow.beskrivelse), src.id, r);
                                                    setReserveLinkPicker(null);
                                                  }}
                                                  className="flex w-full items-center justify-between gap-2 border-b border-gray-50 px-2 py-1.5 text-left last:border-0 hover:bg-orange-50"
                                                >
                                                  <span className="font-mono text-[10px] text-gray-500 shrink-0">{compRow.varenr || "—"}</span>
                                                  <span className="truncate text-[11px] text-gray-700">{compRow.beskrivelse}</span>
                                                </button>
                                              ))}
                                            </div>
                                            <button onClick={() => setReserveLinkPicker(null)} className="text-[10px] text-gray-400 hover:text-gray-600">Avbryt</button>
                                          </div>
                                        ) : (
                                          <div className="flex flex-wrap gap-1.5">
                                            <button
                                              onClick={() => setReserveLinkPicker({ sourceId: src.id, row: r })}
                                              className="rounded border border-orange-200 bg-orange-50 px-2 py-0.5 text-[11px] text-orange-600 hover:bg-orange-100"
                                            >
                                              Knytt til rad →
                                            </button>
                                            <button
                                              onClick={() => setExtraRows((prev: ExtraRow[]) => [...prev, {
                                                id: `extra-${Date.now()}`,
                                                varenr: r.varenr,
                                                beskrivelse: r.beskrivelse,
                                                qty: r.antall ?? 1,
                                                enhet: r.enhet,
                                              }])}
                                              className="rounded border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600 hover:bg-blue-100"
                                            >
                                              + Ny rad
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Close picker on outside click */}
      {assignPicker && (
        <div className="fixed inset-0 z-20" onClick={() => setAssignPicker(null)} />
      )}

      {/* Catalog link wizard after upload */}
      {wizardSource && (
        <CatalogLinkWizard
          supplier={wizardSource.name}
          items={wizardSource.rows.map(r => ({ varenr: r.varenr, name: r.beskrivelse, dimensjon: r.dimensjon, enhet: r.enhet, nettopris: r.pris, antall: r.antall }))}
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

      {/* Catalog picker modal for varenr editing */}
      {varenrPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex w-full max-w-xl flex-col rounded-2xl bg-white shadow-2xl" style={{ maxHeight: "85vh" }}>

            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Endre varenr fra katalogen</h2>
                <p className="mt-0.5 text-xs text-gray-400 truncate max-w-xs">
                  {varenrPicker.beskrivelse}
                  {varenrPicker.currentVarenr && (
                    <span className="ml-2 font-mono text-orange-500">{varenrPicker.currentVarenr}</span>
                  )}
                </p>
              </div>
              <button onClick={() => setVarenrPicker(null)} className="shrink-0 text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            {/* Search + category filter */}
            <div className="space-y-2 border-b border-gray-100 px-5 py-3">
              <input
                type="text"
                placeholder="Søk på varenr eller navn…"
                value={catalogSearch}
                onChange={e => setCatalogSearch(e.target.value)}
                autoFocus
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none"
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setCatalogCategory("")}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${!catalogCategory ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >Alle</button>
                {catalogCategories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setCatalogCategory(cat.label === catalogCategory ? "" : cat.label)}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${catalogCategory === cat.label ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >{cat.label}</button>
                ))}
              </div>
            </div>

            {/* Product list */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {catalogLoading ? (
                <p className="py-8 text-center text-sm text-gray-400 animate-pulse">Laster…</p>
              ) : catalogProducts.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Ingen varer funnet</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {catalogProducts.map(p => (
                    <div key={p.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-orange-600">{p.varenr}</span>
                          {p.unit && <span className="text-xs text-gray-400">{p.unit}</span>}
                        </div>
                        <p className="text-sm text-gray-800">{p.name}</p>
                      </div>
                      <button
                        onClick={() => selectVarenrFromCatalog(p)}
                        className="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600"
                      >
                        Velg →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
