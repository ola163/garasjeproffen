"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { adminName, ADMIN_NAMES } from "@/lib/admin-names";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];
const BUCKET = "soknadshjelp-attachments";

const TEGNING_OPTIONS = [
  { key: "kun_garasje",      label: "Kun garasjen",                     description: "Fasade-, plan- og snittegning av ny garasje" },
  { key: "med_eksisterende", label: "Garasje + eksisterende bebyggelse", description: "Inkluderer alle bygg på tomten" },
  { key: "situasjonsplan",   label: "Situasjonsplan",                    description: "Kart med tomtegrenser og naboavstand" },
] as const;
const TEGNING_LABELS = new Set<string>(TEGNING_OPTIONS.map(o => o.label));

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
  customer_notes: string | null;
  tilbudsbeskrivelse: string | null;
  dibk_comments: Record<string, string> | null;
  admin_dibk_comments: Record<string, string> | null;
  lead_source: string | null;
  quote_id: string | null;
  approval_requested_from: string | null;
  approval_requested_at: string | null;
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
  const hasUnsavedChangesRef = useRef(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState("");
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
  const [customerNotes, setCustomerNotes] = useState("");
  const [savingCustomerNotes, setSavingCustomerNotes] = useState(false);
  const [tilbudsbeskrivelse, setTilbudsbeskrivelse] = useState("");
  const [savingTilbud, setSavingTilbud] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
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

  const [tegningPriser, setTegningPriser] = useState({ kun_garasje: 5000, med_eksisterende: 10000, situasjonsplan: 1500 });

  const [leadSource, setLeadSource] = useState<string>("");
  const [savingLeadSource, setSavingLeadSource] = useState(false);
  const [leadSources, setLeadSources] = useState<{ label: string; value: string }[]>([]);
  const [statusConfirm, setStatusConfirm] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingAssigned, setUpdatingAssigned] = useState(false);
  const [convertingToQuote, setConvertingToQuote] = useState(false);
  const [convertConfirm, setConvertConfirm] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [sendingApproval, setSendingApproval] = useState(false);
  const [approvalSent, setApprovalSent] = useState(false);
  const [approvingCase, setApprovingCase] = useState(false);
  const [emailSendResult, setEmailSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [returComment, setReturComment] = useState("");
  const [returningCase, setReturningCase] = useState(false);
  const [localDibk, setLocalDibk] = useState<Record<string, string>>({});
  const [localDibkReasons, setLocalDibkReasons] = useState<Record<string, string>>({});
  const [dibkAdminComments, setDibkAdminComments] = useState<Record<string, string>>({});
  const [localManualKeys, setLocalManualKeys] = useState<Set<string>>(new Set());
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);

    // Attachments
  type Attachment = { id: string; file_path: string; label: string; uploaded_by: string; created_at: string };
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingLabels, setPendingLabels] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingLabelText, setEditingLabelText] = useState("");

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    supabase.from("lead_sources").select("label, value").order("sort_order").then(({ data }) => {
      if (data) setLeadSources(data as { label: string; value: string }[]);
    });

    fetch("/api/admin/soknadshjelp-priser").then(r => r.json()).then((rows: { key: string; price: number }[]) => {
      const m: Record<string, number> = {};
      for (const r of rows) m[r.key] = r.price;
      setTegningPriser({
        kun_garasje:      m["tegning_kun_garasje"]      ?? 5000,
        med_eksisterende: m["tegning_med_eksisterende"]  ?? 10000,
        situasjonsplan:   m["tegning_situasjonsplan"]    ?? 1500,
      });
    }).catch(() => {});

    Promise.all([
      supabase.from("soknadshjelp").select("*").eq("id", id).single(),
      supabase.from("activity_log").select("*").eq("entity_id", id).order("created_at", { ascending: false }),
      supabase.from("soknadshjelp_attachments").select("*").eq("soknadshjelp_id", id).order("created_at", { ascending: true }),
      supabase.storage.from(BUCKET).list(id),
    ]).then(([{ data }, { data: actData }, { data: attData }, { data: storageFiles }]) => {
      if (data) {
        setRow(data as SoknadshjelRow);
        setNotes(data.notes ?? "");
        setCustomerNotes(data.customer_notes ?? "");
        setTilbudsbeskrivelse(data.tilbudsbeskrivelse ?? "");
        setStatus(data.status ?? "new");
        setAssignedTo(data.assigned_to ?? "");
        setLeadSource(data.lead_source ?? "");
        // Parse dibk: extract embedded reasons (keys ending with ~)
        const fullDibk = (data.dibk as Record<string, string>) ?? {};
        const cleanDibkValues: Record<string, string> = {};
        const embeddedReasons: Record<string, string> = {};
        for (const [k, v] of Object.entries(fullDibk)) {
          if (k.endsWith("~")) embeddedReasons[k.slice(0, -1)] = v;
          else cleanDibkValues[k] = v;
        }
        setLocalDibk(cleanDibkValues);
        if (Object.keys(embeddedReasons).length > 0) setLocalDibkReasons(embeddedReasons);
        // admin_dibk_comments: prefer DB column if it exists, else reconstruct from activity_log
        const dbComments = (data.admin_dibk_comments as Record<string, string> | null);
        if (dbComments && Object.keys(dbComments).length > 0) {
          setDibkAdminComments(dbComments);
        }
        setExtraCosts(data.extra_costs ?? []);
        const md = data.manual_dispensasjoner ?? [];
        setManualDisps(md);
        const dibkCount = Object.entries(cleanDibkValues).filter(([k, v]) => isDispensasjon(k, v)).length;
        setNewDispAmount(dibkCount > 0 || md.length > 0 ? "2000" : "8000");
      }
      if (actData) {
        setActivityLog(actData as ActivityEntry[]);
        const rebuiltComments: Record<string, string> = {};
        const actLogReasons: Record<string, string> = {};
        for (const e of (actData as ActivityEntry[])) {
          if (e.action_type === "dibk_admin_comment") {
            const p = e.payload as { key?: string; comment?: string };
            if (p.key && !(p.key in rebuiltComments)) rebuiltComments[p.key] = p.comment ?? "";
          }
          if (e.action_type === "dibk_edit") {
            const p = e.payload as { key?: string; reason?: string };
            if (p.key && p.reason && !(p.key in actLogReasons)) actLogReasons[p.key] = p.reason;
          }
        }
        if (Object.keys(rebuiltComments).length > 0) setDibkAdminComments(rebuiltComments);
        // activityLog reasons are only a fallback — dibk-embedded reasons (set above) take priority
        if (Object.keys(actLogReasons).length > 0) setLocalDibkReasons(prev => ({ ...actLogReasons, ...prev }));
      }

      // Merge DB records + any orphaned storage files (DB row missing)
      const dbAtts: Attachment[] = (attData as Attachment[]) ?? [];
      const trackedPaths = new Set(dbAtts.map((a) => a.file_path));
      const orphans: Attachment[] = (storageFiles ?? [])
        .filter((f) => !trackedPaths.has(`${id}/${f.name}`))
        .map((f) => ({
          id: `orphan_${f.name}`,
          file_path: `${id}/${f.name}`,
          label: f.name.replace(/^\d+_/, "").replace(/\.[^.]+$/, ""),
          uploaded_by: "",
          created_at: f.created_at ?? new Date().toISOString(),
        }));
      setAttachments([...dbAtts, ...orphans]);
      setLoading(false);
    });
  }, [user, id]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChangesRef.current) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      if (!hasUnsavedChangesRef.current) return;
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || anchor.target === "_blank") return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
      setLeaveConfirmOpen(true);
    }
    window.addEventListener("click", onLinkClick, true);

    function onPopState() {
      if (!hasUnsavedChangesRef.current) return;
      window.history.pushState(null, "", window.location.href);
      setPendingHref("__back__");
      setLeaveConfirmOpen(true);
    }
    window.addEventListener("popstate", onPopState);

    const origPushState = window.history.pushState.bind(window.history);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.history as any).pushState = function(data: unknown, unused: string, url?: string | URL | null) {
      if (hasUnsavedChangesRef.current && url != null) {
        setPendingHref(String(url));
        setLeaveConfirmOpen(true);
        return;
      }
      origPushState(data, unused, url);
    };

    return () => {
      window.removeEventListener("click", onLinkClick, true);
      window.removeEventListener("popstate", onPopState);
      window.history.pushState = origPushState;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigate(href: string) {
    if (hasUnsavedChangesRef.current) { setPendingHref(href); setLeaveConfirmOpen(true); }
    else router.push(href);
  }

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

  function toggleTegningCost(label: string, price: number) {
    const exists = extraCosts.some(c => c.description === label);
    if (exists) {
      setExtraCosts(prev => prev.filter(c => c.description !== label));
    } else {
      setExtraCosts(prev => [...prev, { description: label, amount: price }]);
    }
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

  async function handleLeadSourceChange(val: string) {
    if (!supabase || !row) return;
    const old = leadSource;
    setLeadSource(val);
    setSavingLeadSource(true);
    const { error } = await supabase.from("soknadshjelp").update({ lead_source: val || null }).eq("id", row.id);
    if (error) {
      console.error("Lead source save failed:", error);
      setLeadSource(old);
    } else {
      setRow((prev) => prev ? { ...prev, lead_source: val || null } : null);
      if (val !== old) {
        await supabase.from("activity_log").insert({
          entity_type: "soknadshjelp",
          entity_id: row.id,
          action_type: "lead_source_change",
          actor_email: user?.email ?? "ukjent",
          payload: { old, new: val },
        });
      }
    }
    setSavingLeadSource(false);
  }

  async function handleStatusChange(newStatus: string) {
    if (!supabase || !row || newStatus === row.status) return;
    setUpdatingStatus(true);
    const old = status;
    setStatus(newStatus);
    const { error } = await supabase.from("soknadshjelp").update({ status: newStatus }).eq("id", row.id);
    if (error) {
      setStatus(old);
      setUpdatingStatus(false);
      return;
    }
    const { data: logEntry } = await supabase.from("activity_log").insert({
      entity_type: "soknadshjelp",
      entity_id: row.id,
      action_type: "status_change",
      actor_email: user?.email ?? "ukjent",
      payload: { from_status: old, to_status: newStatus },
    }).select().single();
    if (logEntry) setActivityLog((prev) => [logEntry as ActivityEntry, ...prev]);
    setRow((prev) => prev ? { ...prev, status: newStatus } : null);
    setUpdatingStatus(false);
  }

  async function handleAssignedToChange(email: string) {
    if (!supabase || !row) return;
    setUpdatingAssigned(true);
    const old = assignedTo;
    setAssignedTo(email);
    const { error } = await supabase.from("soknadshjelp").update({ assigned_to: email || null }).eq("id", row.id);
    if (error) {
      setAssignedTo(old);
    } else {
      setRow((prev) => prev ? { ...prev, assigned_to: email || null } : null);
    }
    setUpdatingAssigned(false);
  }

  async function handleRequestApproval(approverEmail: string) {
    if (!supabase || !row || !user || !approverEmail) return;
    const approverName = adminName(approverEmail);
    const requesterName = adminName(user.email);
    const now = new Date().toISOString();
    setSendingApproval(true);
    await supabase.from("soknadshjelp").update({
      status: "pending_approval",
      approval_requested_from: approverName,
      approval_requested_at: now,
    }).eq("id", row.id);
    const old = status;
    setStatus("pending_approval");
    const { data: logEntry } = await supabase.from("activity_log").insert({
      entity_type: "soknadshjelp",
      entity_id: row.id,
      action_type: "status_change",
      actor_email: user.email ?? "ukjent",
      payload: { from_status: old, to_status: "pending_approval" },
    }).select().single();
    if (logEntry) setActivityLog((prev) => [logEntry as ActivityEntry, ...prev]);
    setRow((prev) => prev ? { ...prev, status: "pending_approval", approval_requested_from: approverName, approval_requested_at: now } : null);
    await fetch("/api/admin/soknadshjelp-approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approverEmail,
        approverName,
        requesterName,
        ticketNumber: row.ticket_number,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        customerPhone: row.customer_phone,
        address: row.address,
        totalPrice: computedTotal,
        permitPrice: row.permit_price ?? 0,
        permitResult: row.permit_result,
        extraCosts,
        manualDisps,
        dibk: Object.fromEntries(Object.entries(localDibk)),
        dibkAdminComments,
        customerNotes,
        soknadshjelId: row.id,
      }),
    });
    setSendingApproval(false);
    setApprovalOpen(false);
    setApprovalSent(true);
    setTimeout(() => setApprovalSent(false), 3000);
  }

  async function handleApprove() {
    if (!supabase || !row || !user) return;
    setApprovingCase(true);
    setEmailSendResult(null);
    const old = status;
    const total = (row.permit_price ?? 0)
      + extraCosts.reduce((s, c) => s + c.amount, 0)
      + manualDisps.reduce((s, d) => s + d.amount, 0);

    await supabase.from("soknadshjelp").update({
      status: "offer_sent",
      approval_requested_from: null,
      approval_requested_at: null,
    }).eq("id", row.id);
    const { data: logEntry } = await supabase.from("activity_log").insert({
      entity_type: "soknadshjelp",
      entity_id: row.id,
      action_type: "status_change",
      actor_email: user.email ?? "ukjent",
      payload: { from_status: old, to_status: "offer_sent" },
    }).select().single();
    if (logEntry) setActivityLog((prev) => [logEntry as ActivityEntry, ...prev]);
    setStatus("offer_sent");
    setRow((prev) => prev ? { ...prev, status: "offer_sent", approval_requested_from: null, approval_requested_at: null } : null);

    if (!row.customer_email) {
      setEmailSendResult({ success: false, message: "Kunde mangler e-postadresse – e-post ikke sendt." });
      setApprovingCase(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/soknadshjelp-approved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminEmail: user.email,
          customerEmail: row.customer_email,
          customerName: row.customer_name,
          ticketNumber: row.ticket_number,
          address: row.address,
          totalPrice: total,
          soknadshjelId: row.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailSendResult({ success: true, message: `E-post sendt til ${row.customer_email}` });
      } else {
        setEmailSendResult({ success: false, message: data.error ?? "Noe gikk galt ved sending av e-post." });
      }
    } catch {
      setEmailSendResult({ success: false, message: "Nettverksfeil – e-post ikke sendt." });
    }

    setApprovingCase(false);
  }

  async function handleReturnCase() {
    if (!supabase || !row || !user) return;
    setReturningCase(true);
    const text = returComment.trim();
    await supabase.from("soknadshjelp").update({
      status: "in_review",
      approval_requested_from: null,
      approval_requested_at: null,
    }).eq("id", row.id);
    const { data: logEntry } = await supabase.from("activity_log").insert({
      entity_type: "soknadshjelp",
      entity_id: row.id,
      action_type: "approval_rejected",
      actor_email: user.email ?? "ukjent",
      payload: { comment: text },
    }).select().single();
    if (logEntry) setActivityLog((prev) => [logEntry as ActivityEntry, ...prev]);
    setStatus("in_review");
    setRow((prev) => prev ? { ...prev, status: "in_review", approval_requested_from: null, approval_requested_at: null } : null);
    setReturComment("");
    setReturningCase(false);
  }

  async function handleConvertToQuote() {
    if (!supabase || !row || row.quote_id) return;
    setConvertingToQuote(true);
    const { data: ticketData } = await supabase.rpc("next_ticket_number");
    const ticketNumber = (ticketData as string) ?? `Q-${Date.now()}`;
    const { data: inserted, error } = await supabase.from("quotes").insert({
      ticket_number: ticketNumber,
      customer_name: row.customer_name,
      customer_email: row.customer_email,
      customer_phone: row.customer_phone || null,
      category: "søknadshjelp",
      status: "new",
      created_manually: true,
      lead_source: row.lead_source || null,
    }).select("id, ticket_number").single();
    if (error || !inserted) {
      setConvertingToQuote(false);
      return;
    }
    await supabase.from("soknadshjelp").update({ quote_id: inserted.id }).eq("id", row.id);
    setRow((prev) => prev ? { ...prev, quote_id: inserted.id } : null);
    setConvertingToQuote(false);
    router.push(`/admin/quotes/${inserted.id}`);
  }

  async function handleCancelApproval() {
    if (!supabase || !row) return;
    await supabase.from("soknadshjelp").update({
      status: "in_review",
      approval_requested_from: null,
      approval_requested_at: null,
    }).eq("id", row.id);
    setStatus("in_review");
    setRow((prev) => prev ? { ...prev, status: "in_review", approval_requested_from: null, approval_requested_at: null } : null);
  }

  async function handleSaveNotes() {
    if (!supabase || !row) return;
    setSavingNotes(true);
    await supabase.from("soknadshjelp").update({ notes: notes || null }).eq("id", row.id);
    setRow((prev) => prev ? { ...prev, notes: notes || null } : null);
    setSavingNotes(false);
    setEditingNotes(false);
  }

  async function handleSaveCustomerNotes() {
    if (!supabase || !row) return;
    setSavingCustomerNotes(true);
    await supabase.from("soknadshjelp").update({ customer_notes: customerNotes || null }).eq("id", row.id);
    setRow((prev) => prev ? { ...prev, customer_notes: customerNotes || null } : null);
    setSavingCustomerNotes(false);
  }

  async function handleSaveTilbudsbeskrivelse() {
    if (!supabase || !row) return;
    setSavingTilbud(true);
    await supabase.from("soknadshjelp").update({ tilbudsbeskrivelse: tilbudsbeskrivelse || null }).eq("id", row.id);
    setRow((prev) => prev ? { ...prev, tilbudsbeskrivelse: tilbudsbeskrivelse || null } : null);
    setSavingTilbud(false);
  }

  async function handleDownloadPdf() {
    if (!user || !row) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch("/api/admin/soknadshjelp-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminEmail: user.email, soknadshjelId: row.id }),
      });
      if (!res.ok) { alert("Kunne ikke generere PDF"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tilbud-${row.ticket_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingPdf(false);
    }
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

  function queueFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (!arr.length) return;
    setPendingFiles(arr);
    setPendingLabels(arr.map((f) => f.name.replace(/\.[^.]+$/, "")));
  }

  async function confirmUpload() {
    if (!supabase || !row || !pendingFiles.length) return;
    setUploading(true);
    setUploadError(null);
    const newEntries: Attachment[] = [];
    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      const label = pendingLabels[i]?.trim() || file.name;
      const safeName = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${id}/${Date.now()}_${safeName}`;
      const { error: storageErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (storageErr) {
        setUploadError(`Opplasting feilet: ${storageErr.message}`);
        setUploading(false);
        return;
      }
      const { data: meta, error: dbErr } = await supabase.from("soknadshjelp_attachments").insert({
        soknadshjelp_id: row.id,
        file_path: path,
        label,
        uploaded_by: user?.email ?? "ukjent",
      }).select().single();
      if (dbErr) {
        // Storage upload succeeded but DB failed — show file as orphan so it's not lost
        setUploadError(`Vedlegg lastet opp, men kunne ikke lagre navn: ${dbErr.message}`);
        newEntries.push({ id: `orphan_${file.name}`, file_path: path, label, uploaded_by: user?.email ?? "", created_at: new Date().toISOString() });
      } else if (meta) {
        newEntries.push(meta as Attachment);
      }
    }
    setAttachments((prev) => [...prev, ...newEntries]);
    setPendingFiles([]);
    setPendingLabels([]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) queueFiles(e.target.files);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) queueFiles(e.dataTransfer.files);
  }

  async function downloadAttachment(att: Attachment) {
    if (!supabase) return;
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(att.file_path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function deleteAttachment(att: Attachment) {
    if (!supabase) return;
    await supabase.storage.from(BUCKET).remove([att.file_path]);
    if (!att.id.startsWith("orphan_")) {
      await supabase.from("soknadshjelp_attachments").delete().eq("id", att.id);
    }
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
  }

  async function saveAttachmentLabel(att: Attachment, newLabel: string) {
    if (!supabase || !row || !newLabel.trim()) return;
    if (att.id.startsWith("orphan_")) {
      // Create a proper DB record for this orphaned storage file
      const { data } = await supabase.from("soknadshjelp_attachments").insert({
        soknadshjelp_id: row.id,
        file_path: att.file_path,
        label: newLabel.trim(),
        uploaded_by: user?.email ?? "ukjent",
      }).select().single();
      if (data) setAttachments((prev) => prev.map((a) => a.id === att.id ? (data as Attachment) : a));
    } else {
      await supabase.from("soknadshjelp_attachments").update({ label: newLabel.trim() }).eq("id", att.id);
      setAttachments((prev) => prev.map((a) => a.id === att.id ? { ...a, label: newLabel.trim() } : a));
    }
    setEditingLabelId(null);
  }

  async function handleSave() {
    if (!supabase || !row) return;
    setSaving(true);
    try {
      const newTotal = (row.permit_price ?? 0) + manualDisps.reduce((s, d) => s + d.amount, 0) + extraCosts.reduce((s, c) => s + c.amount, 0);

      const origDibk = Object.fromEntries(
        Object.entries(row.dibk ?? {}).filter(([k]) => !k.endsWith("~"))
      );
      const dibkChanges: { key: string; field: string; old_value: string; new_value: string; reason?: string }[] = [];
      Object.entries(localDibk).forEach(([k, v]) => {
        if (origDibk[k] !== v) {
          const reason = localDibkReasons[k]?.trim();
          dibkChanges.push({ key: k, field: DIBK_LABELS[k] ?? k, old_value: origDibk[k] ?? "", new_value: v, ...(reason ? { reason } : {}) });
        }
      });

      const dibkForSave: Record<string, string> = { ...localDibk };
      for (const [k, v] of Object.entries(localDibkReasons)) {
        if (v.trim()) dibkForSave[`${k}~`] = v.trim();
      }

      const { error: mainErr } = await supabase.from("soknadshjelp").update({
        extra_costs: extraCosts,
        manual_dispensasjoner: manualDisps,
        total_price: newTotal,
        dibk: dibkForSave,
      }).eq("id", row.id);
      if (mainErr) console.error("Main save failed:", mainErr);

      // Persist admin dibk comments to activity_log (no migration needed)
      const commentEntries = Object.entries(dibkAdminComments).filter(([, v]) => v.trim());
      const commentLogEntries: ActivityEntry[] = [];
      for (const [k, v] of commentEntries) {
        const { data: ce, error: ceErr } = await supabase.from("activity_log").insert({
          entity_type: "soknadshjelp",
          entity_id: row.id,
          action_type: "dibk_admin_comment",
          actor_email: user?.email ?? "ukjent",
          payload: { key: k, comment: v },
        }).select().single();
        if (ceErr) console.error("dibk_admin_comment insert failed:", ceErr);
        if (ce) commentLogEntries.push(ce as ActivityEntry);
      }
      if (commentLogEntries.length > 0) setActivityLog((prev) => [...commentLogEntries.reverse(), ...prev]);

      if (dibkChanges.length > 0) {
        const changedKeys = dibkChanges.map((c) => c.key);
        setLocalManualKeys((prev) => new Set([...prev, ...changedKeys]));
        for (const change of dibkChanges) {
          const { error: logErr } = await supabase.from("activity_log").insert({
            entity_type: "soknadshjelp",
            entity_id: row.id,
            action_type: "dibk_edit",
            actor_email: user?.email ?? "ukjent",
            payload: change,
          });
          if (logErr) console.error("dibk_edit insert failed:", logErr);
        }
      }

      const savedComments = Object.fromEntries(commentEntries) as Record<string, string>;
      setRow((prev) => prev ? { ...prev, dibk: dibkForSave, extra_costs: extraCosts, manual_dispensasjoner: manualDisps, admin_dibk_comments: Object.keys(savedComments).length > 0 ? savedComments : null } : null);
      hasUnsavedChangesRef.current = false;
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err) {
      console.error("handleSave error:", err);
    } finally {
      setSaving(false);
    }
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
  const nonEmptyComments = Object.fromEntries(Object.entries(dibkAdminComments).filter(([, v]) => v.trim()));
  const savedNonEmptyComments = Object.fromEntries(Object.entries(row.admin_dibk_comments ?? {}).filter(([, v]) => (v as string).trim()));
  const commentsChanged = JSON.stringify(nonEmptyComments) !== JSON.stringify(savedNonEmptyComments);
  const hasChanges =
    (changedDibkKeys.length > 0 ||
    JSON.stringify(extraCosts) !== JSON.stringify(row.extra_costs ?? []) ||
    JSON.stringify(manualDisps) !== JSON.stringify(row.manual_dispensasjoner ?? []) ||
    commentsChanged) &&
    !dibkReasonsMissing;
  const hasUnsavedChanges =
    changedDibkKeys.length > 0 ||
    JSON.stringify(extraCosts) !== JSON.stringify(row.extra_costs ?? []) ||
    JSON.stringify(manualDisps) !== JSON.stringify(row.manual_dispensasjoner ?? []) ||
    commentsChanged;
  hasUnsavedChangesRef.current = hasUnsavedChanges;

  const manuallyChangedKeys = new Set<string>();
  const activityLogReasons: Record<string, string> = {};
  activityLog
    .filter((e) => e.action_type === "dibk_edit")
    .forEach((e) => {
      const p = e.payload as { key?: string; field?: string; reason?: string };
      const resolvedKey = p.key ?? Object.entries(DIBK_LABELS).find(([, label]) => label === p.field)?.[0];
      if (resolvedKey) {
        manuallyChangedKeys.add(resolvedKey);
        if (p.reason && !(resolvedKey in activityLogReasons)) activityLogReasons[resolvedKey] = p.reason;
      }
    });

  const isPendingApproval = status === "pending_approval";
  const totalDispCount = dibkDispCount + manualDisps.length;
  const computedTotal = (row.permit_price ?? 0) + manualDisps.reduce((s, d) => s + d.amount, 0) + extraCosts.reduce((s, c) => s + c.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button onClick={() => navigate("/admin/quotes")} className="mt-1 text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 font-mono">{row.ticket_number}</h1>
                <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">Søknadshjelp</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500"}`}>{STATUS_LABELS[status] ?? status}</span>
                {totalDispCount > 0 && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {totalDispCount} dispensasjon{totalDispCount > 1 ? "er" : ""}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-400">{formatDate(row.created_at)}</p>
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={assignedTo}
                  onChange={(e) => handleAssignedToChange(e.target.value)}
                  disabled={updatingAssigned || isPendingApproval}
                  className="rounded border border-gray-200 bg-transparent px-1.5 py-0.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-400 disabled:opacity-60"
                >
                  <option value="">Ikke tildelt</option>
                  {ALLOWED_ADMINS.map((a) => (
                    <option key={a} value={a}>{adminName(a)}</option>
                  ))}
                </select>
                {updatingAssigned && <span className="text-xs text-gray-400">Lagrer…</span>}
              </div>
              {row.quote_id && (
                <Link href={`/admin/quotes/${row.quote_id}`} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-orange-600 hover:text-orange-800">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  Koblet til tilbudsforespørsel
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {/* Inline status buttons */}
            <div className="flex flex-wrap justify-end gap-1.5">
              {STATUS_OPTIONS.map((s) => (
                <button key={s} onClick={() => setStatusConfirm(s)} disabled={updatingStatus || s === status || isPendingApproval}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all disabled:cursor-default ${
                    s === status
                      ? (STATUS_COLORS[s] ?? "bg-gray-100 text-gray-500") + " ring-2 ring-offset-1 ring-current opacity-100"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-100"
                  }`}>
                  {STATUS_LABELS[s] ?? s}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link
                href={`/admin/soknadshjelp/${id}/dispensasjonssoknad`}
                className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Generer søknadsdokument
              </Link>
              {!row.quote_id && (
                <button
                  onClick={() => setConvertConfirm(true)}
                  disabled={convertingToQuote}
                  className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition-colors"
                >
                  {convertingToQuote ? "Oppretter…" : "Konverter til søknadshjelp + byggpakke"}
                </button>
              )}
              {/* Godkjenning */}
              {status === "pending_approval" ? (
                <span className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700">
                  Venter godkjenning
                </span>
              ) : (
                !["offer_sent", "paid", "ferdigstilt", "cancelled"].includes(status) && (
                  <button
                    onClick={() => setApprovalOpen(true)}
                    disabled={sendingApproval}
                    className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
                  >
                    {approvalSent ? "Sendt ✓" : "Send til godkjenning"}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">

          {/* Approval banner */}
          {isPendingApproval && (() => {
            const approverName = adminName(row.approval_requested_from);
            const isApprover =
              row.approval_requested_from === adminName(user?.email) ||
              row.approval_requested_from?.toLowerCase() === user?.email?.toLowerCase();
            return (
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Venter godkjenning</p>
                <p className="mt-1 text-sm text-orange-800">
                  Sendt til <span className="font-semibold">{approverName}</span> for godkjenning.
                </p>
                {isApprover ? (
                  <div className="mt-3 space-y-2">
                    <button
                      onClick={handleApprove}
                      disabled={approvingCase || returningCase}
                      className="w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {approvingCase ? "Sender…" : "Godkjenn og send til kunde"}
                    </button>
                    {emailSendResult && (
                      <p className={`text-xs font-medium ${emailSendResult.success ? "text-green-700" : "text-red-600"}`}>
                        {emailSendResult.success ? "✓ " : "✗ "}{emailSendResult.message}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Kommentar ved retur (valgfri)"
                        value={returComment}
                        onChange={(e) => setReturComment(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleReturnCase()}
                        className="flex-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                      />
                      <button
                        onClick={handleReturnCase}
                        disabled={returningCase || approvingCase}
                        className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                      >
                        {returningCase ? "Sender…" : "Send i retur"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleCancelApproval}
                    className="mt-3 rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100 transition-colors"
                  >
                    Trekk tilbake
                  </button>
                )}
              </div>
            );
          })()}

          {/* Statuslogg */}
          {activityLog.filter(e => e.action_type === "status_change").length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Statuslogg</h2>
              <ol className="space-y-2">
                {activityLog
                  .filter(e => e.action_type === "status_change")
                  .map((entry) => {
                    const p = entry.payload as { from_status?: string; to_status?: string };
                    return (
                      <li key={entry.id} className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-gray-400 shrink-0 w-32">{formatDate(entry.created_at)}</span>
                        <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[p.from_status ?? ""] ?? "bg-gray-100 text-gray-500"}`}>
                          {STATUS_LABELS[p.from_status ?? ""] ?? p.from_status ?? "–"}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[p.to_status ?? ""] ?? "bg-gray-100 text-gray-500"}`}>
                          {STATUS_LABELS[p.to_status ?? ""] ?? p.to_status ?? "–"}
                        </span>
                        <span className="text-gray-400 ml-auto">{entry.actor_email}</span>
                      </li>
                    );
                  })}
              </ol>
            </div>
          )}

          {/* Customer */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">Kunde</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Lead kilde</span>
                <select value={leadSource} onChange={(e) => handleLeadSourceChange(e.target.value)}
                  disabled={savingLeadSource || isPendingApproval}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60">
                  <option value="">– Ukjent</option>
                  {leadSources.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {savingLeadSource && <span className="text-xs text-gray-400">Lagrer…</span>}
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
                <button onClick={handleSave} disabled={saving || !hasChanges || isPendingApproval} className="ml-auto rounded-lg bg-orange-500 px-3 py-1 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Lagrer…" : "Lagre"}</button>
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
                          disabled={isPendingApproval}
                          className={`ml-2 rounded border px-1.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-orange-400 disabled:opacity-70 disabled:cursor-not-allowed ${v === "Ja" ? "text-green-600 bg-green-50 border-green-200" : v === "Nei" ? "text-red-500 bg-red-50 border-red-200" : "text-gray-500 bg-gray-50 border-gray-200"}`}
                        >
                          <option value="Ja">Ja</option>
                          <option value="Nei">Nei</option>
                          <option value="Vet ikke">Vet ikke</option>
                        </select>
                      </div>
                      {row.dibk_comments?.[k] && (
                        <p className="mt-1 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-200">
                          <span className="font-semibold">Kundens kommentar:</span> {row.dibk_comments[k]}
                        </p>
                      )}
                      <input
                        type="text"
                        placeholder="Admin-kommentar (vises i tilbudsbygger)"
                        value={dibkAdminComments[k] ?? ""}
                        onChange={(e) => setDibkAdminComments((prev) => ({ ...prev, [k]: e.target.value }))}
                        disabled={isPendingApproval}
                        className="mt-1.5 w-full rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-400 disabled:opacity-70"
                      />
                      {(unsaved || manualOverride || !!localDibkReasons[k]?.trim()) && (
                        unsaved ? (
                          <input
                            type="text"
                            placeholder="Grunn til endring (påkrevd)"
                            value={localDibkReasons[k] ?? ""}
                            onChange={(e) => setLocalDibkReasons((prev) => ({ ...prev, [k]: e.target.value }))}
                            disabled={isPendingApproval}
                            className="mt-1.5 w-full rounded border border-blue-300 bg-white px-2 py-1 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-70"
                          />
                        ) : (
                          <p className="mt-1.5 rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs text-blue-700">
                            <span className="font-semibold">Grunn:</span> {localDibkReasons[k] || activityLogReasons[k] || "–"}
                          </p>
                        )
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
                      <button onClick={() => removeManualDisp(i)} disabled={isPendingApproval} className="text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Fjern">
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
                disabled={isPendingApproval}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
              />
              <div className="relative">
                <input
                  type="number"
                  value={newDispAmount}
                  onChange={(e) => setNewDispAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addManualDisp()}
                  disabled={isPendingApproval}
                  className="w-28 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
                  title="Foreslått pris — kan overstyres"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">kr</span>
              </div>
              <button onClick={addManualDisp} disabled={!newDispDesc.trim() || !newDispAmount || isPendingApproval}
                className="rounded-lg bg-red-500 px-3 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-40">
                + Legg til
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">Foreslått pris: {dibkDispCount > 0 || manualDisps.length > 0 ? "2 000" : "8 000"} kr — kan overstyres i beløpsfeltet.</p>
            <div className="mt-3 flex justify-end">
              <button onClick={handleSave} disabled={saving || !hasChanges || isPendingApproval} className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Lagrer…" : "Lagre"}</button>
            </div>
          </div>

          {/* Pris */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Pris</h2>

            {/* Tegninger til søknaden picker */}
            <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-teal-700">Tegninger til søknaden</p>
              <div className="space-y-1.5">
                {TEGNING_OPTIONS.map(opt => {
                  const price = tegningPriser[opt.key];
                  const isActive = extraCosts.some(c => c.description === opt.label);
                  return (
                    <div
                      key={opt.key}
                      onClick={() => !isPendingApproval && toggleTegningCost(opt.label, price)}
                      className={`flex select-none items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${isPendingApproval ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${isActive ? "border-teal-400 bg-white shadow-sm" : "border-dashed border-teal-200 hover:border-teal-300"}`}
                    >
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${isActive ? "border-teal-500 bg-teal-500" : "border-teal-300 bg-white"}`}>
                        {isActive && (
                          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-gray-800">{opt.label}</p>
                        <p className="text-[10px] text-gray-500">{opt.description}</p>
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-xs font-bold text-teal-700">{new Intl.NumberFormat("nb-NO").format(price)} kr</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DIBK admin comments summary */}
            {Object.entries(dibkAdminComments).filter(([, v]) => v.trim()).length > 0 && (
              <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wide text-orange-600 mb-1.5">DIBK-notater</p>
                {Object.entries(dibkAdminComments).filter(([, v]) => v.trim()).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="shrink-0 font-semibold text-orange-700">{DIBK_LABELS[k] ?? k}:</span>
                    <span className="text-orange-800">{v}</span>
                  </div>
                ))}
              </div>
            )}

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
              {/* Tegning items — shown in picker above, listed here for totalling */}
              {extraCosts.filter(c => TEGNING_LABELS.has(c.description)).map((c, i) => (
                <div key={`teg-${i}`} className="flex items-center justify-between text-teal-700">
                  <span className="flex items-center gap-1.5">
                    <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-600">Tegning</span>
                    {c.description}
                  </span>
                  <span>{fmt(c.amount)}</span>
                </div>
              ))}
              {/* Other extra costs */}
              {extraCosts.filter(c => !TEGNING_LABELS.has(c.description)).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-gray-600">
                  <span>{c.description}</span>
                  <div className="flex items-center gap-2">
                    <span>{fmt(c.amount)}</span>
                    <button onClick={() => removeExtraCost(extraCosts.indexOf(c))} disabled={isPendingApproval} className="text-gray-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed" title="Fjern">
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
                disabled={isPendingApproval}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
              />
              <input
                type="number"
                placeholder="Beløp"
                value={newCostAmount}
                onChange={(e) => setNewCostAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExtraCost()}
                disabled={isPendingApproval}
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
              />
              <button onClick={addExtraCost} disabled={!newCostDesc.trim() || !newCostAmount || isPendingApproval}
                className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40">
                + Legg til
              </button>
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={handleSave} disabled={saving || !hasChanges || isPendingApproval} className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">{saving ? "Lagrer…" : "Lagre"}</button>
            </div>
          </div>

          {/* Søknadsresultat */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Søknadsresultat</h2>
            <p className="text-sm font-medium capitalize text-gray-700">{row.permit_result ?? "–"}</p>
          </div>

          {/* Notater + Lagre */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Notater</h2>

            {/* Tilbudsbeskrivelse */}
            <div className="mb-4">
              <p className="mb-1 text-[10px] font-medium text-gray-500">Tilbudsbeskrivelse (vises på PDF-tilbud)</p>
              <textarea
                rows={4}
                value={tilbudsbeskrivelse}
                onChange={(e) => setTilbudsbeskrivelse(e.target.value)}
                placeholder="Beskriv hva tilbudet inkluderer, spesielle vilkår, o.l.…"
                disabled={isPendingApproval}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
              />
              <div className="mt-1.5 flex gap-2">
                <button
                  onClick={handleSaveTilbudsbeskrivelse}
                  disabled={savingTilbud || isPendingApproval}
                  className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {savingTilbud ? "Lagrer…" : "Lagre beskrivelse"}
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {downloadingPdf ? "Genererer…" : "Last ned PDF"}
                </button>
              </div>
            </div>

            {/* Customer notes */}
            <div className="mb-4">
              <p className="mb-1 text-[10px] font-medium text-gray-400">Notat til kunde (vises på tilbud)</p>
              <textarea
                rows={3}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Notat som vises på tilbudet til kunden…"
                disabled={isPendingApproval}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-60"
              />
              <button
                onClick={handleSaveCustomerNotes}
                disabled={savingCustomerNotes || isPendingApproval}
                className="mt-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {savingCustomerNotes ? "Lagrer…" : "Lagre kundenotat"}
              </button>
            </div>

            {/* Internal notes */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[10px] font-medium text-red-400">Internt notat (kun for oss)</p>
                {!editingNotes && !isPendingApproval && (
                  <button onClick={() => setEditingNotes(true)} className="text-xs text-red-400 hover:text-red-600 font-medium">Endre</button>
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
                    className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 placeholder:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleSaveNotes}
                      disabled={savingNotes}
                      className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                    >
                      {savingNotes ? "Lagrer…" : "Lagre internt notat"}
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
                <div
                  onClick={() => setEditingNotes(true)}
                  className={`min-h-[2.5rem] cursor-text rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm whitespace-pre-wrap ${row.notes ? "text-red-700" : "text-red-300 italic"}`}
                >
                  {row.notes ? row.notes : "Ingen interne notater — klikk for å redigere"}
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button onClick={handleSave} disabled={saving || !hasChanges || isPendingApproval}
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
                disabled={uploading || pendingFiles.length > 0}
                className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                + Last opp
              </button>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
            </div>

            {/* Pending upload — label inputs */}
            {pendingFiles.length > 0 && (
              <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 p-3 space-y-2">
                <p className="text-xs font-medium text-orange-700">Gi vedleggene et navn før opplasting:</p>
                {pendingFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 truncate w-28 shrink-0">{file.name}</span>
                    <input
                      type="text"
                      value={pendingLabels[i] ?? ""}
                      onChange={(e) => setPendingLabels((prev) => { const next = [...prev]; next[i] = e.target.value; return next; })}
                      placeholder="Navn på vedlegg"
                      className="flex-1 rounded border border-orange-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={confirmUpload}
                    disabled={uploading}
                    className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    {uploading ? "Laster opp…" : "Last opp"}
                  </button>
                  <button
                    onClick={() => { setPendingFiles([]); setPendingLabels([]); setUploadError(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Avbryt
                  </button>
                </div>
              </div>
            )}

            {uploadError && (
              <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 flex items-start gap-2">
                <span className="shrink-0 font-bold">!</span>
                <span>{uploadError}</span>
                <button onClick={() => setUploadError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600">✕</button>
              </div>
            )}

            {/* Drop zone */}
            {pendingFiles.length === 0 && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`mb-3 flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-4 py-4 transition-colors ${dragOver ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-gray-50 hover:border-orange-300"}`}
              >
                <p className="text-xs text-gray-400">Slipp filer her, eller klikk for å velge</p>
              </div>
            )}

            {attachments.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Ingen vedlegg lastet opp ennå.</p>
            ) : (
              <ul className="space-y-1.5">
                {attachments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    {editingLabelId === a.id ? (
                      <div className="flex flex-1 items-center gap-2 mr-2">
                        <input
                          type="text"
                          value={editingLabelText}
                          onChange={(e) => setEditingLabelText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveAttachmentLabel(a, editingLabelText); if (e.key === "Escape") setEditingLabelId(null); }}
                          autoFocus
                          className="flex-1 rounded border border-orange-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                        />
                        <button onClick={() => saveAttachmentLabel(a, editingLabelText)} className="text-xs text-orange-600 font-medium">Lagre</button>
                        <button onClick={() => setEditingLabelId(null)} className="text-xs text-gray-400">Avbryt</button>
                      </div>
                    ) : (
                      <div className="flex flex-1 items-center gap-1.5 mr-2 min-w-0">
                        <span className="text-sm text-gray-700 truncate">{a.label}</span>
                        <button
                          onClick={() => { setEditingLabelId(a.id); setEditingLabelText(a.label); }}
                          className="shrink-0 text-gray-300 hover:text-gray-500"
                          title="Endre navn"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 15H9v-3z" /></svg>
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => downloadAttachment(a)} className="text-xs text-orange-600 hover:text-orange-800 font-medium">Last ned</button>
                      <button onClick={() => deleteAttachment(a)} className="text-gray-300 hover:text-red-500" title="Slett">
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
            {activityLog.filter(e => e.action_type !== "dibk_admin_comment").length === 0 ? (
              <p className="text-xs text-gray-400 italic">Ingen aktivitet ennå.</p>
            ) : (
              <ol className="relative border-l border-gray-200 space-y-4 ml-2">
                {activityLog.filter(e => e.action_type !== "dibk_admin_comment").map((entry) => {
                  const dotColor =
                    entry.action_type === "status_change" ? "bg-orange-400" :
                    entry.action_type === "approval_requested" ? "bg-purple-400" :
                    entry.action_type === "approval_rejected" ? "bg-amber-400" :
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
                        ) : entry.action_type === "approval_requested" ? (
                          <p className="text-purple-700 font-medium">
                            Sendt til godkjenning — <span className="font-semibold">{adminName((entry.payload as { to?: string }).to ?? "")}</span>
                          </p>
                        ) : entry.action_type === "approval_rejected" ? (
                          <div>
                            <p className="text-amber-700 font-medium">Sendt i retur</p>
                            {(entry.payload as { comment?: string }).comment && (
                              <p className="mt-0.5 text-gray-600 italic">"{(entry.payload as { comment?: string }).comment}"</p>
                            )}
                          </div>
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

      {/* Approval request modal */}
      {approvalOpen && row && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Send til godkjenning</h2>
            <p className="mt-1 text-sm text-gray-500">Velg hvem som skal godkjenne søknadshjelp-saken.</p>
            <div className="mt-4 space-y-2">
              {(Object.entries(ADMIN_NAMES) as [string, string][])
                .filter(([email]) => email !== user?.email?.toLowerCase())
                .map(([email, name]) => (
                  <button key={email} onClick={() => handleRequestApproval(email)}
                    disabled={sendingApproval}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700 transition-all disabled:opacity-50">
                    {sendingApproval ? "Sender…" : name}
                    {!sendingApproval && <span className="ml-2 text-xs font-normal text-gray-400">{email}</span>}
                  </button>
                ))}
            </div>
            <div className="mt-5">
              <button onClick={() => setApprovalOpen(false)}
                className="w-full rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convert confirmation modal */}
      {convertConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-gray-900">Konverter til søknadshjelp + byggpakke?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Dette oppretter en ny tilbudsforespørsel koblet til denne søknadshjelp-saken.
              Kunden og kontaktinfo kopieres over. Handlingen kan ikke angres.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConvertConfirm(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={() => { setConvertConfirm(false); handleConvertToQuote(); }}
                disabled={convertingToQuote}
                className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {convertingToQuote ? "Oppretter…" : "Ja, konverter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave confirmation modal */}
      {leaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Ulagrede endringer</h2>
            <p className="mt-1 text-sm text-gray-500">Du har endringer som ikke er lagret. Hva vil du gjøre?</p>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setLeaveConfirmOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Avbryt
              </button>
              <button
                onClick={async () => {
                  await handleSave();
                  hasUnsavedChangesRef.current = false;
                  setLeaveConfirmOpen(false);
                  if (pendingHref === "__back__") history.go(-1);
                  else router.push(pendingHref);
                }}
                disabled={saving || dibkReasonsMissing}
                className="flex-1 rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
                {saving ? "Lagrer…" : "Lagre og gå ut"}
              </button>
              <button onClick={() => {
                hasUnsavedChangesRef.current = false;
                setLeaveConfirmOpen(false);
                if (pendingHref === "__back__") history.go(-1);
                else router.push(pendingHref);
              }}
                className="flex-1 rounded-lg border border-red-200 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50">
                Forkast
              </button>
            </div>
            {dibkReasonsMissing && (
              <p className="mt-3 text-xs text-amber-600">Du må oppgi begrunnelse for DIBK-endringer før du kan lagre.</p>
            )}
          </div>
        </div>
      )}

      {/* Status change confirmation modal */}
      {statusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-gray-900">Endre status</h2>
            <div className="mt-3 space-y-1.5 rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Fra</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-500"}`}>{STATUS_LABELS[status] ?? status}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
                <span className="text-gray-500">Til</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[statusConfirm] ?? "bg-gray-100 text-gray-500"}`}>{STATUS_LABELS[statusConfirm] ?? statusConfirm}</span>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setStatusConfirm(null)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Avbryt
              </button>
              <button onClick={() => { const s = statusConfirm; setStatusConfirm(null); handleStatusChange(s); }} disabled={updatingStatus}
                className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                Bekreft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
