import { Suspense } from "react";
import ConfiguratorShell from "@/components/configurator/ConfiguratorShell";

export const metadata = {
  title: "Carport på Jæren | Materialpakke og prefabrikkert",
  description: "Bestill carport fra GarasjeProffen AS. Velg materialpakke eller ferdigmontert carport – vi leverer i Rogaland, fra Bryne til Stavanger og Sandnes.",
  alternates: { canonical: "https://www.garasjeproffen.no/carport" },
};

export default function CarportPage() {
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
      <ConfiguratorShell buildingType="carport" />
    </Suspense>
  );
}
