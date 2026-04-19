"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { QuoteRow, LineItem, QuoteStatus } from "@/types/quote-admin";
import Link from "next/link";
import { adminName, ADMIN_NAMES } from "@/lib/admin-names";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

const STATUS_LABELS: Record<QuoteStatus, string> = {
  new: "Ny", in_review: "Under behandling", pending_approval: "Venter godkjenning",
  offer_sent: "Tilbud sendt", paid: "Betalt", cancelled: "Kansellert",
};
const STATUS_COLORS: Record<QuoteStatus, string> = {
  new: "bg-blue-100 text-blue-700", in_review: "bg-yellow-100 text-yellow-700",
  pending_approval: "bg-orange-100 text-orange-700",
  offer_sent: "bg-purple-100 text-purple-700", paid: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};
const CATEGORY_LABELS: Record<string, string> = {
  door: "Dør 90×210", window1: "Vindu 100×50", window2: "Vindu 100×60", window3: "Vindu 100×100",
};
const WALL_LABELS: Record<string, string> = {
  front: "Frontvegg", back: "Bakvegg", left: "Venstre", right: "Høyre",
};
const PLACEMENT_LABELS: Record<string, string> = {
  left: "Venstre", right: "Høyre", both: "Begge",
};

function formatNOK(n: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("nb-NO", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Offer builder state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; paymentUrl?: string } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<QuoteStatus | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [uploadingFile, setUploadingFile] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);
  const [statusLog, setStatusLog] = useState<{ id: string; from_status: string; to_status: string; changed_by: string; changed_at: string; note: string | null }[]>([]);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
      if (data.user) loadQuote();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadQuote() {
    if (!supabase) return;
    const [{ data }, { data: logData }] = await Promise.all([
      supabase.from("quotes").select("*").eq("id", id).single(),
      supabase.from("quote_status_logs").select("*").eq("quote_id", id).order("changed_at", { ascending: false }),
    ]);
    if (data) {
      const q = data as QuoteRow;
      setQuote(q);
      setLineItems(q.offer_line_items?.length ? q.offer_line_items : buildDefaultLineItems(q));
      setNotes(q.offer_notes ?? "");
      if (q.status === "new") setClaimOpen(true);
    }
    if (logData) setStatusLog(logData);
    setLoading(false);
  }

  useEffect(() => {
    if (isInitialLoad.current) { isInitialLoad.current = false; return; }
    if (!supabase || !quote) return;
    const sb = supabase;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    setAutoSaveStatus("saving");
    autoSaveTimer.current = setTimeout(async () => {
      await sb.from("quotes").update({ offer_line_items: lineItems }).eq("id", quote.id);
      setAutoSaveStatus("saved");
      setTimeout(() => setAutoSaveStatus("idle"), 2000);
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems]);

  function buildDefaultLineItems(q: QuoteRow): LineItem[] {
    const pricing = q.pricing as { totalPrice?: number; basePrice?: number } | null;
    const items: LineItem[] = [];
    if (pricing?.basePrice) {
      items.push({ description: `${q.package_type === "prefab" ? "Prefabrikert løsning" : "Materialpakke"} – ${q.roof_type === "saltak" ? "Saltak" : "Flattak"}`, amount: pricing.basePrice, quantity: 1 });
    }
    const added = q.added_elements ?? [];
    if (added.length > 0) {
      items.push({ description: `Dører og vinduer (${added.length} stk)`, amount: 0, quantity: 1 });
    }
    return items;
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, { description: "", amount: 0, quantity: 1 }]);
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    setLineItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleStatusChange(newStatus: QuoteStatus) {
    if (!supabase || !quote || newStatus === quote.status) return;
    setUpdatingStatus(true);
    const oldStatus = quote.status;
    const assignedTo = newStatus === "in_review" ? adminName(user?.email)
      : (newStatus === "new" || newStatus === "cancelled") ? null
      : quote.assigned_to;
    await Promise.all([
      supabase.from("quotes").update({ status: newStatus }).eq("id", quote.id),
      supabase.from("quote_status_logs").insert({
        quote_id: quote.id,
        from_status: oldStatus,
        to_status: newStatus,
        changed_by: user?.email ?? "ukjent",
      }),
    ]);
    // assigned_to is saved separately so a missing column won't block the status save
    if (assignedTo !== quote.assigned_to) {
      await supabase.from("quotes").update({ assigned_to: assignedTo }).eq("id", quote.id);
    }
    const newEntry = { id: crypto.randomUUID(), from_status: oldStatus, to_status: newStatus, changed_by: user?.email ?? "ukjent", changed_at: new Date().toISOString(), note: null };
    setQuote((prev) => prev ? { ...prev, status: newStatus, assigned_to: assignedTo } : null);
    setStatusLog((prev) => [newEntry, ...prev]);
    setUpdatingStatus(false);
  }

  async function handleUploadAttachment(e: React.ChangeEvent<HTMLInputElement>) {
    if (!supabase || !quote || !e.target.files?.length) return;
    setUploadingFile(true);
    const newUrls: string[] = [];
    for (const file of Array.from(e.target.files)) {
      const path = `${quote.ticket_number}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("quote-attachments").upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("quote-attachments").getPublicUrl(path);
        newUrls.push(data.publicUrl);
      }
    }
    const updated = [...(quote.attachments ?? []), ...newUrls];
    await supabase.from("quotes").update({ attachments: updated }).eq("id", quote.id);
    setQuote((prev) => prev ? { ...prev, attachments: updated } : null);
    e.target.value = "";
    setUploadingFile(false);
  }

  async function handleDeleteAttachment(url: string) {
    if (!supabase || !quote) return;
    const updated = (quote.attachments ?? []).filter((u) => u !== url);
    await supabase.from("quotes").update({ attachments: updated }).eq("id", quote.id);
    setQuote((prev) => prev ? { ...prev, attachments: updated } : null);
  }

  async function handleRequestApproval(emailOverride?: string) {
    const approverEmail = emailOverride ?? approvalTarget;
    if (!supabase || !quote || !user || !approverEmail) return;
    const approverName = adminName(approverEmail);
    const requesterName = adminName(user.email);
    const now = new Date().toISOString();
    await Promise.all([
      supabase.from("quotes").update({
        status: "pending_approval",
        approval_requested_from: approverName,
        approval_requested_at: now,
      }).eq("id", quote.id),
      supabase.from("quote_status_logs").insert({
        quote_id: quote.id,
        from_status: quote.status,
        to_status: "pending_approval",
        changed_by: user.email ?? "ukjent",
      }),
    ]);
    await fetch("/api/admin/request-approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approverEmail,
        approverName,
        requesterName,
        ticketNumber: quote.ticket_number,
        customerName: quote.customer_name,
        offerTotal: lineItems.reduce((s, i) => s + i.amount * i.quantity, 0),
        quoteId: quote.id,
      }),
    });
    const newEntry = { id: crypto.randomUUID(), from_status: quote.status, to_status: "pending_approval" as QuoteStatus, changed_by: user.email ?? "ukjent", changed_at: now, note: null };
    setQuote((prev) => prev ? { ...prev, status: "pending_approval", approval_requested_from: approverName, approval_requested_at: now } : null);
    setStatusLog((prev) => [newEntry, ...prev]);
    setApprovalOpen(false);
    setApprovalTarget("");
  }

  async function handleSendOffer() {
    if (!user || !quote || !supabase) return;
    setSending(true); setSendResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/send-offer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ quoteId: quote.id, lineItems, notes, adminEmail: user.email, customerEmail: quote.customer_email, customerName: quote.customer_name, ticketNumber: quote.ticket_number }),
      });
      const data = await res.json();
      if (data.success) {
        setQuote((prev) => prev ? { ...prev, status: "offer_sent", offer_sent_at: new Date().toISOString() } : null);
        setSendResult({
          success: true,
          message: `Tilbud sendt til ${quote.customer_email}!`,
          paymentUrl: data.paymentUrl,
        });
      } else {
        setSendResult({ success: false, message: data.error ?? "Noe gikk galt." });
      }
    } catch {
      setSendResult({ success: false, message: "Nettverksfeil." });
    } finally {
      setSending(false);
    }
  }

  const offerTotal = lineItems.reduce((s, item) => s + (item.amount || 0) * (item.quantity || 1), 0);

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster...</div>;
  if (!supabase || !user || !ALLOWED_ADMINS.includes(user.email?.toLowerCase() ?? "")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Ikke tilgang. <Link href="/admin/quotes" className="text-orange-500 underline">Tilbake</Link></p>
      </div>
    );
  }
  if (!quote) return <div className="flex min-h-screen items-center justify-center text-gray-400">Fant ikke forespørselen.</div>;

  const p = (quote.configuration as { parameters?: Record<string, number> } | null)?.parameters;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/quotes" className="text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 font-mono">{quote.ticket_number}</h1>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[quote.status]}`}>
                  {STATUS_LABELS[quote.status]}
                </span>
                {quote.created_manually && (
                  <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">Manuelt opprettet</span>
                )}
              </div>
              <p className="text-xs text-gray-400">{formatDate(quote.created_at)}</p>
              {quote.assigned_to ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-gray-700">
                  <span className="inline-block h-2 w-2 rounded-full bg-orange-400"></span>
                  Behandles av <span className="text-orange-600 font-semibold">{quote.assigned_to}</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400 italic">Ingen behandler tildelt</p>
              )}
            </div>
          </div>

          {/* Status selector */}
          <div className="flex flex-wrap gap-1.5">
            {(["new","in_review","pending_approval","offer_sent","paid","cancelled"] as QuoteStatus[]).map((s) => (
              <button key={s} onClick={() => setStatusConfirm(s)} disabled={updatingStatus || s === quote.status}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all disabled:cursor-default ${
                  s === quote.status
                    ? STATUS_COLORS[s] + " ring-2 ring-offset-1 ring-current opacity-100"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-100"
                }`}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Left: customer + config */}
          <div className="space-y-5">
            {/* Customer */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">Kunde</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-500">Navn</dt><dd className="font-medium text-gray-900">{quote.customer_name}</dd></div>
                <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-500">E-post</dt><dd><a href={`mailto:${quote.customer_email}`} className="text-orange-500 hover:underline">{quote.customer_email}</a></dd></div>
                {quote.customer_phone && <div className="flex gap-2"><dt className="w-20 shrink-0 text-gray-500">Telefon</dt><dd className="text-gray-900">{quote.customer_phone}</dd></div>}
                {quote.customer_message && (
                  <div className="mt-3 rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500 mb-1">Melding</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{quote.customer_message}</p>
                  </div>
                )}
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-600">Vedlegg {quote.attachments?.length ? `(${quote.attachments.length})` : ""}</p>
                    <label className={`cursor-pointer rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors ${uploadingFile ? "opacity-50 pointer-events-none" : ""}`}>
                      {uploadingFile ? "Laster opp…" : "+ Last opp"}
                      <input type="file" multiple className="sr-only" onChange={handleUploadAttachment} disabled={uploadingFile} />
                    </label>
                  </div>
                  {quote.attachments && quote.attachments.length > 0 ? (
                    <ul className="space-y-1">
                      {quote.attachments.map((url, i) => {
                        const name = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? `Fil ${i + 1}`);
                        return (
                          <li key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5">
                            <a href={url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline truncate">
                              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              <span className="truncate">{name}</span>
                            </a>
                            <button onClick={() => handleDeleteAttachment(url)} className="ml-2 shrink-0 text-gray-300 hover:text-red-500 transition-colors">
                              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-gray-400 italic">Ingen vedlegg</p>
                  )}
                </div>
              </dl>
            </div>

            {/* Status log */}
            {statusLog.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">Statuslogg</h2>
                <ol className="relative border-l border-gray-200 space-y-3 ml-2">
                  {statusLog.map((entry) => (
                    <li key={entry.id} className="ml-4">
                      <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-orange-400" />
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[entry.from_status as QuoteStatus] ?? "bg-gray-100 text-gray-500"}`}>
                          {STATUS_LABELS[entry.from_status as QuoteStatus] ?? entry.from_status}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[entry.to_status as QuoteStatus] ?? "bg-gray-100 text-gray-500"}`}>
                          {STATUS_LABELS[entry.to_status as QuoteStatus] ?? entry.to_status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {formatDate(entry.changed_at)} · {entry.changed_by}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Configuration */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-gray-700 uppercase tracking-wide">Konfigurasjon</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex gap-2"><dt className="w-24 shrink-0 text-gray-500">Pakke</dt><dd className="text-gray-900">{quote.package_type === "prefab" ? "Prefabrikert løsning" : "Materialpakke"}</dd></div>
                <div className="flex gap-2"><dt className="w-24 shrink-0 text-gray-500">Taktype</dt><dd className="text-gray-900">{quote.roof_type === "saltak" ? "Saltak" : "Flattak"}</dd></div>
                {p && <>
                  <div className="flex gap-2"><dt className="w-24 shrink-0 text-gray-500">Bredde</dt><dd className="text-gray-900">{(p.width ?? 0) / 1000} m</dd></div>
                  <div className="flex gap-2"><dt className="w-24 shrink-0 text-gray-500">Lengde</dt><dd className="text-gray-900">{(p.length ?? 0) / 1000} m</dd></div>
                  <div className="flex gap-2"><dt className="w-24 shrink-0 text-gray-500">Portbredde</dt><dd className="text-gray-900">{p.doorWidth ?? "–"} mm</dd></div>
                  <div className="flex gap-2"><dt className="w-24 shrink-0 text-gray-500">Porthøyde</dt><dd className="text-gray-900">{p.doorHeight ?? "–"} mm</dd></div>
                </>}
              </dl>

              {(quote.added_elements?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Dører og vinduer ({quote.added_elements.length} stk)</p>
                  <ul className="space-y-1">
                    {quote.added_elements.map((el, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-400 shrink-0" />
                        {CATEGORY_LABELS[el.category] ?? el.category} – {WALL_LABELS[el.side] ?? el.side} ({PLACEMENT_LABELS[el.placement] ?? el.placement})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Original pricing */}
              {quote.pricing && (
                <div className="mt-4 rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500 mb-1">Prisestimat fra konfigurator</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatNOK((quote.pricing as { totalPrice?: number }).totalPrice ?? 0)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: offer builder */}
          <div className="space-y-5">
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Tilbudsbygger</h2>
                {autoSaveStatus === "saving" && <span className="text-xs text-gray-400">Lagrer…</span>}
                {autoSaveStatus === "saved" && <span className="text-xs text-green-500">Lagret ✓</span>}
              </div>

              {/* Line items */}
              <div className="space-y-2 mb-3">
                {lineItems.map((item, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        placeholder="Beskrivelse"
                        value={item.description}
                        onChange={(e) => updateLineItem(i, "description", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div className="w-14 shrink-0">
                      <input
                        type="number"
                        min={1}
                        placeholder="Ant."
                        value={item.quantity}
                        onChange={(e) => updateLineItem(i, "quantity", parseInt(e.target.value) || 1)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div className="w-28 shrink-0">
                      <input
                        type="number"
                        min={0}
                        placeholder="kr"
                        value={item.amount || ""}
                        onChange={(e) => updateLineItem(i, "amount", parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <button onClick={() => removeLineItem(i)}
                      className="shrink-0 mt-1 text-gray-400 hover:text-red-500">
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={addLineItem}
                className="mb-4 w-full rounded-lg border-2 border-dashed border-gray-300 py-2 text-xs text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors">
                + Legg til linje
              </button>

              {/* Total */}
              <div className="flex items-center justify-between rounded-lg bg-orange-50 px-4 py-3 mb-4">
                <span className="text-sm font-medium text-gray-700">Totalt inkl. MVA</span>
                <span className="text-lg font-bold text-gray-900">{formatNOK(offerTotal)}</span>
              </div>

              {/* Notes */}
              <div className="mb-4">
                <label className="mb-1 block text-xs font-medium text-gray-600">Notat til kunde (valgfritt)</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Spesielle vilkår, leveringstid, forbehold..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>

              {/* Send result */}
              {sendResult && (
                <div className={`mb-3 rounded-lg border p-3 text-sm ${sendResult.success ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                  <p>{sendResult.message}</p>
                  {sendResult.paymentUrl && (
                    <a href={sendResult.paymentUrl} target="_blank" rel="noopener noreferrer"
                      className="mt-1 block text-xs underline text-green-700">
                      Betalingslenke: {sendResult.paymentUrl}
                    </a>
                  )}
                </div>
              )}

              {/* Approval status banner */}
              {quote.status === "pending_approval" && (
                <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                  <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Venter godkjenning</p>
                  <p className="mt-1 text-sm text-orange-800">
                    Sendt til <span className="font-semibold">{quote.approval_requested_from}</span> for godkjenning.
                  </p>
                  {adminName(user?.email) === quote.approval_requested_from && (
                    <button
                      onClick={() => setConfirmOpen(true)}
                      disabled={sending}
                      className="mt-3 w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {sending ? "Sender…" : "Godkjenn og send tilbud til kunde"}
                    </button>
                  )}
                </div>
              )}

              {/* Send til godkjenning / send på nytt */}
              {quote.status !== "pending_approval" && (
                <button
                  onClick={() => quote.status === "offer_sent" ? setConfirmOpen(true) : setApprovalOpen(true)}
                  disabled={sending || lineItems.length === 0 || offerTotal === 0 || quote.status === "paid" || quote.status === "cancelled"}
                  className="w-full rounded-lg bg-orange-500 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {quote.status === "offer_sent" ? "Send tilbud på nytt" : "Send til godkjenning"}
                </button>
              )}

              {quote.offer_sent_at && (
                <p className="mt-2 text-center text-xs text-gray-400">
                  Sist sendt {formatDate(quote.offer_sent_at)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Approval request modal */}
      {approvalOpen && quote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Send til godkjenning</h2>
            <p className="mt-1 text-sm text-gray-500">Velg hvem som skal godkjenne tilbudet før det sendes til kunden.</p>
            <div className="mt-4 space-y-2">
              {(Object.entries(ADMIN_NAMES) as [string, string][])
                .filter(([email]) => email !== user?.email?.toLowerCase())
                .map(([email, name]) => (
                  <button key={email} onClick={() => handleRequestApproval(email)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-700 hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700 transition-all">
                    {name}
                    <span className="ml-2 text-xs font-normal text-gray-400">{email}</span>
                  </button>
                ))}
            </div>
            <div className="mt-5">
              <button onClick={() => { setApprovalOpen(false); setApprovalTarget(""); }}
                className="w-full rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Claim modal — shown automatically when quote is "new" */}
      {claimOpen && quote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Vil du behandle denne saken?</h2>
            <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Kunde</span>
                <span className="font-medium text-gray-900">{quote.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Referanse</span>
                <span className="font-mono text-gray-700">{quote.ticket_number}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
                <span className="text-gray-500">Behandles av</span>
                <span className="font-medium text-gray-900">{adminName(user?.email)}</span>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setClaimOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Ikke nå
              </button>
              <button onClick={() => { setClaimOpen(false); handleStatusChange("in_review"); }}
                className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
                Ja, ta over saken
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status change confirmation modal */}
      {statusConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Endre status?</h2>
            <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Fra</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[quote.status]}`}>{STATUS_LABELS[quote.status]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Til</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[statusConfirm]}`}>{STATUS_LABELS[statusConfirm]}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-1.5 mt-1.5">
                <span className="text-gray-500">Behandles av</span>
                <span className="font-medium text-gray-900">{adminName(user?.email)}</span>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setStatusConfirm(null)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
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

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Send tilbud?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Tilbudet vil bli sendt til:
            </p>
            <p className="mt-1 font-semibold text-orange-600">{quote.customer_email}</p>
            <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Totalt inkl. MVA</span>
                <span className="font-bold text-gray-900">{formatNOK(offerTotal)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-gray-500">Antall linjer</span>
                <span className="text-gray-700">{lineItems.length}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">Er du sikker på at tilbudet er klart til å sendes?</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Avbryt
              </button>
              <button
                onClick={() => { setConfirmOpen(false); handleSendOffer(); }}
                disabled={sending}
                className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                Ja, send tilbud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
