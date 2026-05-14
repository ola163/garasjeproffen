"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { adminName } from "@/lib/admin-names";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

interface ExtraCost { description: string; amount: number }
interface ManualDisp { description: string; amount: number }

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
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [row, setRow] = useState<SoknadshjelRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Admin fields
  const [notes, setNotes] = useState("");
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

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    supabase.from("soknadshjelp").select("*").eq("id", id).single().then(({ data }) => {
      if (data) {
        setRow(data as SoknadshjelRow);
        setNotes(data.notes ?? "");
        setStatus(data.status ?? "new");
        setAssignedTo(data.assigned_to ?? "");
        setExtraCosts(data.extra_costs ?? []);
        const md = data.manual_dispensasjoner ?? [];
        setManualDisps(md);
        const dibkCount = data.dibk
          ? Object.entries(data.dibk as Record<string, string>).filter(([k, v]) => isDispensasjon(k, v)).length
          : 0;
        setNewDispAmount(dibkCount > 0 || md.length > 0 ? "2000" : "8000");
      }
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
      const dibkCount = row?.dibk
        ? Object.entries(row.dibk).filter(([k, v]) => isDispensasjon(k, v)).length
        : 0;
      setNewDispAmount(dibkCount > 0 || next.length > 0 ? "2000" : "8000");
      return next;
    });
  }

  async function handleSave() {
    if (!supabase || !row) return;
    setSaving(true);
    const newTotal = (row.permit_price ?? 0) + manualDisps.reduce((s, d) => s + d.amount, 0) + extraCosts.reduce((s, c) => s + c.amount, 0);
    await supabase.from("soknadshjelp").update({
      status,
      assigned_to: assignedTo || null,
      notes: notes || null,
      extra_costs: extraCosts,
      manual_dispensasjoner: manualDisps,
      total_price: newTotal,
    }).eq("id", row.id);
    setSaving(false);
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
  const dibkDispCount = row.dibk ? Object.entries(row.dibk).filter(([k, v]) => isDispensasjon(k, v)).length : 0;
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
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Kunde</h2>
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
          {row.dibk && Object.keys(row.dibk).length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-700">DIBK-svar</h2>
                {dibkDispCount > 0 && (
                  <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    {dibkDispCount} dispensasjon{dibkDispCount > 1 ? "er" : ""}
                  </span>
                )}
              </div>
              <dl className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
                {Object.entries(row.dibk).map(([k, v]) => {
                  const isDisp = isDispensasjon(k, v);
                  return (
                    <div key={k} className={`flex items-center justify-between rounded-lg px-3 py-1.5 ${isDisp ? "bg-red-50 ring-1 ring-red-200" : "bg-gray-50"}`}>
                      <dt className="text-xs text-gray-500">
                        {DIBK_LABELS[k] ?? k}
                        {isDisp && <span className="ml-1.5 rounded bg-red-100 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-600">disp.</span>}
                      </dt>
                      <dd className={`text-xs font-semibold ${v === "Ja" ? "text-green-600" : "text-red-500"}`}>{v}</dd>
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
              <label className="mb-1 block text-xs font-medium text-gray-600">Notater</label>
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Interne notater..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <button onClick={handleSave} disabled={saving}
              className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50">
              {saving ? "Lagrer…" : "Lagre"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
