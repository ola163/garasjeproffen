"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { adminName } from "@/lib/admin-names";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];
const BUCKET = "soknadshjelp-attachments";

interface ExtraCost { description: string; amount: number }
interface ManualDisp { description: string; amount: number }
type ActivityEntry = { id: string; action_type: string; actor_email: string; payload: Record<string, unknown>; created_at: string };

interface SoknadshjelRow {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  address: string | null;
  dibk: Record<string, string> | null;
  garage_config: Record<string, unknown> | null;
  permit_result: string | null;
  permit_price: number | null;
  total_price: number | null;
  extra_costs: ExtraCost[] | null;
  manual_dispensasjoner: ManualDisp[] | null;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  lead_source: string | null;
  created_at: string;
}

const STATUS_OPTIONS = ["new", "in_review", "pending_approval", "offer_sent", "paid", "ferdigstilt", "cancelled"];
const STATUS_LABELS: Record<string, string> = {
  new: "Ny",
  in_review: "Under behandling",
  pending_approval: "Venter godkjenning",
  offer_sent: "Tilbud sendt",
  paid: "Betalt",
  ferdigstilt: "Ferdigstilt",
  cancelled: "Kansellert",
};
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  in_review: "bg-yellow-100 text-yellow-700",
  pending_approval: "bg-orange-100 text-orange-700",
  offer_sent: "bg-purple-100 text-purple-700",
  paid: "bg-green-100 text-green-700",
  ferdigstilt: "bg-teal-100 text-teal-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const DIBK_LABELS: Record<string, string> = {
  frittstående: "Frittstående bygg",
  bya50: "BYA under 50 m²",
  enEtasje: "Én etasje",
  monehoyde: "Mønehøyde OK",
  nabogrense: "Nabogrense OK",
  avstandBygg: "Avstand til bygg OK",
  ikkeVernet: "Ikke vernede omgivelser",
  ikkeFlom: "Ikke flomutsatt",
  lnf: "LNF-område",
  kjeller: "Kjeller",
};

const DISP_KEYS = ["frittstående", "bya50", "enEtasje", "monehoyde", "nabogrense", "avstandBygg", "ikkeVernet", "ikkeFlom"];

