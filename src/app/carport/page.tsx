import { Suspense } from "react";
import Link from "next/link";
import ConfiguratorShell from "@/components/configurator/ConfiguratorShell";

export const metadata = {
  title: "Carport på Jæren og i Rogaland | GarasjeProffen AS",
  description: "Bestill carport fra GarasjeProffen AS på Bryne. Velg mellom materialpakke og prefabrikkert carport med montering – vi leverer i Rogaland, Jæren, Sandnes og Stavanger.",
  alternates: { canonical: "https://www.garasjeproffen.no/carport" },
  openGraph: {
    title: "Carport på Jæren og i Rogaland | GarasjeProffen AS",
    description: "Bestill carport fra GarasjeProffen AS på Bryne. Velg mellom materialpakke og prefabrikkert carport med montering – vi leverer i Rogaland, Jæren, Sandnes og Stavanger.",
    url: "https://www.garasjeproffen.no/carport",
    images: [{ url: "/logo.jpg", width: 600, height: 600, alt: "GarasjeProffen AS" }],
  },
};

export default function CarportPage() {
  return (
    <>
      <div className="mx-auto max-w-4xl px-6 pt-10 pb-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          Carport på Jæren og i Rogaland
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600">
          Design carporten din i 3D og få et prisestimat med én gang. Vi leverer carporter som{" "}
          <Link href="/materialpakke-garasje" className="text-orange-600 hover:underline">materialpakke for selvbygging</Link>
          {" "}eller som{" "}
          <Link href="/prefabrikkert-garasje" className="text-orange-600 hover:underline">prefabrikkert løsning med montering</Link>
          {" "}– tilpasset tomten din i Rogaland.
        </p>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link href="/byggesoknad-garasje" className="text-gray-500 hover:text-orange-600">Trenger du byggesøknad?</Link>
          <Link href="/garasje-rogaland" className="text-gray-500 hover:text-orange-600">Se alle løsninger i Rogaland</Link>
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
        <ConfiguratorShell buildingType="carport" />
      </Suspense>
    </>
  );
}
