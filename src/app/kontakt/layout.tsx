import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kontakt oss",
  description: "Ta kontakt med GarasjeProffen AS. Ring +47 476 17 563, send e-post eller besøk oss på Tjødnavegen 8b, Bryne. Vi hjelper deg med garasje, carport og byggesøknad i Rogaland.",
  alternates: { canonical: "https://www.garasjeproffen.no/kontakt" },
};

export default function KontaktLayout({ children }: { children: React.ReactNode }) {
  return children;
}