function isDispensasjon(key: string, value: string): boolean {
  if (key === "lnf") return value === "Ja";
  return DISP_KEYS.includes(key) && value === "Nei";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("nb-NO", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmt(n: number) {
  return n.toLocaleString("nb-NO") + " kr";
}

export default function SoknadshjelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [row, setRow] = useState<SoknadshjelRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  // Admin fields
  const [notes, setNotes] = useState("");
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [status, setStatus] = useState("new");
  const [assignedTo, setAssignedTo] = useState("");

  // Extra costs
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([]);
  const [newCostDesc, setNewCostDesc] = useState("");
  const [newCostAmount, setNewCostAmount] = useState("");

  // Manual dispensasjoner
  const [manualDisps, setManualDisps] = useState<ManualDisp[]>([]);
  const [newDispDesc, setNewDispDesc] = useState("");
  const [newDispAmount, setNewDispAmount] = useState("8000");

  const [leadSource, setLeadSource] = useState<string>("");
  const [localDibk, setLocalDibk] = useState<Record<string, string>>({});
  const [localDibkReasons, setLocalDibkReasons] = useState<Record<string, string>>({});
  const [localManualKeys, setLocalManualKeys] = useState<Set<string>>(new Set());
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

  // Attachments
  const [attachments, setAttachments] = useState<{ name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    Promise.all([
      supabase.from("soknadshjelp").select("*").eq("id", id).single(),
      supabase.from("activity_log").select("*").eq("entity_id", id).order("created_at", { ascending: false }),
      supabase.storage.from(BUCKET).list(id),
    ]).then(([{ data }, { data: actData }, { data: files }]) => {
      if (data) {
        setRow(data as SoknadshjelRow);
        setNotes(data.notes ?? "");
        setStatus(data.status ?? "new");
        setAssignedTo(data.assigned_to ?? "");
        setLeadSource(data.lead_source ?? "");
        setLocalDibk((data.dibk as Record<string, string>) ?? {});
        setExtraCosts(data.extra_costs ?? []);
        const md = data.manual_dispensasjoner ?? [];
        setManualDisps(md);
        const dibkCount = data.dibk
          ? Object.entries(data.dibk as Record<string, string>).filter(([k, v]) => isDispensasjon(k, v)).length
          : 0;
        setNewDispAmount(dibkCount > 0 || md.length > 0 ? "2000" : "8000");
      }
      if (actData) setActivityLog(actData as ActivityEntry[]);
      if (files) setAttachments(files.map((f) => ({ name: f.name })));
      setLoading(false);
    });
  }, [user, id]);

  function addExtraCost() {
    const amount = parseFloat(newCostAmount.replace(/\s/g, "").replace(",", "."));
    if (!newCostDesc.trim() || isNaN(amount)) return;
    setExtraCosts((prev) => [...prev, { description: newCostDesc.trim(), amount }]);
    setNewCostDesc("");
    setNewCostAmount("");
  }

  function removeExtraCost(i: number) {
    setExtraCosts((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addManualDisp() {
    const amount = parseFloat(newDispAmount.replace(/\s/g, "").replace(",", "."));
    if (!newDispDesc.trim() || isNaN(amount)) return;
    setManualDisps((prev) => [...prev, { description: newDispDesc.trim(), amount }]);
    setNewDispDesc("");
    setNewDispAmount("2000");
  }

  function removeManualDisp(i: number) {
    setManualDisps((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      const dibkCount = Object.entries(localDibk).filter(([k, v]) => isDispensasjon(k, v)).length;
      setNewDispAmount(dibkCount > 0 || next.length > 0 ? "2000" : "8000");
      return next;
    });
  }

  async function handleSaveNotes() {
    if (!supabase || !row) return;
    setSavingNotes(true);
    await supabase.from("soknadshjelp").update({ notes: notes || null }).eq("id", row.id);
    setRow((prev) => prev ? { ...prev, notes: notes || null } : null);
    setSavingNotes(false);
    setEditingNotes(false);
  }

  async function handleAddComment() {
    if (!supabase || !row || !newComment.trim()) return;
    setAddingComment(true);
    const text = newComment.trim();
    setNewComment("");
    const { data } = await supabase.from("activity_log").insert({
      entity_type: "soknadshjelp",
      entity_id: row.id,
      action_type: "comment",
      actor_email: user?.email ?? "ukjent",
      payload: { text },
    }).select().single();
    const entry: ActivityEntry = data
      ? (data as ActivityEntry)
      : { id: crypto.randomUUID(), action_type: "comment", actor_email: user?.email ?? "ukjent", payload: { text }, created_at: new Date().toISOString() };
    setActivityLog((prev) => [entry, ...prev]);
    setAddingComment(false);
  }

  async function uploadFile(file: File) {
    if (!supabase) return;
    setUploading(true);
    const path = `${id}/${file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (!error) setAttachments((prev) => [...prev.filter((a) => a.name !== file.name), { name: file.name }]);
    else console.error("Upload failed:", error);
    setUploading(false);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadFile(file);
  }

  async function downloadAttachment(name: string) {
    if (!supabase) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(`${id}/${name}`, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function deleteAttachment(name: string) {
    if (!supabase) return;
    await supabase.storage.from(BUCKET).remove([`${id}/${name}`]);
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  }

  async function handleSave() {
    if (!supabase || !row) return;
    setSaving(true);
    const newTotal = (row.permit_price ?? 0) + manualDisps.reduce((s, d) => s + d.amount, 0) + extraCosts.reduce((s, c) => s + c.amount, 0);

    const origDibk = row.dibk ?? {};
    const dibkChanges: { key: string; field: string; old_value: string; new_value: string; reason?: string }[] = [];
    Object.entries(localDibk).forEach(([k, v]) => {
      if (origDibk[k] !== v) {
        const reason = localDibkReasons[k]?.trim();
        dibkChanges.push({ key: k, field: DIBK_LABELS[k] ?? k, old_value: origDibk[k] ?? "", new_value: v, ...(reason ? { reason } : {}) });
      }
    });

    await supabase.from("soknadshjelp").update({
      status,
      assigned_to: assignedTo || null,
      extra_costs: extraCosts,
      manual_dispensasjoner: manualDisps,
      total_price: newTotal,
      lead_source: leadSource || null,
      dibk: localDibk,
    }).eq("id", row.id);

    if (status !== row.status) {
      const { data: statusEntry } = await supabase.from("activity_log").insert({
        entity_type: "soknadshjelp",
        entity_id: row.id,
        action_type: "status_change",
        actor_email: user?.email ?? "ukjent",
        payload: { from_status: row.status, to_status: status },
      }).select().single();
      if (statusEntry) setActivityLog((prev) => [statusEntry as ActivityEntry, ...prev]);
    }

    if (dibkChanges.length > 0) {
      const changedKeys = dibkChanges.map((c) => c.key);
      setLocalManualKeys((prev) => new Set([...prev, ...changedKeys]));
      const newEntries: ActivityEntry[] = [];
      for (const change of dibkChanges) {
        const { data: logEntry, error: logErr } = await supabase.from("activity_log").insert({
          entity_type: "soknadshjelp",
          entity_id: row.id,
          action_type: "dibk_edit",
          actor_email: user?.email ?? "ukjent",
          payload: change,
        }).select().single();
        if (logErr) console.error("activity_log insert failed:", logErr);
        if (logEntry) newEntries.push(logEntry as ActivityEntry);
      }
      if (newEntries.length > 0) setActivityLog((prev) => [...newEntries.reverse(), ...prev]);
    }

    setRow((prev) => prev ? { ...prev, dibk: localDibk, lead_source: leadSource || null, status, assigned_to: assignedTo || null } : null);
    setLocalDibkReasons({});
    setSaving(false);
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2500);
  }

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster...</div>;
  if (!supabase) return <div className="flex min-h-screen items-center justify-center text-gray-500">Supabase ikke konfigurert.</div>;

  if (!user) { router.push("/admin/quotes"); return null; }

  if (!ALLOWED_ADMINS.includes(user.email?.toLowerCase() ?? "")) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-600">Du har ikke tilgang.</p></div>;
  }

  if (!row) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Forespørsel ikke funnet.</p></div>;
  }

  const gc = row.garage_config as { lengthMm?: number; widthMm?: number; doorWidthMm?: number; doorHeightMm?: number } | null;
  const dibkDispCount = Object.entries(localDibk).filter(([k, v]) => isDispensasjon(k, v)).length;
  const changedDibkKeys = Object.entries(localDibk)
    .filter(([k, v]) => (row.dibk ?? {})[k] !== v)
    .map(([k]) => k);
  const dibkReasonsMissing = changedDibkKeys.some((k) => !localDibkReasons[k]?.trim());
  const hasChanges =
    (status !== row.status ||
    assignedTo !== (row.assigned_to ?? "") ||
    leadSource !== (row.lead_source ?? "") ||
    changedDibkKeys.length > 0 ||
    JSON.stringify(extraCosts) !== JSON.stringify(row.extra_costs ?? []) ||
    JSON.stringify(manualDisps) !== JSON.stringify(row.manual_dispensasjoner ?? [])) &&
    !dibkReasonsMissing;

  const manuallyChangedKeys = new Set<string>();
  activityLog
    .filter((e) => e.action_type === "dibk_edit")
    .forEach((e) => {
      const p = e.payload as { key?: string; field?: string };
      if (p.key) manuallyChangedKeys.add(p.key);
      else if (p.field) {
        const found = Object.entries(DIBK_LABELS).find(([, label]) => label === p.field)?.[0];
        if (found) manuallyChangedKeys.add(found);
      }
    });

  const totalDispCount = dibkDispCount + manualDisps.length;
  const computedTotal = (row.permit_price ?? 0) + manualDisps.reduce((s, d) => s + d.amount, 0) + extraCosts.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/quotes" className="text-sm text-orange-600 hover:text-orange-800">← Forespørsler</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{row.ticket_number}</h1>
            <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">Søknadshjelp</span>
            {totalDispCount > 0 && (
              <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                {totalDispCount} dispensasjon{totalDispCount > 1 ? "er" : ""}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-400">{formatDate(row.created_at)}</p>
        </div>

        <div className="space-y-4">

          {/* Customer */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Kunde</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Lead kilde</span>
                <select value={leadSource} onChange={(e) => setLeadSource(e.target.value)}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">– Ukjent</option>
                  <option value="messe_stand">Messe/stand</option>
                  <option value="chatgpt">ChatGPT</option>
                  <option value="google">Google</option>
                  <option value="andre_soekemotorer">Andre søkemotorer</option>
                  <option value="annet">Annet</option>
                </select>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-gray-400">Navn</dt><dd className="font-medium text-gray-900">{row.customer_name}</dd></div>
              <div><dt className="text-xs text-gray-400">E-post</dt><dd><a href={`mailto:${row.customer_email}`} className="text-orange-600 hover:underline">{row.customer_email}</a></dd></div>
              {row.customer_phone && <div><dt className="text-xs text-gray-400">Telefon</dt><dd><a href={`tel:${row.customer_phone}`} className="text-orange-600 hover:underline">{row.customer_phone}</a></dd></div>}
              {row.address && <div className="sm:col-span-2"><dt className="text-xs text-gray-400">Adresse</dt><dd className="text-gray-700">{row.address}</dd></div>}
            </dl>
          </div>

          {/* Garage config */}
          {gc && (gc.lengthMm || gc.widthMm) && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Garasjekonfigurasjon</h2>
              <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                {gc.widthMm && <div><dt className="text-xs text-gray-400">Bredde</dt><dd className="font-medium">{Number(gc.widthMm) / 1000} m</dd></div>}
                {gc.lengthMm && <div><dt className="text-xs text-gray-400">Lengde</dt><dd className="font-medium">{Number(gc.lengthMm) / 1000} m</dd></div>}
                {gc.doorWidthMm && <div><dt className="text-xs text-gray-400">Portbredde</dt><dd className="font-medium">{gc.doorWidthMm} mm</dd></div>}
                {gc.doorHeightMm && <div><dt className="text-xs text-gray-400">Porthøyde</dt><dd className="font-medium">{gc.doorHeightMm} mm</dd></div>}
              </dl>
            </div>
          )}

          {/* DIBK */}
          {Object.keys(localDibk).length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-700">DIBK-svar</h2>
                {dibkDispCount > 0 && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {dibkDispCount} dispensasjon{dibkDispCount > 1 ? "er" : ""}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-gray-400">Endringer lagres med «Lagre»-knappen</span>
              </div>
              <dl className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                {Object.entries(localDibk).map(([k, v]) => {
                  const isDisp = isDispensasjon(k, v);
                  const unsaved = row.dibk?.[k] !== v;
                  const manualOverride = manuallyChangedKeys.has(k) || localManualKeys.has(k);
                  const showBadge = unsaved || manualOverride;
                  return (
                    <div key={k} className={`rounded-lg px-3 py-1.5 ${isDisp ? "bg-red-50 ring-1 ring-red-200" : "bg-gray-50"} ${unsaved ? "ring-2 ring-blue-300" : ""}`}>
                      <div className="flex items-center justify-between">
                        <dt className="text-xs text-gray-500 flex items-center gap-1 flex-wrap">
                          {DIBK_LABELS[k] ?? k}
                          {isDisp && <span className="rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-600">disp.</span>}
                          {showBadge && <span className="rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600">manuelt endret</span>}
                        </dt>
                        <select
                          value={v}
                          onChange={(e) => setLocalDibk((prev) => ({ ...prev, [k]: e.target.value }))}
                          className={`ml-2 rounded border px-1.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-400 ${v === "Ja" ? "text-green-600 bg-green-50 border-green-200" : v === "Nei" ? "text-red-500 bg-red-50 border-red-200" : "text-gray-500 bg-gray-50 border-gray-200"}`}
                        >
                          <option value="Ja">Ja</option>
                          <option value="Nei">Nei</option>
                          <option value="Vet ikke">Vet ikke</option>
                        </select>
                      </div>
                      {unsaved && (
                        <input
                          type="text"
                          placeholder="Grunn til endring (påkrevd)"
                          value={localDibkReasons[k] ?? ""}
                          onChange={(e) => setLocalDibkReasons((prev) => ({ ...prev, [k]: e.target.value }))}
                          className="mt-1.5 w-full rounded border border-blue-300 bg-white px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      )}
                    </div>
                  );
                })}
              </dl>
            </div>
          )}

          {/* Manual dispensasjoner */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-gray-700">Dispensasjoner fra reguleringsplan</h2>
              {manualDisps.length > 0 && (
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">{manualDisps.length}</span>
              )}
            </div>
            {manualDisps.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {manualDisps.map((d, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 ring-1 ring-red-200">
                    <span className="text-sm text-gray-800">{d.description}</span>
                    <div className="ml-3 flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">{fmt(d.amount)}</span>
                      <button onClick={() => removeManualDisp(i)} className="text-red-400 hover:text-red-600" title="Fjern">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="F.eks. Avstand til vei, Høyde over regulert"
                value={newDispDesc}
                onChange={(e) => setNewDispDesc(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addManualDisp()}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <div className="relative">
                <input
                  type="number"
                  value={newDispAmount}
                  onChange={(e) => setNewDispAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addManualDisp()}
                  className="w-28 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  title="Foreslått pris — kan overstyres"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">kr</span>
              </div>
              <button onClick={addManualDisp} disabled={!newDispDesc.trim() || !newDispAmount}
                className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40">
                + Legg til
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">Foreslått pris: {dibkDispCount > 0 || manualDisps.length > 0 ? "2 000" : "8 000"} kr — kan overstyres i beløpsfeltet.</p>
          </div>

          {/* Pris */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Pris</h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>
                  Søknadshjelp
                  {dibkDispCount > 0 && <span className="ml-1 text-xs text-gray-400">(inkl. {dibkDispCount} DIBK-dispensasjon{dibkDispCount > 1 ? "er" : ""})</span>}
                </span>
                <span>{row.permit_price != null ? fmt(row.permit_price) : "–"}</span>
              </div>
              {manualDisps.map((d, i) => (
                <div key={`disp-${i}`} className="flex items-center justify-between text-gray-600">
                  <span className="flex items-center gap-1.5">
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">Disp.</span>
                    {d.description}
                  </span>
                  <span>{fmt(d.amount)}</span>
                </div>
              ))}
              {extraCosts.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-gray-600">
                  <span>{c.description}</span>
                  <div className="flex items-center gap-2">
                    <span>{fmt(c.amount)}</span>
                    <button onClick={() => removeExtraCost(i)} className="text-gray-300 hover:text-red-500" title="Fjern">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-1.5 flex justify-between font-bold text-gray-900">
                <span>Totalt</span>
                <span>{fmt(computedTotal)}</span>
              </div>
            </div>

            {/* Add extra cost */}
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="Beskrivelse"
                value={newCostDesc}
                onChange={(e) => setNewCostDesc(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <input
                type="number"
                placeholder="Beløp"
                value={newCostAmount}
                onChange={(e) => setNewCostAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExtraCost()}
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button onClick={addExtraCost} disabled={!newCostDesc.trim() || !newCostAmount}
                className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40">
                + Legg til
              </button>
            </div>
          </div>

          {/* Søknadsresultat */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Søknadsresultat</h2>
            <p className="text-sm font-medium capitalize text-gray-700">{row.permit_result ?? "–"}</p>
          </div>

          {/* Admin fields */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Behandling</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Behandler</label>
                <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">Ikke tildelt</option>
                  {ALLOWED_ADMINS.map((a) => (
                    <option key={a} value={a}>{adminName(a)}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">Notater</label>
                {!editingNotes && (
                  <button onClick={() => setEditingNotes(true)} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Endre</button>
                )}
              </div>
              {editingNotes ? (
                <div>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    autoFocus
                    placeholder="Interne notater..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                    >
                      {savingNotes ? "Lagrer…" : "Lagre notat"}
                    </button>
                    <button
                      onClick={() => { setNotes(row.notes ?? ""); setEditingNotes(false); }}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              ) : (
                <div className="min-h-[2.5rem] rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                  {row.notes ? row.notes : <span className="text-gray-400 italic">Ingen notater</span>}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button onClick={handleSave} disabled={saving || !hasChanges}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? "Lagrer…" : "Lagre"}
              </button>
              {dibkReasonsMissing && changedDibkKeys.length > 0 && (
                <span className="text-xs text-blue-600">Fyll inn grunn til DIBK-endring for å lagre</span>
              )}
              {saveOk && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Lagret!
                </span>
              )}
            </div>
          </div>

          {/* Vedlegg */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Vedlegg</h2>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {uploading ? "Laster opp…" : "+ Last opp"}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mb-3 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-4 py-4 transition-colors ${dragOver ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50 hover:border-orange-300"}`}
            >
              <p className="text-xs text-gray-400">{uploading ? "Laster opp…" : "Slipp fil her, eller klikk for å velge"}</p>
            </div>

            {attachments.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Ingen vedlegg lastet opp ennå.</p>
            ) : (
              <ul className="space-y-1.5">
                {attachments.map((a) => (
                  <li key={a.name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <span className="text-sm text-gray-700 truncate max-w-xs">{a.name}</span>
                    <div className="ml-3 flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => downloadAttachment(a.name)}
                        className="text-xs text-orange-600 hover:text-orange-800 font-medium"
                      >
                        Last ned
                      </button>
                      <button
                        onClick={() => deleteAttachment(a.name)}
                        className="text-gray-300 hover:text-red-500"
                        title="Slett"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Logg */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Logg</h2>
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                placeholder="Legg til kommentar..."
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <button
                onClick={handleAddComment}
                disabled={addingComment || !newComment.trim()}
                className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
              >
                Send
              </button>
            </div>
            {activityLog.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Ingen aktivitet ennå.</p>
            ) : (
              <ol className="relative border-l border-gray-200 space-y-4 ml-2">
                {activityLog.map((entry) => {
                  const dotColor =
                    entry.action_type === "status_change" ? "bg-orange-400" :
                    entry.action_type === "dibk_edit" ? "bg-blue-400" :
                    entry.action_type === "comment" ? "bg-gray-400" : "bg-gray-300";
                  return (
                    <li key={entry.id} className="ml-4">
                      <span className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white ${dotColor}`} />
                      <div className="text-xs">
                        {entry.action_type === "status_change" ? (() => {
                          const p = entry.payload as { from_status?: string; to_status?: string };
                          return (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-gray-500 font-medium">Statusendring:</span>
                              <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[p.from_status ?? ""] ?? "bg-gray-100 text-gray-500"}`}>
                                {STATUS_LABELS[p.from_status ?? ""] ?? p.from_status ?? "–"}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[p.to_status ?? ""] ?? "bg-gray-100 text-gray-500"}`}>
                                {STATUS_LABELS[p.to_status ?? ""] ?? p.to_status ?? "–"}
                              </span>
                            </div>
                          );
                        })() : entry.action_type === "dibk_edit" ? (() => {
                          const p = entry.payload as { field?: string; old_value?: string; new_value?: string; reason?: string };
                          return (
                            <div>
                              <p className="text-gray-700">
                                <span className="font-medium text-blue-600">DIBK endret:</span>{" "}
                                {p.field}: <span className="font-medium">{p.old_value || "–"}</span> → <span className="font-medium">{p.new_value}</span>
                              </p>
                              {p.reason && (
                                <p className="mt-0.5 text-gray-500 italic">Grunn: {p.reason}</p>
                              )}
                            </div>
                          );
                        })() : entry.action_type === "comment" ? (
                          <p className="text-gray-800 font-medium">"{(entry.payload as { text?: string }).text}"</p>
                        ) : entry.action_type === "lead_source_change" ? (
                          <p className="text-gray-600">Lead kilde: <span className="font-medium">{(entry.payload as { old?: string }).old || "–"}</span> → <span className="font-medium">{(entry.payload as { new?: string }).new || "–"}</span></p>
                        ) : (
                          <p className="text-gray-500 capitalize">{entry.action_type}</p>
                        )}
                        <p className="mt-0.5 text-gray-400">{formatDate(entry.created_at)} · {entry.actor_email}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
