"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);

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

        {!selecting ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              onClick={() => setSelecting(true)}
              className="w-full rounded-lg bg-orange-500 px-8 py-3 text-lg font-medium text-white hover:bg-orange-600"
            >
              Start design
            </button>
            <Link
              href="/soknadshjelp"
              className="w-full rounded-lg border border-orange-400 px-8 py-3 text-lg font-medium text-orange-600 hover:bg-orange-50"
            >
              Søknadshjelp
            </Link>
          </div>
        ) : (
          <div className="mt-8">
            <p className="mb-4 text-sm font-medium text-gray-500">Velg løsning:</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => router.push("/configurator?package=materialpakke")}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-orange-300 hover:shadow-md transition-all"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-500">
                  {/* Hammer icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.293 2.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-1.586 1.586.793.793a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l7-7a1 1 0 011.414 0l.793.793 1.586-1.586zM3 17a1 1 0 011-1h1v-1a1 1 0 112 0v1h1a1 1 0 110 2H7v1a1 1 0 11-2 0v-1H4a1 1 0 01-1-1z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Byggesett / materialpakke</p>
                  <p className="text-sm text-gray-500">Bygg selv – komplett materialpakke</p>
                </div>
              </button>

              <button
                onClick={() => router.push("/configurator?package=prefab")}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-orange-300 hover:shadow-md transition-all"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-500">
                  {/* House icon */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Prefabrikert løsning / element</p>
                  <p className="text-sm text-gray-500">Ferdige elementer – rask montering</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setSelecting(false)}
              className="mt-4 text-sm text-gray-400 hover:text-gray-600"
            >
              ← Tilbake
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
