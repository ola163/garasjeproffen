import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kontakt oss",
  description: "Ta kontakt med GarasjeProffen AS på Bryne. Vi hjelper deg med garasje, carport, materialpakke, prefab og byggesøknad i Rogaland og på Jæren.",
  alternates: { canonical: "https://www.garasjeproffen.no/kontakt" },
};

export default function KontaktLayout({ children }: { children: React.ReactNode }) {
  return children;
}
