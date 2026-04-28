import { Suspense } from "react";
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
