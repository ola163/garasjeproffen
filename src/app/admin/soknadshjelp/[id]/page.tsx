"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { adminName } from "@/lib/admin-names";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

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

export default function SoknadshjelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [row, setRow] = useState<SoknadshjelRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("new");
  const [assignedTo, setAssignedTo] = useState("");

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
      }
      setLoading(false);
    });
  }, [user, id]);

  async function handleSave() {
    if (!supabase || !row) return;
    setSaving(true);
    await supabase.from("soknadshjelp").update({
      status,
      assigned_to: assignedTo || null,
      notes: notes || null,
    }).eq("id", row.id);
    setSaving(false);
  }

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster...</div>;
  if (!supabase) return <div className="flex min-h-screen items-center justify-center text-gray-500">Supabase ikke konfigurert.</div>;

  if (!user) {
    router.push("/admin/quotes");
    return null;
  }

  if (!ALLOWED_ADMINS.includes(user.email?.toLowerCase() ?? "")) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Du har ikke tilgang.</p>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Forespørsel ikke funnet.</p>
      </div>
    );
  }

  const gc = row.garage_config as { lengthMm?: number; widthMm?: number; doorWidthMm?: number; doorHeightMm?: number } | null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">

        {/* Header */}
        <div className="mb-6">
          <Link href="/admin/quotes" className="text-sm text-orange-600 hover:text-orange-800">← Forespørsler</Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900">{row.ticket_number}</h1>
            <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-700">Søknadshjelp</span>
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
          {row.dibk && Object.keys(row.dibk).length > 0 && (() => {
            const dispCount = Object.entries(row.dibk).filter(([k, v]) => isDispensasjon(k, v)).length;
            return (
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-700">DIBK-svar</h2>
                  {dispCount > 0 && (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      {dispCount} dispensasjon{dispCount > 1 ? "er" : ""}
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
            );
          })()}

          {/* Permit result & price */}
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Søknadsresultat & pris</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-gray-400">Resultat</dt><dd className="font-medium capitalize">{row.permit_result ?? "–"}</dd></div>
              <div><dt className="text-xs text-gray-400">Søknadshjelp</dt><dd className="font-medium">{row.permit_price != null ? `${row.permit_price.toLocaleString("nb-NO")} kr` : "–"}</dd></div>
              <div><dt className="text-xs text-gray-400">Totalt</dt><dd className="font-bold text-gray-900">{row.total_price != null ? `${row.total_price.toLocaleString("nb-NO")} kr` : "–"}</dd></div>
            </dl>
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
