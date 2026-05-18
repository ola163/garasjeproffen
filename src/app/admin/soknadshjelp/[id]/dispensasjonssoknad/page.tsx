"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";

interface KartverketAdresse {
  adressetekst: string;
  kommunenavn: string;
  kommunenummer: string;
  gardsnummer: number;
  bruksnummer: number;
  postnummer: string;
  poststed: string;
  representasjonspunkt: { lat: number; lon: number };
}

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
  manual_dispensasjoner: Array<{ description: string; amount: number }> | null;
  quote_id: string | null;
}

const DIBK_DISP_LABELS: Record<string, string> = {
  nabogrense: "Nabogrense",
  avstandBygg: "Avstand mellom byggverk",
  bya50: "Bebygd areal (BYA)",
  monehoyde: "Mønehøyde",
  enEtasje: "Én etasje",
  lnf: "LNF-område",
  ikkeVernet: "Vernede omgivelser",
  ikkeFlom: "Flomutsatt område",
};

const ALL_DIBK_DISP_KEYS = Object.keys(DIBK_DISP_LABELS);

function isDispensasjon(key: string, value: string): boolean {
  if (key === "lnf") return value === "Ja";
  return ALL_DIBK_DISP_KEYS.includes(key) && value === "Nei";
}

export default function DispensasjonssoknadPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [row, setRow] = useState<SoknadshjelRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Editable property fields
  const [adresse, setAdresse] = useState("");
  const [gnr, setGnr] = useState("");
  const [bnr, setBnr] = useState("");
  const [kommunenavn, setKommunenavn] = useState("");
  const [kommunenummer, setKommunenummer] = useState("");

  // Building config
  const [garType, setGarType] = useState("garasje");
  const [bredde, setBredde] = useState("");
  const [lengde, setLengde] = useState("");
  const [taktype, setTaktype] = useState("saltak");
  const [pakke, setPakke] = useState("materialpakke");

  // Dispensations + extra info
  const [selectedDibkDisps, setSelectedDibkDisps] = useState<string[]>([]);
  const [ekstraInfo, setEkstraInfo] = useState("");

  // Generated text
  const [generatedText, setGeneratedText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [fetchingProperty, setFetchingProperty] = useState(false);

  // Address autocomplete
  const [suggestions, setSuggestions] = useState<KartverketAdresse[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addressDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) { setSuggestions([]); return; }
    try {
      const res = await fetch(
        `https://ws.geonorge.no/adresser/v1/sok?sok=${encodeURIComponent(query)}&treffPerSide=6&utkoordsys=4258`
      );
      if (!res.ok) return;
      const data = await res.json();
      setSuggestions(data.adresser ?? []);
      setShowSuggestions(true);
    } catch { /* silent */ }
  }, []);

  function handleAddressInput(value: string) {
    setAdresse(value);
    if (addressDebounce.current) clearTimeout(addressDebounce.current);
    addressDebounce.current = setTimeout(() => searchAddress(value), 300);
  }

  function selectSuggestion(addr: KartverketAdresse) {
    const fullAdresse = addr.adressetekst + (addr.poststed ? `, ${addr.poststed}` : "");
    setAdresse(fullAdresse);
    setGnr(String(addr.gardsnummer));
    setBnr(String(addr.bruksnummer));
    setKommunenavn(addr.kommunenavn);
    setKommunenummer(addr.kommunenummer);
    setSuggestions([]);
    setShowSuggestions(false);
  }

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
        const r = data as SoknadshjelRow;
        setRow(r);
        if (r.address) setAdresse(r.address);

        const gc = r.garage_config as {
          lengthMm?: number; widthMm?: number;
          buildingType?: string; roofType?: string; packageType?: string;
        } | null;
        if (gc) {
          if (gc.buildingType) setGarType(gc.buildingType);
          if (gc.widthMm) setBredde(String(Number(gc.widthMm) / 1000));
          if (gc.lengthMm) setLengde(String(Number(gc.lengthMm) / 1000));
          if (gc.roofType) setTaktype(gc.roofType);
          if (gc.packageType) setPakke(gc.packageType);
        }

        const dibkDisps = r.dibk
          ? ALL_DIBK_DISP_KEYS.filter(k => isDispensasjon(k, r.dibk![k] ?? ""))
          : [];
        setSelectedDibkDisps(dibkDisps);

        if (r.quote_id) fetchPropertyFromQuote(r.quote_id, r.address);
      }
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  async function fetchPropertyFromQuote(quoteId: string, fallbackAddress: string | null) {
    setFetchingProperty(true);
    try {
      const res = await fetch(`/api/admin/quote-detail?id=${quoteId}`);
      if (!res.ok) return;
      const quote = await res.json();
      if (quote.map_lat && quote.map_lng) {
        const naboRes = await fetch(`/api/admin/naboer?lat=${quote.map_lat}&lng=${quote.map_lng}`);
        if (naboRes.ok) {
          const naboData = await naboRes.json();
          const main = naboData.main;
          if (main) {
            if (main.gnr) setGnr(String(main.gnr));
            if (main.bnr) setBnr(String(main.bnr));
            if (main.kommunenr) setKommunenummer(main.kommunenr);
            if (main.kommunenavn) setKommunenavn(main.kommunenavn);
            if (main.adresse && !fallbackAddress) setAdresse(main.adresse);
          }
        }
      }
    } catch {
      // silent — admin can fill in manually
    } finally {
      setFetchingProperty(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const manualDisps = (row?.manual_dispensasjoner ?? []).map(d => d.description);
      const res = await fetch(`/api/admin/soknadshjelp/${id}/generer-soknad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adresse,
          gnr: gnr ? Number(gnr) : null,
          bnr: bnr ? Number(bnr) : null,
          kommunenavn,
          kommunenummer,
          kundenavn: row?.customer_name ?? "",
          telefon: row?.customer_phone ?? null,
          epost: row?.customer_email ?? "",
          garType,
          bredde: bredde ? Number(bredde) : null,
          lengde: lengde ? Number(lengde) : null,
          taktype,
          pakke,
          dibkDisps: selectedDibkDisps,
          manualDisps,
          ekstraInfo,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setGeneratedText(data.text);
    } catch (e) {
      setGenerateError(String(e));
    } finally {
      setGenerating(false);
    }
  }

  const today = new Date().toLocaleDateString("nb-NO", { day: "2-digit", month: "long", year: "numeric" });
  const dispCount = selectedDibkDisps.length + (row?.manual_dispensasjoner?.length ?? 0);
  const kommunevatImg = kommunenummer ? `/kommuner/${kommunenummer}.png` : null;

  if (authLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster...</div>;
  }
  if (!supabase || !user || !ALLOWED_ADMINS.includes(user.email?.toLowerCase() ?? "")) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-600">Du har ikke tilgang.</p></div>;
  }
  if (!row) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Sak ikke funnet.</p></div>;
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-text { display: block !important; }
          body { background: white; margin: 0; }
          .a4-doc { box-shadow: none !important; border: none !important; border-radius: 0 !important; }
        }
        @media screen {
          .print-text { display: none; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100">

        {/* Top bar */}
        <div className="no-print sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3">
          <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href={`/admin/soknadshjelp/${id}`} className="text-gray-400 hover:text-gray-600">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
              <div>
                <h1 className="text-sm font-bold text-gray-900">Søknad om dispensasjon</h1>
                <p className="text-xs text-gray-500">{row.ticket_number} · {row.customer_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {fetchingProperty && (
                <span className="text-xs text-gray-400 animate-pulse">Henter eiendomsdata...</span>
              )}
              <button
                onClick={handleGenerate}
                disabled={generating || !kommunenavn || dispCount === 0}
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {generating ? "Genererer AI-tekst..." : "Generer søknadstekst"}
              </button>
              {generatedText && (
                <button
                  onClick={() => window.print()}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Skriv ut / PDF
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-6 flex gap-6 items-start">

          {/* Left sidebar: form */}
          <div className="no-print w-72 shrink-0 space-y-4">

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Eiendom</h3>
              <div className="space-y-2.5">
                <div className="relative" ref={suggestionsRef}>
                  <label className="text-xs text-gray-500">Adresse</label>
                  <input
                    value={adresse}
                    onChange={e => handleAddressInput(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    autoComplete="off"
                    placeholder="Begynn å skrive adresse..."
                    className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full z-50 mt-0.5 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                      {suggestions.map((s, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); selectSuggestion(s); }}
                            className="w-full px-3 py-2 text-left text-xs hover:bg-orange-50 transition-colors"
                          >
                            <span className="font-medium text-gray-900">{s.adressetekst}</span>
                            <span className="ml-1.5 text-gray-400">{s.postnummer} {s.poststed} · {s.kommunenavn}</span>
                            <span className="ml-1.5 text-gray-300">gnr. {s.gardsnummer} / {s.bruksnummer}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Gnr.</label>
                    <input type="number" value={gnr} onChange={e => setGnr(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Bnr.</label>
                    <input type="number" value={bnr} onChange={e => setBnr(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Kommune</label>
                  <input value={kommunenavn} onChange={e => setKommunenavn(e.target.value)}
                    placeholder="F.eks. Hå"
                    className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Kommunenummer</label>
                  <input value={kommunenummer} onChange={e => setKommunenummer(e.target.value)}
                    placeholder="F.eks. 1114"
                    className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  {kommunenummer && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/kommuner/${kommunenummer}.png`} alt="" className="h-5 w-5 object-contain"
                        onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }} />
                      <span className="text-xs text-gray-400">kommunevåpen</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Tiltak</h3>
              <div className="space-y-2.5">
                <div>
                  <label className="text-xs text-gray-500">Type</label>
                  <select value={garType} onChange={e => setGarType(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="garasje">Garasje</option>
                    <option value="carport">Carport</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500">Bredde (m)</label>
                    <input type="number" value={bredde} onChange={e => setBredde(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Lengde (m)</label>
                    <input type="number" value={lengde} onChange={e => setLengde(e.target.value)}
                      className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Taktype</label>
                  <select value={taktype} onChange={e => setTaktype(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="saltak">Saltak</option>
                    <option value="flattak">Flattak</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Pakke</label>
                  <select value={pakke} onChange={e => setPakke(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="materialpakke">Materialpakke</option>
                    <option value="prefab">Prefabrikert</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dispensasjoner</h3>
                {dispCount > 0 && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">{dispCount}</span>
                )}
              </div>
              <div className="space-y-2">
                {ALL_DIBK_DISP_KEYS.map(k => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedDibkDisps.includes(k)}
                      onChange={e => setSelectedDibkDisps(prev =>
                        e.target.checked ? [...prev, k] : prev.filter(d => d !== k)
                      )}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                    <span className="text-xs text-gray-700 group-hover:text-gray-900">{DIBK_DISP_LABELS[k]}</span>
                  </label>
                ))}
              </div>
              {row.manual_dispensasjoner && row.manual_dispensasjoner.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Fra reguleringsplan</p>
                  {row.manual_dispensasjoner.map((d, i) => (
                    <div key={i} className="text-xs text-gray-700 bg-red-50 rounded px-2 py-1 mb-1 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                      {d.description}
                    </div>
                  ))}
                </div>
              )}
              {dispCount === 0 && (
                <p className="mt-2 text-xs text-amber-600">Velg minst én dispensasjon</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tilleggsinformasjon</h3>
              <textarea
                rows={6}
                value={ekstraInfo}
                onChange={e => setEkstraInfo(e.target.value)}
                placeholder="Spesifikke lokale forhold, kundens begrunnelse, avstandsmål, støyrapport e.l. ..."
                className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>

            {generateError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">{generateError}</div>
            )}
          </div>

          {/* A4 document */}
          <div className="flex-1 min-w-0">
            <div className="a4-doc bg-white shadow-xl border border-gray-200 rounded-lg" style={{ minHeight: "1060px" }}>
              <div className="px-14 py-12">

                {/* Header with logos */}
                <div className="flex items-start justify-between mb-10">
                  <div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo.jpg" alt="GarasjeProffen" className="h-10 object-contain"
                      onError={e => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = "none";
                        const next = el.nextElementSibling as HTMLElement | null;
                        if (next) next.style.display = "block";
                      }} />
                    <p className="hidden text-lg font-bold text-orange-600">GarasjeProffen</p>
                    <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                      GarasjeProffen AS · Ansvarlig søker<br />
                      post@garasjeproffen.no · +47 476 17 563
                    </p>
                  </div>
                  {kommunevatImg && (
                    <div className="text-right">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={kommunevatImg} alt={`${kommunenavn} kommunevåpen`}
                        className="h-16 object-contain ml-auto"
                        onError={e => { (e.target as HTMLImageElement).style.visibility = "hidden"; }} />
                      {kommunenavn && <p className="mt-1 text-xs text-gray-500">{kommunenavn} kommune</p>}
                    </div>
                  )}
                </div>

                {/* Recipient */}
                <div className="mb-8">
                  <p className="text-sm font-semibold text-gray-900">{kommunenavn || "[Kommune]"} kommune</p>
                  <p className="text-sm text-gray-600">Plan og bygg</p>
                </div>

                {/* Date */}
                <p className="mb-8 text-sm text-gray-600">{today}</p>

                {/* Subject */}
                <div className="mb-6">
                  <h2 className="text-base font-bold text-gray-900">
                    Søknad om dispensasjon
                    {adresse && <span className="font-normal"> – {adresse}</span>}
                    {(gnr || bnr) && (
                      <span className="font-normal text-gray-600">, gnr. {gnr || "–"} bnr. {bnr || "–"}</span>
                    )}
                  </h2>
                  {dispCount > 0 && (
                    <p className="mt-1 text-sm text-gray-600">
                      Gjelder {dispCount} dispensasjon{dispCount !== 1 ? "er" : ""} fra plan- og bygningsloven og kommuneplanbestemmelser
                    </p>
                  )}
                </div>

                {/* Tiltakshaver */}
                <div className="mb-8 rounded-lg bg-gray-50 border border-gray-200 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Tiltakshaver</p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                    <div><span className="text-gray-500">Navn: </span><span className="font-medium text-gray-900">{row.customer_name}</span></div>
                    <div><span className="text-gray-500">E-post: </span><span className="text-gray-900">{row.customer_email}</span></div>
                    {row.customer_phone && (
                      <div><span className="text-gray-500">Telefon: </span><span className="text-gray-900">{row.customer_phone}</span></div>
                    )}
                    {adresse && (
                      <div><span className="text-gray-500">Eiendom: </span><span className="text-gray-900">{adresse}{(gnr || bnr) ? `, gnr. ${gnr || "–"} bnr. ${bnr || "–"}` : ""}</span></div>
                    )}
                  </div>
                </div>

                {/* Søknadstekst */}
                <div className="mb-10">
                  {generatedText ? (
                    <>
                      <textarea
                        value={generatedText}
                        onChange={e => setGeneratedText(e.target.value)}
                        className="no-print w-full rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none leading-relaxed"
                        rows={20}
                      />
                      <div className="print-text text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{generatedText}</div>
                    </>
                  ) : (
                    <div className="no-print flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
                      <svg className="mb-3 h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-400">Søknadstekst genereres av AI</p>
                      <p className="mt-1 text-xs text-gray-400">
                        {dispCount === 0
                          ? "Velg dispensasjoner og fyll inn kommunenavn, trykk deretter Generer"
                          : "Trykk «Generer søknadstekst» i toppen"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Signature */}
                {generatedText && (
                  <div className="mt-10 border-t border-gray-200 pt-8">
                    <p className="text-sm text-gray-700">Med vennlig hilsen</p>
                    <div className="mt-8 flex gap-16">
                      <div>
                        <div className="h-10" />
                        <div className="border-t border-gray-400 pt-1.5 text-xs text-gray-600">
                          <p className="font-semibold">GarasjeProffen AS</p>
                          <p>Ansvarlig søker</p>
                        </div>
                      </div>
                      <div>
                        <div className="h-10" />
                        <div className="border-t border-gray-400 pt-1.5 text-xs text-gray-600">
                          <p className="font-semibold">{row.customer_name}</p>
                          <p>Tiltakshaver</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
