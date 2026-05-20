"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────
type NaboStatus =
  | "ikke_sendt"
  | "sendt"
  | "purring_sendt"
  | "ingen_merknad"
  | "merknad_mottatt";

type NVStatus = "utkast" | "sendt" | "purring_sendt" | "ferdig";

interface Nabo {
  id: string;
  gnr: number | null;
  bnr: number | null;
  snr: number;
  fnr: number;
  kommunenr: string | null;
  eiendom_adresse: string | null;
  eier_navn: string | null;
  eier_postadresse: string | null;
  eier_epost: string | null;
  status: NaboStatus;
  sendt_at: string | null;
  purring_sendt_at: string | null;
  svar_mottatt_at: string | null;
  svar_tekst: string | null;
}

interface Nabovarsel {
  id: string;
  quote_id: string;
  adresse: string | null;
  kommunenr: string | null;
  gnr: number | null;
  bnr: number | null;
  lat: number | null;
  lng: number | null;
  tiltaket: string | null;
  status: NVStatus;
  frist: string | null;
  notat: string | null;
  nabovarsel_naboer: Nabo[];
}

interface KartverketNabo {
  gnr: number;
  bnr: number;
  kommunenr: string;
  adresse?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<NaboStatus, string> = {
  ikke_sendt: "Ikke sendt",
  sendt: "Sendt",
  purring_sendt: "Purring sendt",
  ingen_merknad: "Ingen merknad",
  merknad_mottatt: "Merknad mottatt",
};

const STATUS_COLOR: Record<NaboStatus, string> = {
  ikke_sendt: "bg-gray-100 text-gray-600",
  sendt: "bg-blue-100 text-blue-700",
  purring_sendt: "bg-yellow-100 text-yellow-700",
  ingen_merknad: "bg-green-100 text-green-700",
  merknad_mottatt: "bg-red-100 text-red-700",
};

const NV_STATUS_LABEL: Record<NVStatus, string> = {
  utkast: "Utkast",
  sendt: "Sendt",
  purring_sendt: "Purring sendt",
  ferdig: "Ferdig",
};

const NV_STATUS_COLOR: Record<NVStatus, string> = {
  utkast: "bg-gray-100 text-gray-600",
  sendt: "bg-blue-100 text-blue-700",
  purring_sendt: "bg-yellow-100 text-yellow-700",
  ferdig: "bg-green-100 text-green-700",
};

function fmtDate(iso: string | null) {
  if (!iso) return "–";
  return new Date(iso).toLocaleDateString("nb-NO", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NabovarselPage() {
  const params = useParams();
  const quoteId = params.id as string;

  const [quote, setQuote] = useState<{ customer_name: string; map_lat: number | null; map_lng: number | null; map_address: string | null } | null>(null);
  const [nv, setNv] = useState<Nabovarsel | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tiltaket, setTiltaket] = useState("Oppføring av garasje");
  const [fetchingNaboer, setFetchingNaboer] = useState(false);
  const [kartverketNaboer, setKartverketNaboer] = useState<KartverketNabo[]>([]);
  const [deselected, setDeselected] = useState<Set<number>>(new Set());
  const [sending, setSending] = useState(false);
  const [purring, setPurring] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [editNabo, setEditNabo] = useState<Nabo | null>(null);
  const [editForm, setEditForm] = useState({ eier_navn: "", eier_epost: "", eier_postadresse: "", eier_personnummer: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [addMerknadId, setAddMerknadId] = useState<string | null>(null);
  const [merknadTekst, setMerknadTekst] = useState("");

  const autoFetchedRef = useRef(false);

  async function loadNV() {
    const res = await fetch(`/api/admin/nabovarsel?quote_id=${quoteId}`);
    const data: Nabovarsel[] = await res.json();
    if (data.length > 0) setNv(data[0]);
    return data[0] ?? null;
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [qRes] = await Promise.all([
      fetch(`/api/admin/quote-detail?id=${quoteId}`).catch(() => null),
    ]);

    const nvData = await loadNV();

    if (qRes?.ok) {
      try {
        const qData = await qRes.json();
        setQuote(qData);
      } catch { /* ignore */ }
    }

    setLoading(false);
    return nvData;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId]);

  useEffect(() => {
    load().then((nvData) => {
      // Auto-fetch naboer if case has coordinates and no naboer yet
      if (nvData?.lat && nvData?.lng && nvData.nabovarsel_naboer.length === 0 && !autoFetchedRef.current) {
        autoFetchedRef.current = true;
        doFetchNaboer(nvData.lat, nvData.lng);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  async function doFetchNaboer(lat: number, lng: number) {
    setFetchingNaboer(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/admin/naboer?lat=${lat}&lng=${lng}`);
      const data = await res.json();
      const naboer: KartverketNabo[] = data.naboer ?? [];
      setKartverketNaboer(naboer);
      setDeselected(new Set()); // all pre-selected
    } catch {
      setSendResult("Feil ved henting av naboer fra Kartverket");
    }
    setFetchingNaboer(false);
  }

  async function fetchNaboer() {
    if (!nv?.lat || !nv?.lng) return;
    autoFetchedRef.current = true;
    await doFetchNaboer(nv.lat, nv.lng);
  }

  function toggleNabo(idx: number) {
    setDeselected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function selectAll() { setDeselected(new Set()); }
  function deselectAll() { setDeselected(new Set(nyeNaboer.map((_, i) => i))); }

  // Create a nabovarsel case
  async function createNabovarsel() {
    setCreating(true);
    const res = await fetch("/api/admin/nabovarsel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote_id: quoteId,
        adresse: quote?.map_address ?? null,
        lat: quote?.map_lat ?? null,
        lng: quote?.map_lng ?? null,
        tiltaket,
      }),
    });
    if (res.ok) {
      const data: Nabovarsel = await res.json();
      const newNv = { ...data, nabovarsel_naboer: [] };
      setNv(newNv);
      // Auto-fetch naboer immediately after creating
      if (data.lat && data.lng) {
        autoFetchedRef.current = true;
        doFetchNaboer(data.lat, data.lng);
      }
    }
    setCreating(false);
  }

  // Add checked naboer to the nabovarsel case
  async function addNaboer() {
    if (!nv) return;
    const selected = nyeNaboer.filter((_, i) => !deselected.has(i));
    if (selected.length === 0) return;
    const payload = selected.map(n => ({
      gnr: n.gnr,
      bnr: n.bnr,
      kommunenr: n.kommunenr,
      eiendom_adresse: n.adresse ?? null,
    }));
    const res = await fetch(`/api/admin/nabovarsel/${nv.id}/naboer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setKartverketNaboer([]);
      setDeselected(new Set());
      await loadNV();
    }
  }

  // Save edit
  async function saveEdit() {
    if (!nv || !editNabo) return;
    setSavingEdit(true);
    await fetch(`/api/admin/nabovarsel/${nv.id}/naboer/${editNabo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSavingEdit(false);
    setEditNabo(null);
    await loadNV();
  }

  // Send nabovarsel
  async function sendNabovarsel() {
    if (!nv) return;
    setSending(true);
    setSendResult(null);
    const res = await fetch(`/api/admin/nabovarsel/${nv.id}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setSendResult(
      data.sent > 0
        ? `${data.sent} nabovarsel sendt.${data.errors?.length ? ` Feil: ${data.errors.join(", ")}` : ""}`
        : data.message ?? "Ingenting å sende (mangler e-post?)",
    );
    await loadNV();
    setSending(false);
  }

  // Send purring
  async function sendPurring() {
    if (!nv) return;
    setPurring(true);
    setSendResult(null);
    const res = await fetch(`/api/admin/nabovarsel/${nv.id}/purring`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setSendResult(`Purring: ${data.sent} sendt.`);
    await loadNV();
    setPurring(false);
  }

  // Register svar/merknad
  async function saveMerknad(naboId: string, status: NaboStatus) {
    if (!nv) return;
    await fetch(`/api/admin/nabovarsel/${nv.id}/naboer/${naboId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        svar_tekst: merknadTekst || null,
        svar_mottatt_at: new Date().toISOString(),
      }),
    });
    setAddMerknadId(null);
    setMerknadTekst("");
    await loadNV();
  }

  // Delete nabo
  async function deleteNabo(naboId: string) {
    if (!nv || !confirm("Fjerne denne naboen?")) return;
    await fetch(`/api/admin/nabovarsel/${nv.id}/naboer/${naboId}`, { method: "DELETE" });
    await loadNV();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster...</div>;
  }

  const naboer = nv?.nabovarsel_naboer ?? [];
  const ikkeEmail = naboer.filter(n => !n.eier_epost).length;
  const sendt = naboer.filter(n => n.status !== "ikke_sendt").length;
  const harSvar = naboer.filter(n => n.status === "ingen_merknad" || n.status === "merknad_mottatt").length;

  // Filter out already-added properties
  const existingKeys = new Set(naboer.map(n => `${n.gnr}-${n.bnr}-${n.kommunenr}`));
  const nyeNaboer = kartverketNaboer.filter(
    k => !existingKeys.has(`${k.gnr}-${k.bnr}-${k.kommunenr}`),
  );
  const selectedCount = nyeNaboer.filter((_, i) => !deselected.has(i)).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">

        {/* Nav */}
        <div className="mb-6 flex items-center justify-between">
          <Link href={`/admin/quotes/${quoteId}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Tilbake til sak
          </Link>
          {nv && (
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${NV_STATUS_COLOR[nv.status]}`}>
              {NV_STATUS_LABEL[nv.status]}
            </span>
          )}
        </div>

        <h1 className="mb-1 text-2xl font-bold text-gray-900">Nabovarsel</h1>
        <p className="mb-6 text-sm text-gray-500">
          Digital nabovarsling iht. plan- og bygningsloven § 21-3 og SAK10 § 5-2.
        </p>

        {/* ── No nabovarsel yet ── */}
        {!nv && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </div>
            <h2 className="mb-2 font-semibold text-gray-900">Ingen nabovarsel-sak opprettet</h2>
            <p className="mb-6 text-sm text-gray-500">
              Opprett en sak for å starte nabovarslingsprosessen.
              {!quote?.map_lat && (
                <span className="mt-1 block text-yellow-600">
                  OBS: Tomteplassering mangler. Gå til sakskortet og sett posisjon på kartet først.
                </span>
              )}
            </p>
            <div className="mx-auto mb-4 max-w-sm">
              <label className="mb-1 block text-left text-xs font-medium text-gray-600">Beskrivelse av tiltak</label>
              <input
                value={tiltaket}
                onChange={e => setTiltaket(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="F.eks. Oppføring av garasje"
              />
            </div>
            <button
              onClick={createNabovarsel}
              disabled={creating || !quote?.map_lat}
              className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {creating ? "Oppretter…" : "Opprett nabovarsel-sak"}
            </button>
          </div>
        )}

        {/* ── Nabovarsel case exists ── */}
        {nv && (
          <>
            {/* Summary bar */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Naboer totalt", value: naboer.length },
                { label: "Varslet", value: sendt },
                { label: "Mangler e-post", value: ikkeEmail, warn: ikkeEmail > 0 },
                { label: "Svar mottatt", value: harSvar },
              ].map(({ label, value, warn }) => (
                <div key={label} className={`rounded-xl border bg-white p-4 shadow-sm ${warn ? "border-yellow-200" : "border-gray-200"}`}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-2xl font-bold ${warn ? "text-yellow-600" : "text-gray-900"}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* Info card */}
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Eiendom</p>
                  <p className="font-medium text-gray-900">{nv.adresse ?? "–"}</p>
                  {(nv.gnr || nv.bnr) && (
                    <p className="text-xs text-gray-500">Gnr. {nv.gnr} Bnr. {nv.bnr} {nv.kommunenr ? `• Kommune ${nv.kommunenr}` : ""}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Tiltak</p>
                  <p className="font-medium text-gray-900">{nv.tiltaket ?? "–"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Merknadsfrist</p>
                  <p className="font-medium text-gray-900">{fmtDate(nv.frist)}</p>
                </div>
              </div>
            </div>

            {/* Kartverket naboer — pre-selected, deselect to exclude */}
            {(nyeNaboer.length > 0 || fetchingNaboer) && (
              <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="font-semibold text-gray-900">
                      {fetchingNaboer
                        ? "Henter naboeiendommer fra Kartverket…"
                        : `${nyeNaboer.length} naboeiendommer funnet`}
                    </h2>
                    {!fetchingNaboer && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        Alle er forhåndsvalgt. Klikk for å fjerne de du ikke vil varsle.
                      </p>
                    )}
                  </div>
                  {!fetchingNaboer && nyeNaboer.length > 1 && (
                    <div className="flex gap-2">
                      <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Velg alle</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={deselectAll} className="text-xs text-gray-400 hover:underline">Fjern alle</button>
                    </div>
                  )}
                </div>

                {fetchingNaboer ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 animate-pulse py-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
                      <path d="M12 2a10 10 0 0 1 10 10"/>
                    </svg>
                    Søker etter tilstøtende eiendommer…
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {nyeNaboer.map((n, i) => {
                        const checked = !deselected.has(i);
                        return (
                          <button
                            key={i}
                            onClick={() => toggleNabo(i)}
                            className={`w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                              checked
                                ? "border-blue-200 bg-white"
                                : "border-gray-200 bg-gray-50 opacity-50"
                            }`}
                          >
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                              checked ? "border-blue-500 bg-blue-500" : "border-gray-300 bg-white"
                            }`}>
                              {checked && (
                                <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {n.adresse ?? `Gnr. ${n.gnr} / Bnr. ${n.bnr}`}
                              </p>
                              <p className="text-xs text-gray-400">Gnr. {n.gnr} · Bnr. {n.bnr} · {n.kommunenr}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        onClick={addNaboer}
                        disabled={selectedCount === 0}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                      >
                        Legg til valgte ({selectedCount})
                      </button>
                      <button
                        onClick={() => { setKartverketNaboer([]); setDeselected(new Set()); }}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                      >
                        Avbryt
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Empty state — no naboer yet and nothing fetching */}
            {naboer.length === 0 && nyeNaboer.length === 0 && !fetchingNaboer && (
              <div className="mb-6 rounded-xl border border-dashed border-orange-300 bg-orange-50 p-6">
                <h2 className="mb-1 font-semibold text-gray-900">Ingen naboer lagt til</h2>
                <p className="mb-4 text-sm text-gray-500">
                  {nv.lat
                    ? "Ingen tilstøtende eiendommer ble funnet automatisk. Du kan prøve på nytt, eller legge til manuelt."
                    : "Tomteposisjon mangler — sett markør på kartet i sakskortet."}
                </p>
                {nv.lat && (
                  <button
                    onClick={fetchNaboer}
                    disabled={fetchingNaboer}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                  >
                    Prøv å hente naboer igjen
                  </button>
                )}
              </div>
            )}

            {/* Nabo list */}
            {naboer.length > 0 && (
              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Naboer ({naboer.length})</h2>
                  <button
                    onClick={fetchNaboer}
                    disabled={fetchingNaboer}
                    className="text-xs text-orange-500 hover:underline disabled:opacity-50"
                  >
                    {fetchingNaboer ? "Henter…" : "Hent flere fra Kartverket"}
                  </button>
                </div>
                <div className="space-y-3">
                  {naboer.map(nabo => (
                    <div key={nabo.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2 flex-wrap">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[nabo.status]}`}>
                              {STATUS_LABEL[nabo.status]}
                            </span>
                            {nabo.sendt_at && (
                              <span className="text-xs text-gray-400">Sendt {fmtDate(nabo.sendt_at)}</span>
                            )}
                          </div>
                          <p className="font-medium text-gray-900">{nabo.eiendom_adresse ?? `Gnr. ${nabo.gnr} Bnr. ${nabo.bnr}`}</p>
                          <p className="text-xs text-gray-500">
                            Gnr. {nabo.gnr} Bnr. {nabo.bnr}{nabo.snr ? ` Snr. ${nabo.snr}` : ""}
                            {nabo.kommunenr ? ` • ${nabo.kommunenr}` : ""}
                          </p>
                          {nabo.eier_navn && <p className="mt-1 text-sm text-gray-700">{nabo.eier_navn}</p>}
                          {nabo.eier_epost
                            ? <p className="text-xs text-blue-600">{nabo.eier_epost}</p>
                            : <p className="text-xs text-yellow-600">E-post mangler — legg inn for å sende digitalt</p>
                          }
                          {nabo.svar_tekst && (
                            <div className="mt-2 rounded bg-red-50 px-3 py-2 text-xs text-red-700 border border-red-100">
                              <strong>Merknad:</strong> {nabo.svar_tekst}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-shrink-0 gap-2">
                          <button
                            onClick={() => {
                              setEditNabo(nabo);
                              setEditForm({
                                eier_navn: nabo.eier_navn ?? "",
                                eier_epost: nabo.eier_epost ?? "",
                                eier_postadresse: nabo.eier_postadresse ?? "",
                                eier_personnummer: (nabo as { eier_personnummer?: string }).eier_personnummer ?? "",
                              });
                            }}
                            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            Rediger
                          </button>
                          {(nabo.status === "sendt" || nabo.status === "purring_sendt") && (
                            <button
                              onClick={() => { setAddMerknadId(nabo.id); setMerknadTekst(""); }}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                            >
                              Svar
                            </button>
                          )}
                          <button
                            onClick={() => deleteNabo(nabo.id)}
                            className="rounded-lg border border-red-100 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                          >
                            Fjern
                          </button>
                        </div>
                      </div>

                      {addMerknadId === nabo.id && (
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <p className="mb-2 text-xs font-medium text-gray-700">Registrer svar fra nabo</p>
                          <textarea
                            value={merknadTekst}
                            onChange={e => setMerknadTekst(e.target.value)}
                            placeholder="Eventuell merknadstekst (valgfritt)"
                            rows={2}
                            className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveMerknad(nabo.id, "ingen_merknad")}
                              className="rounded-lg bg-green-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-600"
                            >
                              Ingen merknad
                            </button>
                            <button
                              onClick={() => saveMerknad(nabo.id, "merknad_mottatt")}
                              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
                            >
                              Merknad mottatt
                            </button>
                            <button
                              onClick={() => setAddMerknadId(null)}
                              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                            >
                              Avbryt
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action bar */}
            <div className="sticky bottom-4 rounded-xl border border-gray-200 bg-white p-4 shadow-md">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={sendNabovarsel}
                  disabled={sending || naboer.filter(n => n.eier_epost && n.status === "ikke_sendt").length === 0}
                  className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-40"
                >
                  {sending ? "Sender…" : `Send nabovarsel (${naboer.filter(n => n.eier_epost && n.status === "ikke_sendt").length})`}
                </button>
                <button
                  onClick={sendPurring}
                  disabled={purring || naboer.filter(n => n.status === "sendt").length === 0}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  {purring ? "Sender…" : `Send purring (${naboer.filter(n => n.status === "sendt").length})`}
                </button>
                <a
                  href={`/admin/quotes/${quoteId}`}
                  className="ml-auto text-sm text-gray-400 hover:text-gray-600"
                >
                  ← Tilbake
                </a>
              </div>
              {sendResult && (
                <p className="mt-2 text-sm text-green-700">{sendResult}</p>
              )}
            </div>
          </>
        )}

        {/* Edit nabo modal */}
        {editNabo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="mb-4 font-semibold text-gray-900">
                Rediger nabo — {editNabo.eiendom_adresse ?? `Gnr. ${editNabo.gnr} Bnr. ${editNabo.bnr}`}
              </h2>
              <div className="space-y-3">
                {[
                  { key: "eier_navn", label: "Eiers navn" },
                  { key: "eier_epost", label: "E-post", type: "email" },
                  { key: "eier_postadresse", label: "Postadresse" },
                  { key: "eier_personnummer", label: "Personnummer (11 siffer, for Altinn)", type: "text" },
                ].map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
                    <input
                      type={type ?? "text"}
                      value={editForm[key as keyof typeof editForm]}
                      onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="flex-1 rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {savingEdit ? "Lagrer…" : "Lagre"}
                </button>
                <button
                  onClick={() => setEditNabo(null)}
                  className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Avbryt
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
