import Link from "next/link";

export const metadata = {
  title: "Garasje i Stavanger | Prefab og materialpakke | GarasjeProffen AS",
  description: "Trenger du garasje i Stavanger? GarasjeProffen AS leverer prefabrikkerte garasjer og materialpakker til Stavanger, Forus, Hundvåg, Madla og hele Stavanger-regionen.",
  alternates: { canonical: "https://www.garasjeproffen.no/garasje-stavanger" },
};

const FAQ_ITEMS = [
  {
    q: "Leverer dere prefabrikkert garasje til Stavanger kommune?",
    a: "Ja, vi leverer og monterer prefabrikkerte garasjer i hele Stavanger kommune – inkludert Hundvåg, Madla, Tasta, Eiganes, Storhaug, Hillevåg og Forus. Ta kontakt for oppdatert kapasitet og leveringstid.",
  },
  {
    q: "Hva koster levering av garasje til Stavanger?",
    a: "Fra vår base på Bryne er det ca. 40 minutter til Stavanger. Fraktkostnadene er konkurransedyktige – bruk konfiguratoren for et komplett prisestimat inkludert levering.",
  },
  {
    q: "Hjelper dere med byggesøknad i Stavanger kommune?",
    a: "Ja. Stavanger kommune har egne regler for plassering, gesimshøyde og avstand til nabogrense. Vi hjelper deg å avklare hva som gjelder for din tomt og kan sende inn søknaden på dine vegne.",
  },
  {
    q: "Kan jeg bestille materialpakke og bygge garasjen selv i Stavanger?",
    a: "Absolutt. Vi leverer komplette materialpakker rett til byggeplassen din i Stavanger – du organiserer monteringen selv eller bruker egne håndverkere. Alt materiale er spesifisert og kvalitetssikret.",
  },
  {
    q: "Er det mulig å se ferdige garasjer fra GarasjeProffen i Stavanger-området?",
    a: "Vi har referanseprosjekter fra Stavanger og omegn. Ta kontakt så formidler vi kontakt med fornøyde kunder, eller se bildegalleri på vår referanseprosjektside.",
  },
];

function StavangerFaqSchema() {
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

export default function GarasjeStavanger() {
  return (
    <>
      <StavangerFaqSchema />
      <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Garasje i Stavanger
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          GarasjeProffen AS leverer garasjer og carporter til Stavanger og omegn. Med base på Bryne – kun 40 minutter fra Stavanger – tilbyr vi rask levering, lokalkunnskap om kommunens byggereglar og konkurransedyktige priser.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Prefabrikkert garasje</h2>
            <p className="mt-2 text-sm text-gray-600">
              Ferdigproduserte moduler heises på plass av oss direkte på tomten din i Stavanger. Raskere ferdigstillelse og forutsigbar pris – uavhengig av vær og årstid.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Materialpakke</h2>
            <p className="mt-2 text-sm text-gray-600">
              Komplett materialpakke levert til din adresse i Stavanger. Perfekt for deg som vil bruke egne håndverkere eller bygge selv – alt materiale er spesifisert og klart for montering.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Søknadshjelp</h2>
            <p className="mt-2 text-sm text-gray-600">
              Stavanger kommune stiller egne krav til gesimshøyde, avstand til nabogrense og plassering. Vi kjenner reglene og hjelper deg gjennom søknadsprosessen – fra vurdering til innsending.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">3D-konfigurator</h2>
            <p className="mt-2 text-sm text-gray-600">
              Design garasjen tilpasset din tomt i Stavanger og få et prisestimat med én gang – inkludert frakt. Ingen forpliktelser, ingen ventetid.
            </p>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900">Bydeler og områder vi betjener i Stavanger</h2>
          <p className="mt-3 text-gray-600">
            Vi leverer garasjer og carporter til alle bydeler i Stavanger kommune, inkludert Hundvåg, Madla, Tasta, Eiganes og Våland, Storhaug, Hillevåg, Hinna, Forus og Bekkefaret. Usikker på om vi dekker din adresse? Ta kontakt.
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

        <div className="mt-12 rounded-xl bg-orange-50 border border-orange-100 p-8">
          <h2 className="text-xl font-semibold text-gray-900">Start i dag</h2>
          <p className="mt-2 text-gray-600">
            Bruk konfiguratoren for et prisestimat, eller kontakt oss for en uforpliktende prat om garasje i Stavanger.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/configurator" className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors">
              Design din garasje
            </Link>
            <Link href="/kontakt" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
              Ta kontakt
            </Link>
          </div>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          Se også:{" "}
          <Link href="/garasje-sandnes" className="text-orange-600 hover:underline">Garasje i Sandnes</Link>{" · "}
          <Link href="/garasje-bryne" className="text-orange-600 hover:underline">Garasje på Bryne</Link>{" · "}
          <Link href="/garasje-jaeren" className="text-orange-600 hover:underline">Garasje på Jæren</Link>
        </p>
      </div>
    </>
  );
}
