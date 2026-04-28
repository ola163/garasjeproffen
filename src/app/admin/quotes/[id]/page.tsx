"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import type { QuoteRow, LineItem, OfferSection, QuoteStatus } from "@/types/quote-admin";
import Link from "next/link";
import { adminName, ADMIN_NAMES } from "@/lib/admin-names";
import { read, utils } from "xlsx";

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
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Offer builder state
  const [offerSections, setOfferSections] = useState<OfferSection[]>([]);
  const [savedSections, setSavedSections] = useState<OfferSection[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string; paymentUrl?: string } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<QuoteStatus | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [statusLog, setStatusLog] = useState<{ id: string; from_status: string; to_status: string; changed_by: string; changed_at: string; note: string | null }[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [supplierForPrices, setSupplierForPrices] = useState("Optimera");
  const [lookingUpPrices, setLookingUpPrices] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  const [savePriceResult, setSavePriceResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dismissingAddressAlert, setDismissingAddressAlert] = useState(false);
  const [parsingPdf, setParsingPdf] = useState<number | null>(null);
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerEdit, setCustomerEdit] = useState({ name: "", email: "", phone: "", message: "", category: "", building_type: "" });
  const [savingCustomer, setSavingCustomer] = useState(false);

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
      const sections = q.offer_sections?.length
        ? q.offer_sections
        : (() => {
            const defaultItems = q.offer_line_items?.length ? q.offer_line_items : buildDefaultLineItems(q);
            const cat = q.category ?? "materialpakke";
            return defaultItems.length > 0 ? [{ category: cat, line_items: defaultItems, notes: q.offer_notes ?? "" }] : [];
          })();
      setOfferSections(sections);
      setSavedSections(sections);
      if (q.status === "new") setClaimOpen(true);
    }
    if (logData) setStatusLog(logData);
    setLoading(false);
  }

  const hasUnsavedChanges = JSON.stringify(offerSections) !== JSON.stringify(savedSections);
  const hasUnsavedChangesRef = useRef(false);
  hasUnsavedChangesRef.current = hasUnsavedChanges;

  function computeDiffs(current: OfferSection[], saved: OfferSection[]) {
    const CAT = OFFER_CATEGORIES.reduce((m, c) => { m[c.id] = c.label; return m; }, {} as Record<string, string>);
    const diffs: { label: string; old: string; new: string }[] = [];
    saved.forEach(s => {
      if (!current.find(c => c.category === s.category))
        diffs.push({ label: "Seksjon fjernet", old: CAT[s.category] ?? s.category, new: "–" });
    });
    current.forEach(s => {
      if (!saved.find(c => c.category === s.category))
        diffs.push({ label: "Seksjon lagt til", old: "–", new: CAT[s.category] ?? s.category });
    });
    current.forEach(cs => {
      const ss = saved.find(s => s.category === cs.category);
      if (!ss) return;
      const catLabel = CAT[cs.category] ?? cs.category;
      const maxLen = Math.max(cs.line_items.length, ss.line_items.length);
      for (let i = 0; i < maxLen; i++) {
        const ci = cs.line_items[i];
        const si = ss.line_items[i];
        if (!si && ci)  { diffs.push({ label: `${catLabel} – ny linje`, old: "–", new: ci.description || `${formatNOK(ci.amount)} × ${ci.quantity}` }); continue; }
        if (si && !ci)  { diffs.push({ label: `${catLabel} – linje fjernet`, old: si.description || `${formatNOK(si.amount)} × ${si.quantity}`, new: "–" }); continue; }
        if (si && ci) {
          if (si.description !== ci.description) diffs.push({ label: `${catLabel} – beskrivelse`, old: si.description || "–", new: ci.description || "–" });
          if (si.amount !== ci.amount) diffs.push({ label: `${catLabel} – pris`, old: formatNOK(si.amount), new: formatNOK(ci.amount) });
          if (si.quantity !== ci.quantity) diffs.push({ label: `${catLabel} – mengde`, old: String(si.quantity), new: String(ci.quantity) });
        }
      }
      if ((ss.notes ?? "") !== (cs.notes ?? ""))
        diffs.push({ label: `${catLabel} – notat`, old: ss.notes || "–", new: cs.notes || "–" });
    });
    return diffs;
  }

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (hasUnsavedChanges) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    // Intercept all anchor clicks (header links, any <Link> on the page)
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

    // Intercept browser back/forward button
    function onPopState() {
      if (!hasUnsavedChangesRef.current) return;
      window.history.pushState(null, "", window.location.href);
      setPendingHref("__back__");
      setLeaveConfirmOpen(true);
    }
    window.addEventListener("popstate", onPopState);

    // Intercept programmatic Next.js navigation (router.push etc.)
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
    if (hasUnsavedChanges) { setPendingHref(href); setLeaveConfirmOpen(true); }
    else router.push(href);
  }

  async function handleManualSave() {
    if (!supabase || !quote) return;
    setSaving(true);
    await supabase.from("quotes").update({ offer_sections: offerSections }).eq("id", quote.id);
    setSavedSections(JSON.parse(JSON.stringify(offerSections)));
    hasUnsavedChangesRef.current = false;
    setSaving(false);
    setSaveOk(true);
    setTimeout(() => setSaveOk(false), 2500);
  }

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

  const OFFER_CATEGORIES = [
    { id: "søknadshjelp", label: "Søknadshjelp" },
    { id: "materialpakke", label: "Materialpakke" },
    { id: "prefabelement", label: "Prefabelement" },
  ];

  const SOKNADSHJELP_TEMPLATE: LineItem[] = [
    { description: "Tegnearbeid", amount: 5000, quantity: 1 },
    { description: "Nabovarsel", amount: 3000, quantity: 1 },
    { description: "Dispensasjon", amount: 0, quantity: 1 },
  ];

  const PREFAB_TEMPLATE: LineItem[] = [
    { description: "Bindingsverk av tre, uisolert", enhet: "m²", quantity: 31, amount: 1534.71 },
    { description: "Gesims forkant, panel, netting, spikerslag, fugleband", enhet: "lm", quantity: 20, amount: 1525.33 },
    { description: "Gesimsavslutning, flate tak inkl. beslag", enhet: "lm", quantity: 7, amount: 4249.28 },
    { description: "Limtredrager, gran, 90x315", enhet: "lm", quantity: 6, amount: 1275.00 },
    { description: "Limtresøyle, gran, beslag, 90x90x2500", enhet: "stk", quantity: 2, amount: 1679.98 },
    { description: "Nedløp for takrenne, stål plastisert 85mm", enhet: "lm", quantity: 3, amount: 489.23 },
    { description: "Sluk inkl rør for flate tak", enhet: "stk", quantity: 1, amount: 171.67 },
    { description: "Sperretak av I-bjelker, papptekking, gipsplater innv.", enhet: "m²", quantity: 42, amount: 1643.04 },
    { description: "Takrenner, stål plastisert, 125mm", enhet: "lm", quantity: 7, amount: 937.10 },
    { description: "Vindu, trevegg fastkarm 10x20", enhet: "stk", quantity: 4, amount: 22856.66 },
  ];

  function addSection(category: string) {
    const defaultItems: LineItem[] =
      category === "søknadshjelp"
        ? SOKNADSHJELP_TEMPLATE.map((item) => ({ ...item }))
        : [{ description: "", amount: 0, quantity: 1 }];
    setOfferSections((prev) => [...prev, { category, line_items: defaultItems, notes: "" }]);
  }

  function loadPrefabTemplate(sIdx: number) {
    setOfferSections((prev) =>
      prev.map((s, i) =>
        i === sIdx
          ? { ...s, line_items: [...s.line_items.filter((l) => l.description || l.amount), ...PREFAB_TEMPLATE.map((item) => ({ ...item }))] }
          : s
      )
    );
  }

  function removeSection(sIdx: number) {
    setOfferSections((prev) => prev.filter((_, i) => i !== sIdx));
  }

  function addLineItemToSection(sIdx: number) {
    const section = offerSections[sIdx];
    const newItem: LineItem = section?.category === "materialpakke"
      ? { description: "", amount: 0, quantity: 1, varenr: "", dimensjon: "", enhet: "" }
      : { description: "", amount: 0, quantity: 1 };
    setOfferSections((prev) => prev.map((s, i) => i === sIdx
      ? { ...s, line_items: [...s.line_items, newItem] }
      : s));
  }

  function updateLineItemInSection(sIdx: number, iIdx: number, field: keyof LineItem, value: string | number) {
    setOfferSections((prev) => prev.map((s, i) => i === sIdx
      ? { ...s, line_items: s.line_items.map((item, j) => j === iIdx ? { ...item, [field]: value } : item) }
      : s));
  }

  function removeLineItemFromSection(sIdx: number, iIdx: number) {
    setOfferSections((prev) => prev.map((s, i) => i === sIdx
      ? { ...s, line_items: s.line_items.filter((_, j) => j !== iIdx) }
      : s));
  }

  function updateSectionNotes(sIdx: number, notes: string) {
    setOfferSections((prev) => prev.map((s, i) => i === sIdx ? { ...s, notes } : s));
  }

  // ── Price lookup from supplier database ──────────────────────────────────────
  async function lookupPriceForItem(sIdx: number, iIdx: number, varenr: string) {
    if (!varenr.trim()) return;
    const res  = await fetch(`/api/admin/supplier-prices?supplier=${encodeURIComponent(supplierForPrices)}&q=${encodeURIComponent(varenr)}&limit=1`);
    const json = await res.json();
    const hit  = json.data?.[0];
    if (!hit) return;
    setOfferSections(prev => prev.map((s, si) => si !== sIdx ? s : {
      ...s,
      line_items: s.line_items.map((item, ii) => ii !== iIdx ? item : {
        ...item,
        description: item.description || hit.varebenevnelse,
        dimensjon:   item.dimensjon   || hit.dimensjon || "",
        enhet:       item.enhet       || hit.enhet     || "",
        amount:      hit.bruttopris,
      }),
    }));
  }

  async function savePricesToDatabase(sIdx: number) {
    const section = offerSections[sIdx];
    if (!section) return;
    const rows = section.line_items
      .filter(item => item.varenr?.trim() && item.amount > 0)
      .map(item => ({
        supplier:       supplierForPrices,
        varenr:         item.varenr!.trim(),
        varebenevnelse: item.description || "",
        dimensjon:      item.dimensjon || undefined,
        enhet:          item.enhet     || undefined,
        bruttopris:     item.amount,
        nettopris:      item.amount,
        antall:         item.quantity  || 1,
        mva_pst:        25,
      }));
    if (!rows.length) {
      setSavePriceResult({ ok: false, text: "Ingen rader med varenr og pris å lagre." });
      return;
    }
    setSavingPrices(true); setSavePriceResult(null);
    const res  = await fetch("/api/admin/supplier-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ supplier: supplierForPrices, rows }),
    });
    const json = await res.json();
    setSavingPrices(false);
    setSavePriceResult(res.ok
      ? { ok: true,  text: `${json.inserted} varer lagret til ${supplierForPrices}` }
      : { ok: false, text: json.error ?? "Feil ved lagring" }
    );
    setTimeout(() => setSavePriceResult(null), 4000);
  }

  async function lookupAllPricesInSection(sIdx: number) {
    const section = offerSections[sIdx];
    if (!section) return;
    setLookingUpPrices(true);
    const items = [...section.line_items];
    for (let iIdx = 0; iIdx < items.length; iIdx++) {
      const varenr = items[iIdx].varenr?.trim();
      if (!varenr) continue;
      const res  = await fetch(`/api/admin/supplier-prices?supplier=${encodeURIComponent(supplierForPrices)}&q=${encodeURIComponent(varenr)}&limit=1`);
      const json = await res.json();
      const hit  = json.data?.[0];
      if (!hit) continue;
      items[iIdx] = {
        ...items[iIdx],
        description: items[iIdx].description || hit.varebenevnelse,
        dimensjon:   items[iIdx].dimensjon   || hit.dimensjon || "",
        enhet:       items[iIdx].enhet       || hit.enhet     || "",
        amount:      hit.bruttopris,
      };
    }
    setOfferSections(prev => prev.map((s, si) => si !== sIdx ? s : { ...s, line_items: items }));
    setLookingUpPrices(false);
  }

  async function handleExcelUpload(sIdx: number, file: File) {
    const data = await file.arrayBuffer();
    const wb = read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const items: LineItem[] = [];
    const isMatpak = offerSections[sIdx]?.category === "materialpakke";
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      const varenr     = String(row[0] ?? "").trim();
      const benevnelse = String(row[1] ?? "").trim();
      const dimensjon  = String(row[2] ?? "").trim();
      const enhet      = String(row[3] ?? "").trim();
      const mengde     = parseFloat(String(row[4] ?? "")) || 1;
      if (!benevnelse) continue;
      if (isMatpak) {
        items.push({ description: benevnelse, varenr, dimensjon, enhet, quantity: mengde, amount: 0 });
      } else {
        const parts = [varenr, benevnelse, dimensjon].filter(Boolean);
        const description = parts.join(" – ") + (enhet ? ` (${enhet})` : "");
        items.push({ description, quantity: mengde, amount: 0 });
      }
    }
    if (items.length === 0) return;
    setOfferSections((prev) => prev.map((s, i) =>
      i === sIdx ? { ...s, line_items: [...s.line_items.filter(l => l.description || l.amount), ...items] } : s
    ));
  }

  async function handlePdfUpload(sIdx: number, file: File) {
    setParsingPdf(sIdx);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/parse-pdf", { method: "POST", body: fd });
      if (!res.ok) { alert("PDF-analyse feilet."); return; }
      const items: { varenr: string; description: string; quantity: number; enhet: string; amount: number }[] = await res.json();
      if (!items.length) { alert("Ingen varelinjer funnet i PDF-en."); return; }
      const isMatpak = offerSections[sIdx]?.category === "materialpakke";
      const lineItems = items.map((item) =>
        isMatpak
          ? { description: item.description, varenr: item.varenr ?? "", dimensjon: "", enhet: item.enhet ?? "", quantity: item.quantity ?? 1, amount: item.amount ?? 0 }
          : { description: [item.varenr, item.description].filter(Boolean).join(" – "), quantity: item.quantity ?? 1, amount: item.amount ?? 0 }
      );
      setOfferSections((prev) => prev.map((s, i) =>
        i === sIdx ? { ...s, line_items: [...s.line_items.filter((l) => l.description || l.amount), ...lineItems] } : s
      ));
    } finally {
      setParsingPdf(null);
    }
  }

  async function handleDeleteQuote() {
    if (!supabase || !user) return;
    setDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/delete-quote", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({ quoteId: id }),
    });
    setDeleting(false);
    if (res.ok) {
      router.push("/admin/quotes");
    } else {
      const data = await res.json();
      alert(data.error ?? "Sletting feilet.");
    }
  }

  function openEditCustomer() {
    if (!quote) return;
    setCustomerEdit({
      name: quote.customer_name,
      email: quote.customer_email,
      phone: quote.customer_phone ?? "",
      message: quote.customer_message ?? "",
      category: quote.category ?? "",
      building_type: quote.building_type ?? "",
    });
    setEditingCustomer(true);
  }

  async function handleSaveCustomer() {
    if (!supabase || !quote) return;
    setSavingCustomer(true);
    await supabase.from("quotes").update({
      customer_name: customerEdit.name,
      customer_email: customerEdit.email,
      customer_phone: customerEdit.phone || null,
      customer_message: customerEdit.message || null,
      category: customerEdit.category || null,
      building_type: customerEdit.building_type || null,
    }).eq("id", quote.id);
    setQuote((prev) => prev ? {
      ...prev,
      customer_name: customerEdit.name,
      customer_email: customerEdit.email,
      customer_phone: customerEdit.phone || null,
      customer_message: customerEdit.message || null,
      category: customerEdit.category || null,
      building_type: customerEdit.building_type || null,
    } : null);
    setSavingCustomer(false);
    setEditingCustomer(false);
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
    if (!quote || !user || !e.target.files?.length) return;
    setUploadingFile(true);
    const formData = new FormData();
    formData.append("adminEmail", user.email ?? "");
    formData.append("ticketNumber", quote.ticket_number);
    formData.append("quoteId", quote.id);
    for (const file of Array.from(e.target.files)) {
      formData.append("files", file);
    }
    try {
      const res = await fetch("/api/admin/upload-attachment", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) {
        setQuote((prev) => prev ? { ...prev, attachments: data.all } : null);
      } else {
        alert(`Opplasting feilet: ${data.error}`);
      }
    } catch {
      alert("Nettverksfeil ved opplasting.");
    }
    e.target.value = "";
    setUploadingFile(false);
  }

  async function dismissAddressAlert() {
    if (!supabase || !quote) return;
    setDismissingAddressAlert(true);
    await supabase.from("quotes").update({ address_change_note: null }).eq("id", quote.id);
    setQuote((prev) => prev ? { ...prev, address_change_note: null } : null);
    setDismissingAddressAlert(false);
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
        offerTotal,
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
        body: JSON.stringify({ quoteId: quote.id, offerSections, adminEmail: user.email, customerEmail: quote.customer_email, customerName: quote.customer_name, ticketNumber: quote.ticket_number }),
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

  function getEffectiveItems(section: OfferSection): LineItem[] {
    const sok = offerSections.find((s) => s.category === "søknadshjelp");
    const mat = offerSections.find((s) => s.category === "materialpakke");
    if (section.category === "prefabelement") {
      return [...(sok?.line_items ?? []), ...(mat?.line_items ?? []), ...section.line_items];
    }
    if (section.category === "materialpakke") {
      return [...(sok?.line_items ?? []), ...section.line_items];
    }
    return section.line_items;
  }

  const hasPrefa = offerSections.some((s) => s.category === "prefabelement");
  const hasMatpak = offerSections.some((s) => s.category === "materialpakke");
  const offerTotal = offerSections.reduce((total, sec) => {
    if (hasPrefa && sec.category === "materialpakke") return total;
    if ((hasPrefa || hasMatpak) && sec.category === "søknadshjelp") return total;
    return total + getEffectiveItems(sec).reduce((s, item) => s + (item.amount || 0) * (item.quantity || 1), 0);
  }, 0);

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
            <button onClick={() => navigate("/admin/quotes")} className="text-gray-400 hover:text-gray-600">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
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

          <div className="flex items-center gap-2">
            {quote.status === "cancelled" ? (
              <button
                onClick={() => setDeleteOpen(true)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                Slett
              </button>
            ) : (
              <span title="Kanseller forespørselen før sletting" className="cursor-not-allowed rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-300">
                Slett
              </span>
            )}
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

        {/* Address change alert */}
        {quote.address_change_note && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800">Adresse endret etter innsendelse</p>
              <p className="mt-0.5 text-sm text-amber-700">{quote.address_change_note}</p>
            </div>
            <button
              onClick={dismissAddressAlert}
              disabled={dismissingAddressAlert}
              className="shrink-0 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-colors"
            >
              Sett som lest
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Left: customer + config */}
          <div className="space-y-5">
            {/* Customer */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Kunde</h2>
                {!editingCustomer && (
                  <button onClick={openEditCustomer} className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                    Rediger
                  </button>
                )}
              </div>

              {editingCustomer ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Type bygg</label>
                      <select value={customerEdit.building_type} onChange={(e) => setCustomerEdit((p) => ({ ...p, building_type: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                        <option value="">–</option>
                        <option value="garasje">Garasje</option>
                        <option value="carport">Carport</option>
                        <option value="uthus">Uthus</option>
                        <option value="næringsbygg">Næringsbygg</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Kategori</label>
                      <select value={customerEdit.category} onChange={(e) => setCustomerEdit((p) => ({ ...p, category: e.target.value }))}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                        <option value="">–</option>
                        <option value="søknadshjelp">Søknadshjelp</option>
                        <option value="materialpakke">Materialpakke</option>
                        <option value="prefabelement">Prefabelement</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Navn *</label>
                    <input type="text" required value={customerEdit.name} onChange={(e) => setCustomerEdit((p) => ({ ...p, name: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">E-post *</label>
                    <input type="email" required value={customerEdit.email} onChange={(e) => setCustomerEdit((p) => ({ ...p, email: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Telefon</label>
                    <input type="tel" value={customerEdit.phone} onChange={(e) => setCustomerEdit((p) => ({ ...p, phone: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Melding</label>
                    <textarea rows={3} value={customerEdit.message} onChange={(e) => setCustomerEdit((p) => ({ ...p, message: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditingCustomer(false)}
                      className="flex-1 rounded-lg border border-gray-300 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      Avbryt
                    </button>
                    <button onClick={handleSaveCustomer} disabled={savingCustomer || !customerEdit.name || !customerEdit.email}
                      className="flex-1 rounded-lg bg-orange-500 py-2 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
                      {savingCustomer ? "Lagrer…" : "Lagre"}
                    </button>
                  </div>
                </div>
              ) : (
                <dl className="space-y-2 text-sm">
                  {(quote.building_type || quote.category) && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {quote.building_type && (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 capitalize">{quote.building_type}</span>
                      )}
                      {quote.category && (
                        <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700 capitalize">{quote.category}</span>
                      )}
                    </div>
                  )}
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
              )}
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
                <div className="flex items-center gap-2">
                  {hasUnsavedChanges && <span className="text-xs text-amber-600 font-medium">● Ulagrede endringer</span>}
                  {saveOk && !hasUnsavedChanges && <span className="text-xs text-green-600">Lagret ✓</span>}
                  <a
                    href={`/admin/quotes/${id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => setSaveConfirmOpen(true)}
                    disabled={saving || !hasUnsavedChanges}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    {saving ? "Lagrer…" : "Lagre"}
                  </button>
                </div>
              </div>

              {/* Category toggles */}
              <div className="mb-5 flex flex-wrap gap-2">
                {OFFER_CATEGORIES.map((c) => {
                  const isActive = offerSections.some((s) => s.category === c.id);
                  const sIdx = offerSections.findIndex((s) => s.category === c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => isActive ? removeSection(sIdx) : addSection(c.id)}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                        isActive
                          ? "border-orange-500 bg-orange-500 text-white"
                          : "border-gray-300 text-gray-600 hover:border-orange-400 hover:text-orange-600"
                      }`}
                    >
                      {isActive && (
                        <svg className="h-3 w-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                      {c.label}
                    </button>
                  );
                })}
              </div>

              {offerSections.length === 0 && (
                <p className="mb-4 text-xs text-gray-400 italic">Velg én eller flere kategorier over for å bygge tilbudet.</p>
              )}

              {offerSections.map((section, sIdx) => {
                const effectiveItems = getEffectiveItems(section);
                const sectionTotal = effectiveItems.reduce((s, item) => s + (item.amount || 0) * (item.quantity || 1), 0);
                const catLabel = OFFER_CATEGORIES.find(c => c.id === section.category)?.label ?? section.category;
                const sokItems = (section.category === "materialpakke" || section.category === "prefabelement")
                  ? (offerSections.find((s) => s.category === "søknadshjelp")?.line_items ?? [])
                  : [];
                const inheritedItems = section.category === "prefabelement"
                  ? (offerSections.find((s) => s.category === "materialpakke")?.line_items ?? [])
                  : [];

                return (
                  <div key={sIdx} className="mb-4 rounded-lg border border-gray-200 overflow-hidden">
                    {/* Section header */}
                    <div className="flex items-center justify-between bg-gray-50 px-3 py-2 flex-wrap gap-2">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{catLabel}</span>
                      <div className="flex items-center gap-2 ml-auto">
                        {section.category === "materialpakke" && (
                          <select
                            value={supplierForPrices}
                            onChange={e => setSupplierForPrices(e.target.value)}
                            className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-orange-400"
                          >
                            {["Optimera", "XLBygg", "Coop Obs Bygg", "Neumann"].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        )}
                        <button onClick={() => removeSection(sIdx)}
                          className="text-gray-400 hover:text-red-500 transition-colors text-xs">
                          Fjern
                        </button>
                      </div>
                    </div>

                    <div className="p-3 space-y-2">
                      {/* Inherited Søknadshjelp items (Materialpakke and Prefabelement) */}
                      {sokItems.length > 0 && (
                        <div className="mb-2 rounded-lg bg-green-50 border border-green-100 p-2">
                          <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-1.5">
                            Byggesøknad fra Søknadshjelp ({sokItems.length} linjer)
                          </p>
                          {sokItems.map((item, iIdx) => (
                            <div key={iIdx} className="flex gap-2 items-center py-0.5 opacity-60">
                              <span className="flex-1 truncate text-xs text-gray-600">{item.description || "–"}</span>
                              <span className="w-14 text-center text-xs text-gray-500">{item.quantity}</span>
                              <span className="w-28 text-right text-xs text-gray-500">
                                {item.amount ? new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(item.amount * item.quantity) : "–"}
                              </span>
                              <span className="w-4" />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inherited Materialpakke items (Prefabelement only) */}
                      {inheritedItems.length > 0 && (
                        <div className="mb-2 rounded-lg bg-blue-50 border border-blue-100 p-2">
                          <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1.5">
                            Materialer fra Materialpakke ({inheritedItems.length} linjer)
                          </p>
                          {inheritedItems.map((item, iIdx) => (
                            <div key={iIdx} className="flex gap-2 items-center py-0.5 opacity-60">
                              <span className="flex-1 truncate text-xs text-gray-600">{item.description || "–"}</span>
                              <span className="w-14 text-center text-xs text-gray-500">{item.quantity}</span>
                              <span className="w-28 text-right text-xs text-gray-500">
                                {item.amount ? new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(item.amount * item.quantity) : "–"}
                              </span>
                              <span className="w-4" />
                            </div>
                          ))}
                        </div>
                      )}
                      {section.category === "prefabelement" && inheritedItems.length === 0 && (
                        <div className="mb-2 rounded-lg bg-gray-50 border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-400">
                          Aktiver Materialpakke for å inkludere materialer automatisk.
                        </div>
                      )}

                      {/* Editable line items */}
                      {section.category === "prefabelement" && section.line_items.length > 0 && (
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                          {inheritedItems.length > 0 ? "Tillegg (montering, transport o.l.)" : "Prefab-kostnader"}
                        </p>
                      )}
                      {section.line_items.map((item, iIdx) =>
                        section.category === "materialpakke" ? (
                          /* Materialpakke: 3-rad layout */
                          <div key={iIdx} className="rounded-lg border border-gray-100 bg-gray-50 p-2 space-y-1.5">
                            {/* Rad 1: Varenr + Hent pris + Benevnelse + Fjern */}
                            <div className="flex gap-1.5 items-center">
                              <input
                                type="text" placeholder="Varenr"
                                value={item.varenr ?? ""}
                                onChange={(e) => updateLineItemInSection(sIdx, iIdx, "varenr", e.target.value)}
                                onBlur={(e) => { if (e.target.value) lookupPriceForItem(sIdx, iIdx, e.target.value); }}
                                className="w-20 shrink-0 rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <button
                                title={`Hent pris fra ${supplierForPrices}`}
                                onClick={() => lookupPriceForItem(sIdx, iIdx, item.varenr ?? "")}
                                className="shrink-0 rounded border border-gray-200 bg-white p-1.5 text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-colors"
                              >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </button>
                              <input
                                type="text" placeholder="Varebenevnelse"
                                value={item.description}
                                onChange={(e) => updateLineItemInSection(sIdx, iIdx, "description", e.target.value)}
                                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <button onClick={() => removeLineItemFromSection(sIdx, iIdx)} className="shrink-0 text-gray-400 hover:text-red-500">
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                            {/* Rad 2: Dimensjon + Enhet + Mengde + Pris/enhet */}
                            <div className="flex gap-1.5 items-center">
                              <input
                                type="text" placeholder="Dimensjon"
                                value={item.dimensjon ?? ""}
                                onChange={(e) => updateLineItemInSection(sIdx, iIdx, "dimensjon", e.target.value)}
                                className="w-24 rounded border border-gray-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <input
                                type="text" placeholder="Enhet"
                                value={item.enhet ?? ""}
                                onChange={(e) => updateLineItemInSection(sIdx, iIdx, "enhet", e.target.value)}
                                className="w-16 rounded border border-gray-300 px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <input
                                type="number" placeholder="Mengde" min={0} step={0.01}
                                value={item.quantity || ""}
                                onChange={(e) => updateLineItemInSection(sIdx, iIdx, "quantity", parseFloat(e.target.value) || 0)}
                                className="w-16 rounded border border-gray-300 px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                              <input
                                type="number" placeholder="Pris/enhet" min={0} step={0.01}
                                value={item.amount || ""}
                                onChange={(e) => updateLineItemInSection(sIdx, iIdx, "amount", parseFloat(e.target.value) || 0)}
                                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-orange-400"
                              />
                            </div>
                            {/* Rad 3: Totalsum */}
                            <div className="flex justify-end border-t border-gray-200 pt-1">
                              <span className="text-xs font-semibold text-gray-700">
                                {item.amount && item.quantity ? formatNOK(item.amount * item.quantity) : "–"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          /* Enkel form for Søknadshjelp og Prefabelement */
                          <div key={iIdx} className="flex gap-2 items-start">
                            <div className="flex-1 min-w-0">
                              <input type="text" placeholder="Beskrivelse" value={item.description}
                                onChange={(e) => updateLineItemInSection(sIdx, iIdx, "description", e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                            </div>
                            <div className="w-14 shrink-0">
                              <input type="number" min={0} step={0.01} placeholder="Ant." value={item.quantity || ""}
                                onChange={(e) => updateLineItemInSection(sIdx, iIdx, "quantity", parseFloat(e.target.value) || 1)}
                                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-orange-400" />
                            </div>
                            <div className="w-28 shrink-0">
                              <input type="number" min={0} placeholder="kr" value={item.amount || ""}
                                onChange={(e) => updateLineItemInSection(sIdx, iIdx, "amount", parseFloat(e.target.value) || 0)}
                                className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-400" />
                            </div>
                            <button onClick={() => removeLineItemFromSection(sIdx, iIdx)}
                              className="shrink-0 mt-1 text-gray-400 hover:text-red-500">
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        )
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => addLineItemToSection(sIdx)}
                          className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors">
                          + Legg til linje
                        </button>
                        {section.category === "materialpakke" && (
                          <button
                            type="button"
                            disabled={lookingUpPrices}
                            onClick={() => lookupAllPricesInSection(sIdx)}
                            className="flex items-center gap-1.5 rounded-lg border border-dashed border-orange-300 px-3 py-1.5 text-xs text-orange-500 hover:border-orange-500 hover:text-orange-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {lookingUpPrices
                              ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-orange-400 border-t-transparent" />
                              : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            }
                            Hent alle priser fra {supplierForPrices}
                          </button>
                        )}
                        {section.category === "materialpakke" && (
                          <button
                            type="button"
                            disabled={savingPrices}
                            onClick={() => savePricesToDatabase(sIdx)}
                            className="flex items-center gap-1.5 rounded-lg border border-dashed border-green-300 px-3 py-1.5 text-xs text-green-600 hover:border-green-500 hover:text-green-800 transition-colors disabled:opacity-50 whitespace-nowrap"
                          >
                            {savingPrices
                              ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                              : <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                            }
                            Lagre priser til {supplierForPrices}
                          </button>
                        )}
                        {savePriceResult && section.category === "materialpakke" && (
                          <span className={`text-xs font-medium ${savePriceResult.ok ? "text-green-600" : "text-red-500"}`}>
                            {savePriceResult.ok ? "✓ " : "✗ "}{savePriceResult.text}
                          </span>
                        )}
                        {section.category === "prefabelement" && (
                          <button type="button" onClick={() => loadPrefabTemplate(sIdx)}
                            className="rounded-lg border border-dashed border-blue-300 px-3 py-1.5 text-xs text-blue-500 hover:border-blue-500 hover:text-blue-700 transition-colors whitespace-nowrap">
                            Last inn standard mal
                          </button>
                        )}
                        {section.category !== "søknadshjelp" && (
                          <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors whitespace-nowrap">
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Last opp Excel
                            <input
                              type="file"
                              accept=".xlsx,.xls,.ods,.csv"
                              className="sr-only"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleExcelUpload(sIdx, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                        {section.category !== "søknadshjelp" && (
                          <label className={`flex cursor-pointer items-center gap-1 rounded-lg border border-dashed px-3 py-1.5 text-xs transition-colors whitespace-nowrap ${parsingPdf === sIdx ? "border-indigo-300 text-indigo-400 cursor-wait" : "border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-500"}`}>
                            {parsingPdf === sIdx ? (
                              <>
                                <svg className="h-3.5 w-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Analyserer PDF…
                              </>
                            ) : (
                              <>
                                <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Les PDF med AI
                              </>
                            )}
                            <input
                              type="file"
                              accept="application/pdf"
                              className="sr-only"
                              disabled={parsingPdf !== null}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handlePdfUpload(sIdx, file);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {/* Section notes */}
                      <textarea rows={2} value={section.notes}
                        onChange={(e) => updateSectionNotes(sIdx, e.target.value)}
                        placeholder="Notat for denne kategorien (valgfritt)…"
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />

                      {/* Section subtotal */}
                      <div className="flex justify-between text-xs font-medium text-gray-600 border-t border-gray-100 pt-2">
                        <span>
                          {catLabel}
                          {(sokItems.length > 0 || inheritedItems.length > 0) && (
                            <span className="ml-1 font-normal text-gray-400">
                              (inkl.{sokItems.length > 0 ? " søknadshjelp" : ""}{sokItems.length > 0 && inheritedItems.length > 0 ? " +" : ""}{inheritedItems.length > 0 ? " materialer" : ""})
                            </span>
                          )}
                        </span>
                        <span>{formatNOK(sectionTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Grand total */}
              <div className="rounded-lg bg-orange-50 px-4 py-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Totalt inkl. MVA</span>
                  <span className="text-lg font-bold text-gray-900">{formatNOK(offerTotal)}</span>
                </div>
                {hasPrefa && offerSections.some(s => s.category === "materialpakke") && (
                  <p className="mt-1 text-xs text-orange-500">Materialpakke er inkludert i Prefabelement og telles ikke separat.</p>
                )}
                {(hasPrefa || hasMatpak) && offerSections.some(s => s.category === "søknadshjelp") && (
                  <p className="mt-1 text-xs text-orange-500">Søknadshjelp er inkludert i {hasPrefa ? "Prefabelement" : "Materialpakke"} og telles ikke separat.</p>
                )}
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
                    <button onClick={() => setConfirmOpen(true)} disabled={sending}
                      className="mt-3 w-full rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                      {sending ? "Sender…" : "Godkjenn og send tilbud til kunde"}
                    </button>
                  )}
                </div>
              )}

              {/* Send til godkjenning / send på nytt */}
              {quote.status !== "pending_approval" && (
                <button
                  onClick={() => quote.status === "offer_sent" ? setConfirmOpen(true) : setApprovalOpen(true)}
                  disabled={sending || offerSections.length === 0 || offerTotal === 0 || quote.status === "paid" || quote.status === "cancelled"}
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

      {/* Delete confirmation modal */}
      {deleteOpen && quote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Slett forespørsel?</h2>
            <p className="mt-2 text-sm text-gray-500">
              Dette kan ikke angres. Forespørselen og all tilhørende historikk slettes permanent.
            </p>
            <div className="mt-3 rounded-lg bg-gray-50 px-4 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Ticket</span>
                <span className="font-mono font-semibold text-gray-900">{quote.ticket_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Kunde</span>
                <span className="font-medium text-gray-900">{quote.customer_name}</span>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setDeleteOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Avbryt
              </button>
              <button onClick={handleDeleteQuote} disabled={deleting}
                className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                {deleting ? "Sletter…" : "Ja, slett"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <span className="text-gray-500">Kategorier</span>
                <span className="text-gray-700">{offerSections.length}</span>
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
      {/* Save confirmation modal */}
      {saveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Lagre endringer</h2>
            <p className="mt-1 text-sm text-gray-500">Følgende endringer vil bli lagret:</p>
            {(() => {
              const diffs = computeDiffs(offerSections, savedSections);
              return diffs.length > 0 ? (
                <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {diffs.map((d, i) => (
                    <div key={i} className="px-3 py-2.5 text-xs">
                      <p className="font-semibold text-gray-700 mb-1">{d.label}</p>
                      <div className="flex gap-3">
                        <div className="flex-1 rounded bg-red-50 px-2 py-1 text-red-700 line-through truncate">{d.old}</div>
                        <svg className="h-4 w-4 shrink-0 self-center text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        <div className="flex-1 rounded bg-green-50 px-2 py-1 text-green-800 font-medium truncate">{d.new}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setSaveConfirmOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Avbryt
              </button>
              <button
                onClick={async () => { await handleManualSave(); setSaveConfirmOpen(false); }}
                disabled={saving}
                className="flex-1 rounded-lg bg-gray-900 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
                {saving ? "Lagrer…" : "Lagre"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Leave confirmation modal */}
      {leaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Ulagrede endringer</h2>
            <p className="mt-1 text-sm text-gray-500">Du har endringer som ikke er lagret. Hva vil du gjøre?</p>
            {(() => {
              const diffs = computeDiffs(offerSections, savedSections);
              return diffs.length > 0 ? (
                <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                  {diffs.map((d, i) => (
                    <div key={i} className="px-3 py-2.5 text-xs">
                      <p className="font-semibold text-gray-700 mb-1">{d.label}</p>
                      <div className="flex gap-3">
                        <div className="flex-1 rounded bg-red-50 px-2 py-1 text-red-700 line-through truncate">{d.old}</div>
                        <svg className="h-4 w-4 shrink-0 self-center text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                        <div className="flex-1 rounded bg-green-50 px-2 py-1 text-green-800 font-medium truncate">{d.new}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
            <div className="mt-5 flex gap-3">
              <button onClick={() => setLeaveConfirmOpen(false)}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Avbryt
              </button>
              <button
                onClick={async () => {
                  await handleManualSave();
                  setLeaveConfirmOpen(false);
                  if (pendingHref === "__back__") history.go(-1);
                  else router.push(pendingHref);
                }}
                disabled={saving}
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
                Forkast endringer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
