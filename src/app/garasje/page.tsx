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
      <div className="sr-only">
        <h1>Garasje på Jæren og i Rogaland</h1>
        <p>
          Konfigurer garasjen din i 3D og motta et prisestimat med én gang. Velg{" "}
          <Link href="/materialpakke-garasje">materialpakke for selvbygging</Link>
          {" "}eller{" "}
          <Link href="/prefabrikkert-garasje">prefabrikkert garasje med montering</Link>
          {" "}– levert av GarasjeProffen AS fra Bryne.
        </p>
        <Link href="/byggesoknad-garasje">Hjelp med byggesøknad og nabovarsel</Link>
        <Link href="/garasje-rogaland">Levering i hele Rogaland</Link>
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
