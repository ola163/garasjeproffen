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

const GARASJE_FAQ = [
  {
    q: "Hva koster en garasje fra GarasjeProffen?",
    a: "Prisen avhenger av størrelse, type og løsning. Bruk konfiguratoren vår for å designe garasjen din og få et prisestimat med én gang – helt uten forpliktelser.",
  },
  {
    q: "Hva er leveringstiden for garasje?",
    a: "Leveringstiden varierer med løsning og kapasitet. Med base på Bryne er vi tett på Jæren og Rogaland og kan levere raskt. Kontakt oss for oppdatert leveringstid.",
  },
  {
    q: "Trenger jeg byggesøknad for garasje i Rogaland?",
    a: "Garasjer over 50 m² krever byggesøknad. For mindre bygg varierer kravene mellom kommuner. Vi hjelper deg med å avklare hva som gjelder for din tomt og kan bistå med hele søknadsprosessen.",
  },
  {
    q: "Kan jeg få garasjen levert ferdigmontert?",
    a: "Ja, med prefabrikkert garasje produseres modulene på fabrikk og heises på plass av oss. Det gir raskere ferdigstillelse og redusert materialsvinn sammenlignet med tradisjonell bygning.",
  },
];

function GarasjeFaqSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: GARASJE_FAQ.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function GarasjePage() {
  return (
    <>
      <GarasjeFaqSchema />
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

      <div className="w-full border-t border-gray-100 py-14 px-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">Vanlige spørsmål om garasje</h2>
          <div className="divide-y divide-gray-100">
            {GARASJE_FAQ.map(({ q, a }) => (
              <details key={q} className="group py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-gray-900 marker:content-none">
                  {q}
                  <svg className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="mt-3 text-sm text-gray-500 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
