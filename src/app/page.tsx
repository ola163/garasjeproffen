"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ReferansePreview from "@/components/referanseprosjekter/ReferansePreview";

export default function Home() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [buildingType, setBuildingType] = useState<"garasje" | "carport">("garasje");

  function handlePackage(pkg: "materialpakke" | "prefab") {
    router.push(`/${buildingType}?package=${pkg}`);
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-12 gap-12">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-16">

        {/* Left: description */}
        <div className="flex-1 text-left">
          <span className="inline-block rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 mb-4">
            Norsk kvalitet siden 2018
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 leading-snug">
            Vi bygger garasjer og carporter som varer
          </h2>
          <p className="mt-4 text-base text-gray-600 leading-relaxed">
            GarasjeProffen tilbyr skreddersydde garasjer og carporter — enten som komplette materialpakker du bygger selv, eller som prefabrikerte løsninger med rask montering.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              { icon: "📐", text: "Tilpasses dine mål og tomt" },
              { icon: "🏗️", text: "Materialpakke eller prefabrikert løsning" },
              { icon: "⚡", text: "Rask levering over hele Norge" },
              { icon: "📋", text: "Vi hjelper deg med byggesøknaden" },
              { icon: "💬", text: "Personlig oppfølging gjennom hele prosessen" },
            ].map(({ icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-gray-700">
                <span className="text-lg">{icon}</span>
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              +47 476 17 563
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              post@garasjeproffen.no
            </span>
          </div>
        </div>

        {/* Right: configurator panel */}
        <div className="w-full max-w-sm flex-shrink-0 text-center">
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

                {/* Step 2 — Package type */}
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
            className="w-full rounded-lg border border-orange-400 px-8 py-3 text-lg font-medium text-orange-600 hover:bg-orange-50"
          >
            Søknadshjelp
          </Link>
        </div>
        </div>{/* end right column */}
      </div>{/* end two-column wrapper */}

      <ReferansePreview />
    </div>
  );
}
