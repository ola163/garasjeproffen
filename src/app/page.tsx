"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [buildingType, setBuildingType] = useState<"garasje" | "carport" | null>(null);

  function handlePackage(pkg: "materialpakke" | "prefab") {
    if (!buildingType) return;
    router.push(`/${buildingType}?package=${pkg}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <Image
          src="/logo.jpg"
          alt="GarasjeProffen.no"
          width={400}
          height={120}
          className="mx-auto mb-6 h-auto w-72"
          priority
        />
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Design din egen garasje
        </h1>
        <p className="mt-3 text-base text-gray-600">
          Tilpass garasjen etter dine behov og få et prisestimat med én gang.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          {/* Start design with submenu */}
          <div className="w-full">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex w-full items-center justify-between rounded-lg bg-orange-500 px-6 py-3 text-lg font-medium text-white hover:bg-orange-600"
            >
              <span>Start design</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {open && (
              <div className="mt-1 flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-md">
                {/* Step 1 — Building type */}
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

                {/* Step 2 — Package type (visible once building type chosen) */}
                {buildingType && (
                  <>
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
                  </>
                )}
              </div>
            )}
          </div>

          <Link
            href="/soknadshjelp"
            className="w-full rounded-lg border border-orange-400 px-8 py-3 text-lg font-medium text-orange-600 hover:bg-orange-50"
          >
            Søknadshjelp
          </Link>
        </div>
      </div>
    </div>
  );
}
