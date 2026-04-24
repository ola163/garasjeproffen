import { Suspense } from "react";
import ConfiguratorShell from "@/components/configurator/ConfiguratorShell";

export const metadata = {
  title: "Garasje på Jæren og Rogaland | Materialpakke og prefab",
  description: "Bestill garasje fra GarasjeProffen AS på Bryne. Velg mellom materialpakke og prefabrikkert garasje – vi leverer på Jæren, i Stavanger, Sandnes og omegn.",
  alternates: { canonical: "https://www.garasjeproffen.no/garasje" },
};

export default function GarasjePage() {
  return (
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
  );
}
