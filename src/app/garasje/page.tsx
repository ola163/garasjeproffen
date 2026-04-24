import { Suspense } from "react";
import Link from "next/link";
import ConfiguratorShell from "@/components/configurator/ConfiguratorShell";

export const metadata = {
  title: "Garasje på Jæren og i Rogaland | Materialpakke og prefab | GarasjeProffen",
  description: "Design og bestill garasje fra GarasjeProffen AS på Bryne. Materialpakke for selvbygging eller prefabrikkert garasje med montering – Jæren, Sandnes, Stavanger og omegn.",
  alternates: { canonical: "https://www.garasjeproffen.no/garasje" },
  openGraph: {
    title: "Garasje på Jæren og i Rogaland | Materialpakke og prefab | GarasjeProffen",
    description: "Design og bestill garasje fra GarasjeProffen AS på Bryne. Materialpakke for selvbygging eller prefabrikkert garasje med montering – Jæren, Sandnes, Stavanger og omegn.",
    url: "https://www.garasjeproffen.no/garasje",
    images: [{ url: "/logo.jpg", width: 600, height: 600, alt: "GarasjeProffen AS" }],
  },
};

export default function GarasjePage() {
  return (
    <>
      <div className="mx-auto max-w-4xl px-6 pt-10 pb-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Garasje på Jæren og i Rogaland
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600">
          Konfigurer garasjen din i 3D og motta et prisestimat med én gang. Velg{" "}
          <Link href="/materialpakke-garasje" className="text-orange-600 hover:underline">materialpakke for selvbygging</Link>
          {" "}eller{" "}
          <Link href="/prefabrikkert-garasje" className="text-orange-600 hover:underline">prefabrikkert garasje med montering</Link>
          {" "}– levert av GarasjeProffen AS fra Bryne.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link href="/byggesoknad-garasje" className="text-gray-500 hover:text-orange-600">Hjelp med byggesøknad og nabovarsel</Link>
          <Link href="/garasje-rogaland" className="text-gray-500 hover:text-orange-600">Levering i hele Rogaland</Link>
        </div>
      </div>
      <Suspense
        fallback={
          <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
              <span className="text-gray-600">Laster konfigurator...</span>
            </div>
          </div>
        }
      >
        <ConfiguratorShell buildingType="garasje" />
      </Suspense>
    </>
  );
}
