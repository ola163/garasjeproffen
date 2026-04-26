"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function HeroButtons() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [buildingType, setBuildingType] = useState<"garasje" | "carport">("garasje");

  function handlePackage(pkg: "materialpakke" | "prefab") {
    router.push(`/${buildingType}?package=${pkg}`);
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      {/* Start design with submenu */}
      <div className="w-full">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3 rounded-xl rounded-tl-full rounded-bl-full bg-orange-500 px-3 py-3 text-base font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-600/60">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
          </span>
          <span className="flex-1 text-left">Start garasjedesign</span>
          <svg
            className={`h-5 w-5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {open && (
          <div className="mt-1 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-md">
            <p className="px-2 pt-1 pb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Hva vil du bygge?
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setBuildingType("garasje")}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  buildingType === "garasje"
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-gray-200 text-gray-600 hover:border-orange-300 hover:bg-orange-50"
                }`}
              >
                Garasje
              </button>
              <button
                onClick={() => setBuildingType("carport")}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  buildingType === "carport"
                    ? "border-orange-500 bg-orange-500 text-white"
                    : "border-gray-200 text-gray-600 hover:border-orange-300 hover:bg-orange-50"
                }`}
              >
                Carport
              </button>
            </div>

            <p className="mt-2 px-2 pb-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Velg løsning
            </p>
            <button
              onClick={() => handlePackage("materialpakke")}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-orange-50 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-6 w-6">
                  <rect x="11" y="13" width="3.5" height="9" rx="1.2" fill="white" transform="rotate(-45 12.75 17.5)"/>
                  <rect x="7" y="3" width="10" height="6" rx="1.5" fill="white"/>
                  <rect x="5.5" y="8" width="7" height="3.5" rx="1" fill="white"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Materialpakke</p>
                <p className="text-xs text-gray-500">Bygg selv – komplett materialpakke</p>
              </div>
            </button>

            <button
              onClick={() => handlePackage("prefab")}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-orange-50 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Prefabrikert løsning</p>
                <p className="text-xs text-gray-500">Ferdige elementer – rask montering</p>
              </div>
            </button>
          </div>
        )}
      </div>

      <Link
        href="/soknadshjelp"
        className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 text-base font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
          <svg className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
        </span>
        Få hjelp med byggesøknad
      </Link>
    </div>
  );
}
