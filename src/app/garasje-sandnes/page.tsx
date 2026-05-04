import Link from "next/link";

export const metadata = {
  title: "Garasje i Sandnes | Prefab og materialpakke | GarasjeProffen AS",
  description: "Bestill garasje i Sandnes fra GarasjeProffen AS. Vi leverer prefabrikkerte garasjer og materialpakker til Ganddal, Lura, Bogafjell, Stangeland og hele Sandnes.",
  alternates: { canonical: "https://www.garasjeproffen.no/garasje-sandnes" },
};

const FAQ_ITEMS = [
  {
    q: "Leverer dere garasje til Ganddal, Lura og Bogafjell i Sandnes?",
    a: "Ja, vi leverer til alle områder i Sandnes kommune – inkludert Ganddal, Lura, Bogafjell, Stangeland, Vatnekrossen, Austrått og Figgjo. Fra Bryne er det kort vei og vi kjenner lokale tomteforhold godt.",
  },
  {
    q: "Hva er leveringstiden for garasje til Sandnes?",
    a: "Med base på Bryne – rett sør for Sandnes – kan vi levere raskt. Nøyaktig leveringstid avhenger av løsning og kapasitet. Ta kontakt for oppdatert leveringstid og tilgjengelighet.",
  },
  {
    q: "Trenger jeg byggesøknad for garasje i Sandnes kommune?",
    a: "Sandnes kommune har egne regler for garasjer og uthus. Garasjer over 50 m² krever alltid søknad. For mindre bygg avhenger det av plassering og reguleringsplan. Vi hjelper deg å avklare hva som gjelder for din eiendom.",
  },
  {
    q: "Kan jeg hente materialpakke hos dere, eller leverer dere til Sandnes?",
    a: "Vi leverer direkte til din adresse i Sandnes. Du slipper å organisere transport selv – alt materiale leveres samlet og klart for montering.",
  },
  {
    q: "Er det mulig å få garasje tilpasset et smalt eller skrått tomteforhold i Sandnes?",
    a: "Ja, alle løsninger fra GarasjeProffen tilpasses tomten din. Bruk konfiguratoren for å legge inn dine mål, eller ta kontakt så går vi gjennom mulighetene for akkurat din tomt i Sandnes.",
  },
];

function SandnesFaqSchema() {
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

export default function GarasjeSandnes() {
  return (
    <>
      <SandnesFaqSchema />
      <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Garasje i Sandnes
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          GarasjeProffen AS leverer garasjer og carporter til Sandnes og omegn. Vi holder til på Bryne – rett sør for Sandnes – og leverer raskt med lokalkunnskap om kommunens krav, tomteforhold og boligfelt i hele kommunen.
        </p>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Kort leveringstid</h2>
            <p className="mt-2 text-sm text-gray-600">
              Fra Bryne til Sandnes er det under 20 minutter. Vi er raskt på plass, unngår lange ventelister og kan følge opp prosjektet ditt gjennom hele prosessen.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Prefab og materialpakke</h2>
            <p className="mt-2 text-sm text-gray-600">
              Velg ferdigmontert prefabrikkert garasje – moduler heises på plass av oss – eller bestill materialpakke og organiser monteringen selv. Vi tilpasser til din tomt i Sandnes.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Byggesøknad i Sandnes</h2>
            <p className="mt-2 text-sm text-gray-600">
              Sandnes kommune stiller egne krav til garasjebygg. Vi hjelper deg å avklare om du trenger søknad, og bistår med tegninger, situasjonsplan og innsending.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Skreddersydd for din tomt</h2>
            <p className="mt-2 text-sm text-gray-600">
              Ny bolig i Bogafjell, eldre tomt i Lura eller landlig tomt i Ganddal – vi tilpasser garasjen til akkurat dine forutsetninger. Prisestimat direkte i konfiguratoren.
            </p>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900">Områder vi betjener i Sandnes</h2>
          <p className="mt-3 text-gray-600">
            Vi leverer garasjer og carporter til hele Sandnes kommune – inkludert Ganddal, Lura, Bogafjell, Stangeland, Vatnekrossen, Austrått, Figgjo, Hana og sentrum. Ta kontakt om du er usikker på om vi dekker din adresse.
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
          <h2 className="text-xl font-semibold text-gray-900">Kom i gang</h2>
          <p className="mt-2 text-gray-600">
            Design garasjen din i konfiguratoren og få et prisestimat med én gang, eller kontakt oss direkte for en uforpliktende prat.
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
          <Link href="/garasje-stavanger" className="text-orange-600 hover:underline">Garasje i Stavanger</Link>{" · "}
          <Link href="/garasje-bryne" className="text-orange-600 hover:underline">Garasje på Bryne</Link>{" · "}
          <Link href="/garasje-jaeren" className="text-orange-600 hover:underline">Garasje på Jæren</Link>
        </p>
      </div>
    </>
  );
}
