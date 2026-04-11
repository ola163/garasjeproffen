import { Suspense } from "react";
import ConfiguratorShell from "@/components/configurator/ConfiguratorShell";

export const metadata = {
  title: "Design din garasje | GarasjeProffen.no",
  description:
    "Tilpass garasjens dimensjoner og få et prisestimat med en gang.",
};

export default function ConfiguratorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <span className="text-gray-600">Laster konfigurator...</span>
          </div>
        </div>
      }
    >
      <ConfiguratorShell />
    </Suspense>
  );
}
