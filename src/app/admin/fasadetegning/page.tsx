"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import GarageMapbox from "@/components/configurator/GarageMapbox";

type View = "gate" | "fugl";

function FasadetegningContent() {
  const params = useSearchParams();

  const lat          = parseFloat(params.get("lat")        ?? "");
  const lng          = parseFloat(params.get("lng")        ?? "");
  const rotation     = parseInt(params.get("rotation")     ?? "0",    10);
  const widthMm      = parseInt(params.get("widthMm")      ?? "5000", 10);
  const lengthMm     = parseInt(params.get("lengthMm")     ?? "6000", 10);
  const roofType     = (params.get("roofType")     as "saltak" | "flattak")  ?? "saltak";
  const buildingType = (params.get("buildingType") as "garasje" | "carport") ?? "garasje";
  const address      = params.get("address") ?? "";
  const quoteId      = params.get("quote")   ?? "";

  const center: [number, number] | null =
    !isNaN(lat) && !isNaN(lng) ? [lng, lat] : null;

  const [activeView, setActiveView] = useState<View>("gate");

  const situasjonsplanUrl = center
    ? `/admin/situasjonsplan?lat=${lat}&lng=${lng}&rotation=${rotation}&widthMm=${widthMm}&lengthMm=${lengthMm}&roofType=${roofType}&buildingType=${buildingType}${quoteId ? `&quote=${quoteId}` : ""}${address ? `&address=${encodeURIComponent(address)}` : ""}`
    : null;

  const VIEW_TABS: { id: View; label: string; desc: string }[] = [
    { id: "gate",  label: "Gatenivå",        desc: "Perspektiv fra veien inn mot garasjen" },
    { id: "fugl",  label: "Fugleperspektiv",  desc: "3D-oversikt med nabolaget rundt" },
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm print:hidden">
        {quoteId ? (
          <>
            <Link href="/admin/quotes" className="text-sm text-gray-400 hover:text-orange-500 transition-colors">← Forespørsler</Link>
            <span className="text-gray-300">/</span>
            <Link href={`/admin/quotes/${quoteId}`} className="text-sm text-gray-500 font-mono hover:text-orange-500 transition-colors">{quoteId}</Link>
            <span className="text-gray-300">/</span>
          </>
        ) : (
          <>
            <Link href="/admin" className="text-sm text-gray-400 hover:text-orange-500 transition-colors">← Admin</Link>
            <span className="text-gray-300">/</span>
          </>
        )}
        <h1 className="text-sm font-semibold text-gray-800">Fasadetegning</h1>
        <div className="flex-1" />

        {/* View tabs */}
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {VIEW_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveView(t.id)}
              title={t.desc}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                activeView === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {situasjonsplanUrl && (
          <Link
            href={situasjonsplanUrl}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium px-3 py-1.5 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
            Situasjonsplan
          </Link>
        )}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold px-3 py-1.5 transition-colors shadow-sm"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/>
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
            <rect x="6" y="14" width="12" height="8"/>
          </svg>
          Skriv ut
        </button>
      </div>

      {/* ── Info bar ── */}
      {(address || center) && (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-50 border-b border-gray-100 text-xs text-gray-500 print:hidden">
          {address && <span className="font-medium text-gray-700">{address}</span>}
          {center && <span>{center[1].toFixed(5)}, {center[0].toFixed(5)}</span>}
          <span>{(widthMm / 1000).toFixed(1).replace(".0", "")} × {(lengthMm / 1000).toFixed(1).replace(".0", "")} m · {roofType === "saltak" ? "Saltak" : "Flattak"} · {rotation}°</span>
          <span className="ml-auto text-[10px] text-gray-400 capitalize">
            {VIEW_TABS.find((t) => t.id === activeView)?.desc}
          </span>
        </div>
      )}

      {/* ── Map ── */}
      <div className="flex-1 relative">
        {!center ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center text-gray-400">
              <svg className="mx-auto mb-3 h-10 w-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <p className="text-sm">Ingen plassering tilgjengelig</p>
              <p className="mt-1 text-xs">Åpne fasadetegning fra en ordre der kunden har plassert garasjen i kartet.</p>
            </div>
          </div>
        ) : activeView === "gate" ? (
          <GarageMapbox
            key="gate"
            widthMm={widthMm}
            lengthMm={lengthMm}
            roofType={roofType}
            buildingType={buildingType}
            externalCenter={center}
            externalRotation={rotation}
            readOnly
            streetView
            showNeighbors
            forceIs3D={false}
          />
        ) : (
          <GarageMapbox
            key="fugl"
            widthMm={widthMm}
            lengthMm={lengthMm}
            roofType={roofType}
            buildingType={buildingType}
            externalCenter={center}
            externalRotation={rotation}
            readOnly
            forceIs3D
            showNeighbors
          />
        )}
      </div>
    </div>
  );
}

export default function AdminFasadetegningPage() {
  return (
    <Suspense>
      <FasadetegningContent />
    </Suspense>
  );
}
