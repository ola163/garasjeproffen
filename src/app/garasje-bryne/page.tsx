import Link from "next/link";

export const metadata = {
  title: "Garasje på Bryne | GarasjeProffen AS – Lokalt på Jæren",
  description: "Trenger du garasje på Bryne? GarasjeProffen AS holder til på Tjødnavegen 8b, Bryne og leverer garasjer, carporter og materialpakker med kortest mulig leveringstid.",
  alternates: { canonical: "https://www.garasjeproffen.no/garasje-bryne" },
};

const FAQ_ITEMS = [
  {
    q: "Har GarasjeProffen showroom eller kontor på Bryne?",
    a: "Vi holder til på Tjødnavegen 8b, 4342 Bryne. Ta kontakt for å avtale et møte – vi tar gjerne en prat om ditt garasjeprosjekt på kontoret.",
  },
  {
    q: "Hva er fordelen med å velge en lokal garasjeleverandør på Bryne?",
    a: "Som lokal leverandør kjenner vi tomteforholdene, kommunens krav og byggetradisjonene på Jæren. Du får kortere leveringstid, lavere fraktkostnader og direkte kontakt gjennom hele prosjektet – uten mellomledd.",
  },
  {
    q: "Trenger jeg byggesøknad for garasje i Time kommune?",
    a: "Time kommune følger plan- og bygningsloven. Garasjer over 50 m² krever søknad. For mindre bygg avhenger det av avstand til nabogrense og reguleringsplan. Vi hjelper deg å avklare hva som gjelder for akkurat din eiendom.",
  },
  {
    q: "Kan jeg hente materialpakke direkte på Bryne?",
    a: "Ta kontakt for å avtale dette. Vi leverer normalt direkte til byggeplassen din, men for kunder på Bryne og nærområdet kan vi finne en praktisk løsning.",
  },
  {
    q: "Leverer dere garasjer til gårdsbruk og landbrukseiendommer på Jæren?",
    a: "Ja, vi har erfaring med garasjer og uthus til ulike tomtetyper – inkludert landbrukseiendommer på Jæren. Kontakt oss for en tilpasset løsning.",
  },
];

function BryneFaqSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
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

export default function GarasjeBryne() {
  return (
    <>
      <BryneFaqSchema />
      <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Garasje på Bryne
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          GarasjeProffen AS holder til på Bryne og er din lokale leverandør av garasjer og carporter på Jæren. Vi kjenner lokale regler, tomteforhold og byggetradisjoner – og vi kan stille opp i person når det trengs.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Lokal leverandør på Jæren</h2>
            <p className="mt-2 text-sm text-gray-600">
              Vi er basert på Bryne og leverer til hele Jæren. Ingen mellomledd, kort avstand og lavere fraktkostnader. Du har direkte kontakt med oss gjennom hele prosjektet.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Prefab og materialpakke</h2>
            <p className="mt-2 text-sm text-gray-600">
              Velg prefabrikkert garasje – moduler produseres og heises på plass av oss – eller materialpakke for selvbygging. Vi tilpasser løsningen til din tomt og dine ønsker.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Søknadshjelp i Time</h2>
            <p className="mt-2 text-sm text-gray-600">
              Usikker på om du trenger byggesøknad? Vi kjenner Time kommunes krav og hjelper deg med vurdering, tegninger og innsending – slik at prosessen går raskt og riktig.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Ærlig prissetting</h2>
            <p className="mt-2 text-sm text-gray-600">
              Bruk konfiguratoren vår for et prisestimat med én gang – ingen skjulte kostnader, ingen overraskelser. Vi sender et endelig tilbud etter gjennomgang av din tomt.
            </p>
          </div>
        </div>

        <div className="mt-12 rounded-xl bg-orange-50 border border-orange-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900">Besøksadresse</h2>
          <p className="mt-2 text-gray-600">Tjødnavegen 8b, 4342 Bryne</p>
          <p className="mt-1 text-sm text-gray-500">Vi tar gjerne et møte – kontakt oss for avtale.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/configurator" className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors">
              Design din garasje
            </Link>
            <Link href="/kontakt" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Ta kontakt
            </Link>
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900">Vi leverer til hele Jæren</h2>
          <p className="mt-3 text-gray-600">
            Fra Bryne leverer vi til Time, Klepp, Hå, Gjesdal, Sandnes og Stavanger. Se også våre sider for{" "}
            <Link href="/garasje-jaeren" className="text-orange-600 hover:underline">garasje på Jæren</Link>,{" "}
            <Link href="/garasje-stavanger" className="text-orange-600 hover:underline">garasje i Stavanger</Link> og{" "}
            <Link href="/garasje-sandnes" className="text-orange-600 hover:underline">garasje i Sandnes</Link>.
          </p>
        </div>

        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900">Vanlige spørsmål</h2>
          <div className="mt-4 space-y-4">
            {FAQ_ITEMS.map(({ q, a }) => (
              <div key={q} className="rounded-lg border border-gray-100 bg-gray-50 p-5">
                <p className="font-medium text-gray-900">{q}</p>
                <p className="mt-2 text-sm text-gray-600">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
