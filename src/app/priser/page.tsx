"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const EXAMPLES = [
  {
    title: "Liten garasje — 1 bil",
    size: "3 × 6 m",
    type: "Materialpakke",
    price: "fra kr 95 000",
    included: ["Komplett materialpakke", "Tekniske tegninger", "Veiledning for montering"],
  },
  {
    title: "Standard garasje — 1 bil",
    size: "4 × 6 m",
    type: "Materialpakke",
    price: "fra kr 120 000",
    included: ["Komplett materialpakke", "Tekniske tegninger", "Veiledning for montering"],
  },
  {
    title: "Dobbel garasje — 2 biler",
    size: "6 × 6 m",
    type: "Materialpakke",
    price: "fra kr 175 000",
    included: ["Komplett materialpakke", "Tekniske tegninger", "Veiledning for montering"],
  },
  {
    title: "Prefabrikkert garasje",
    size: "4 × 6 m",
    type: "Prefabrikert — nøkkelferdig",
    price: "fra kr 195 000",
    included: ["Ferdigproduserte elementer", "Montering av oss", "Byggesøknad inkludert"],
    highlight: true,
  },
  {
    title: "Prefabrikkert dobbel garasje",
    size: "6 × 7 m",
    type: "Prefabrikert — nøkkelferdig",
    price: "fra kr 280 000",
    included: ["Ferdigproduserte elementer", "Montering av oss", "Byggesøknad inkludert"],
    highlight: true,
  },
  {
    title: "Carport",
    size: "3 × 5 m",
    type: "Materialpakke",
    price: "fra kr 45 000",
    included: ["Komplett materialpakke", "Tekniske tegninger", "Veiledning for montering"],
  },
];

export default function PriserPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => setIsAdmin(d.isAdmin ?? false))
      .catch(() => setIsAdmin(false));
  }, []);

  if (isAdmin === null) {
    return <div className="flex min-h-screen items-center justify-center text-gray-400">Laster…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-gray-500">Denne siden er ikke tilgjengelig.</p>
        <Link href="/" className="text-sm text-orange-500 hover:underline">Tilbake til forsiden</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-14">
      <h1 className="text-3xl font-bold text-gray-900">Hva koster en garasje?</h1>
      <p className="mt-4 text-base text-gray-600 max-w-2xl">
        Prisene varierer etter størrelse, løsningstype og tilpasninger. Under finner du
        veiledende priser — bruk konfiguratoren for nøyaktig pris tilpasset din tomt.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map(({ title, size, type, price, included, highlight }) => (
          <div
            key={title}
            className={`rounded-xl border p-5 flex flex-col ${
              highlight ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-white"
            }`}
          >
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{type}</p>
              <h2 className="mt-1 text-base font-bold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">{size}</p>
            </div>
            <p className="text-xl font-bold text-orange-500">{price}</p>
            <ul className="mt-4 space-y-1.5 flex-1">
              {included.map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-gray-600">
                  <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-xl bg-gray-50 border border-gray-100 p-6 text-center">
        <p className="text-sm text-gray-600 mb-1">Alle priser er veiledende og ekskl. mva., frakt og grunnarbeid.</p>
        <p className="text-sm text-gray-600 mb-4">Bruk konfiguratoren for eksakt pris på din garasje.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          Beregn din pris →
        </Link>
      </div>
    </div>
  );
}
