"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { calculatePrice, type PackageType, type RoofType } from "@/lib/pricing";

const GarageViewer = dynamic(() => import("@/components/configurator/GarageViewer"), { ssr: false });

function fmt(n: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(n);
}

const SIZES = [
  {
    title: "Enkel garasje — 1 bil",
    widthMm: 5000, lengthMm: 6000, doorWidthMm: 2500, doorHeightMm: 2125,
    roofType: "flattak" as RoofType, buildingType: "garasje",
    tag: "Flattak",
  },
  {
    title: "Populær størrelse — 1 bil",
    widthMm: 6200, lengthMm: 7800, doorWidthMm: 2500, doorHeightMm: 2125,
    roofType: "flattak" as RoofType, buildingType: "garasje",
    tag: "Mest bestilt",
    highlight: true,
  },
  {
    title: "Dobbel garasje — 2 biler",
    widthMm: 7800, lengthMm: 9600, doorWidthMm: 5000, doorHeightMm: 2250,
    roofType: "flattak" as RoofType, buildingType: "garasje",
    tag: "Flattak",
  },
  {
    title: "Saltak garasje — 1 bil",
    widthMm: 5600, lengthMm: 6000, doorWidthMm: 2500, doorHeightMm: 2125,
    roofType: "saltak" as RoofType, buildingType: "garasje",
    tag: "Saltak",
  },
  {
    title: "Stor saltak — dobbel port",
    widthMm: 7200, lengthMm: 8400, doorWidthMm: 5000, doorHeightMm: 2250,
    roofType: "saltak" as RoofType, buildingType: "garasje",
    tag: "Saltak",
  },
  {
    title: "Carport",
    widthMm: 3000, lengthMm: 5000, doorWidthMm: 2500, doorHeightMm: 2125,
    roofType: "flattak" as RoofType, buildingType: "carport",
    tag: "Carport",
  },
];

export default function PriserPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [packageType, setPackageType] = useState<PackageType>("materialpakke");

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
    <div className="mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-3xl font-bold text-gray-900">Hva koster en garasje?</h1>
      <p className="mt-4 text-base text-gray-600 max-w-2xl">
        Prisene varierer etter størrelse, løsningstype og tilpasninger. Under finner du
        veiledende priser — bruk konfiguratoren for nøyaktig pris tilpasset din tomt.
      </p>

      {/* Package toggle */}
      <div className="mt-8 inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
        {(["materialpakke", "prefab"] as PackageType[]).map((pkg) => (
          <button
            key={pkg}
            onClick={() => setPackageType(pkg)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
              packageType === pkg
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {pkg === "materialpakke" ? "Materialpakke" : "Prefabrikkert"}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SIZES.map((s) => {
          const config = { parameters: { length: s.lengthMm, width: s.widthMm, doorWidth: s.doorWidthMm, doorHeight: s.doorHeightMm }, timestamp: 0 };
          const result = calculatePrice(config, packageType, s.roofType, s.buildingType);
          const sizeLabel = `${(s.widthMm / 1000).toLocaleString("nb-NO")} × ${(s.lengthMm / 1000).toLocaleString("nb-NO")} m`;

          return (
            <div
              key={s.title}
              className={`overflow-hidden rounded-xl border flex flex-col ${
                s.highlight ? "border-orange-300 bg-orange-50" : "border-gray-200 bg-white"
              }`}
            >
              {/* 3D view */}
              <div className="h-48 w-full bg-gray-100">
                <GarageViewer
                  widthMm={s.widthMm}
                  lengthMm={s.lengthMm}
                  doorWidthMm={s.doorWidthMm}
                  doorHeightMm={s.doorHeightMm}
                  roofType={s.roofType}
                  buildingType={s.buildingType}
                  autoRotate
                  addedElements={[]}
                />
              </div>

              {/* Info */}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    s.highlight ? "bg-orange-200 text-orange-800" : "bg-gray-100 text-gray-500"
                  }`}>
                    {s.tag}
                  </span>
                </div>
                <h2 className="mt-1.5 text-sm font-bold text-gray-900">{s.title}</h2>
                <p className="text-xs text-gray-500">{sizeLabel}</p>
                <p className="mt-3 text-xl font-bold text-orange-500">
                  {result.manualQuote ? "Pris på forespørsel" : `fra ${fmt(result.totalPrice)}`}
                </p>
                {!result.manualQuote && (
                  <p className="text-[10px] text-gray-400 mt-0.5">ekskl. mva., frakt og grunnarbeid</p>
                )}
              </div>
            </div>
          );
        })}
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
