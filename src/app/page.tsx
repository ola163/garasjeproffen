import Image from "next/image";
import type { Metadata } from "next";
import HeroButtons from "@/components/home/HeroButtons";
import ReferansePreview from "@/components/referanseprosjekter/ReferansePreview";

export const metadata: Metadata = {
  title: "Garasje og carport tilpasset din tomt | GarasjeProffen AS",
  description:
    "GarasjeProffen AS leverer garasjer og carporter tilpasset mål, behov og tomt. Velg materialpakke for egen montering eller prefabrikkert løsning. Org.nr. 937 606 966.",
  alternates: { canonical: "https://www.garasjeproffen.no" },
};

export default function Home() {
  return (
    <>
    <HomeFaqSchema />
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-12 gap-12">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-16">

        {/* Left: description — server-rendered, crawlable */}
        <div className="flex-1 text-left order-last lg:order-first">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 leading-snug">
            Fra idé til ferdig garasje — vi tar oss av alt
          </h2>
          <p className="mt-4 text-base text-gray-600 leading-relaxed">
            Design garasjen din i 3D, få pris på sekunder, og la oss håndtere byggesøknaden.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Tilpasses dine mål, behov og tomt",
              "Materialpakke leveres klar for montering – du bygger selv",
              "Prefabrikkerte moduler – heises på plass av oss",
              "Effektiv produksjon med redusert materialsvinn",
              "Levering over hele Norge",
              "Vi kan bistå med tegninger og byggesøknad",
            ].map((text) => (
              <li key={text} className="flex items-start gap-3 text-sm text-gray-700">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {text}
              </li>
            ))}
          </ul>

          {/* Contact info — server-rendered */}
          <div className="mt-8 flex flex-wrap gap-4 text-sm text-gray-500">
            <a href="tel:+4747617563" className="flex items-center gap-1.5 hover:text-orange-500">
              <svg className="h-4 w-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              +47 476 17 563
            </a>
            <a href="mailto:post@garasjeproffen.no" className="flex items-center gap-1.5 hover:text-orange-500">
              <svg className="h-4 w-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              post@garasjeproffen.no
            </a>
          </div>

          {/* Referanseprosjekter — client component, lazy */}
          <ReferansePreview />
        </div>

        {/* Right: configurator panel */}
        <div className="w-full max-w-sm flex-shrink-0 text-center order-first lg:order-last">
          <Image
            src="/logo.jpg"
            alt="GarasjeProffen AS – garasjer og carporter"
            width={400}
            height={120}
            className="mx-auto mb-6 h-auto w-72"
            priority
          />
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Start garasjedesign
          </h1>
          <p className="mt-3 text-base text-gray-600">
            Tilpass garasjen etter dine mål og tomt, og få et prisestimat med én gang.
          </p>

          {/* Interactive buttons — client component */}
          <HeroButtons />

          {/* 3-stegs prosess */}
          <p className="mt-6 mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 text-center">Din garasje – steg for steg</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { step: "1", title: "Konfigurer", desc: "Design i 3D og få pris med én gang" },
              { step: "2", title: "Vi søker", desc: "Vi tar all papirarbeid og kommunal godkjenning" },
              { step: "3", title: "Nøkkelferdig", desc: "Monteres på 1–2 dager på din tomt" },
            ].map(({ step, title, desc }) => (
              <div key={step} className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-center">
                <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                  {step}
                </div>
                <p className="text-xs font-semibold text-gray-900">{title}</p>
                <p className="mt-1 text-xs text-gray-500 leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>

    </>
  );
}

const HOME_FAQ = [
  {
    q: "Hva er forskjellen på materialpakke og prefabrikkert garasje?",
    a: "Med materialpakke får du alle materialer levert og monterer selv – eller bruker egne håndverkere. Prefabrikkert garasje er ferdigproduserte moduler som heises på plass av GarasjeProffen, noe som gir en raskere og mer effektiv byggeprosess.",
  },
  {
    q: "Trenger jeg byggesøknad for å bygge garasje?",
    a: "Garasjer over 50 m² krever byggesøknad. Mindre garasjer og carporter kan i mange tilfeller bygges uten søknad, men reglene varierer mellom kommuner. GarasjeProffen AS hjelper deg med å avklare dette og kan bistå med hele søknadsprosessen.",
  },
  {
    q: "Leverer dere garasjer over hele Norge?",
    a: "Ja, vi leverer materialpakker til hele Norge. For prefabrikkerte løsninger med montering fokuserer vi på Jæren og Rogaland. Ta kontakt for å avklare levering til din adresse.",
  },
  {
    q: "Kan jeg tilpasse størrelsen og utformingen av garasjen?",
    a: "Ja, alle løsninger fra GarasjeProffen AS er skreddersydd etter din tomt og dine behov. Bruk vår konfigurator for å designe garasjen og få et prisestimat med én gang.",
  },
];

export function HomeFaqSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQ.map(({ q, a }) => ({
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
