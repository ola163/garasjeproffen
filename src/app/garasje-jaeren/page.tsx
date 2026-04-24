import Link from "next/link";

const FAQ_ITEMS = [
  {
    q: "Hvilke kommuner på Jæren leverer dere garasje til?",
    a: "Vi betjener Time, Klepp, Hå, Gjesdal, Sandnes, Stavanger, Sola og Randaberg. Har du tomt i en annen kommune på Jæren? Ta kontakt – vi strekker oss langt for lokale kunder.",
  },
  {
    q: "Kan jeg bestille materialpakke og bygge garasjen selv på Jæren?",
    a: "Ja, vi leverer komplette materialpakker med alle materialer spesifisert og kvalitetssikret. Du kan bruke egne håndverkere eller bygge selv – pakken fungerer uansett hvem som monterer.",
  },
  {
    q: "Hjelper dere med byggesøknad i Jæren-kommunene?",
    a: "Ja, vi tilbyr søknadshjelp i alle kommunene vi betjener på Jæren. Vi kjenner lokale krav og hjelper deg gjennom prosessen – fra vurdering til innsending.",
  },
  {
    q: "Hva er leveringstiden for garasje på Jæren?",
    a: "Med base på Bryne er vi tett på Jæren og kan levere raskere enn leverandører lenger unna. Nøyaktig leveringstid avhenger av løsning og kapasitet. Kontakt oss for en oppdatert leveringstid.",
  },
  {
    q: "Leverer dere garasjer utenfor Jæren?",
    a: "Ja, vi leverer materialpakker til hele Norge. For prefabrikkerte løsninger med montering fokuserer vi primært på Jæren og Rogaland, men ta kontakt om du er usikker på om vi kan nå din adresse.",
  },
];

export const metadata = {
  title: "Garasje på Jæren | Materialpakke og prefabrikkert | GarasjeProffen AS",
  description: "Bestill garasje eller carport på Jæren fra GarasjeProffen AS. Vi leverer prefabrikkerte løsninger og materialpakker til Time, Klepp, Hå, Gjesdal, Sandnes og Stavanger.",
  alternates: { canonical: "https://www.garasjeproffen.no/garasje-jaeren" },
};

export default function GarasjeJaeren() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Garasje på Jæren
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        GarasjeProffen AS er Jærens lokale leverandør av garasjer og carporter. Med base på Bryne dekker vi hele Jæren – fra Hå i sør til Sandnes i nord. Vi kjenner lokale byggeforskrifter og tomteforhold, og vi leverer raskt og til riktig pris.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Tjenester på Jæren</h2>
        <ul className="mt-4 space-y-3 text-gray-600">
          {[
            { title: "Prefabrikkert garasje", desc: "Elementer produseres på verkstedet og monteres raskt på din tomt – uansett vær." },
            { title: "Materialpakke", desc: "Komplett pakke med alle materialer for selvbygging. Perfekt for deg som vil gjøre jobben selv." },
            { title: "Carport", desc: "Åpen overbygging for bil – raskt, rimelig og tilpasset tomten din." },
            { title: "Søknadshjelp", desc: "Vi hjelper deg med å finne ut om du trenger byggesøknad og bistår med søknaden." },
          ].map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
              <span><strong>{item.title}:</strong> {item.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Kommuner vi betjener</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {["Time", "Klepp", "Hå", "Gjesdal", "Sandnes", "Stavanger", "Sola", "Randaberg"].map((k) => (
            <div key={k} className="rounded-lg bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700">
              {k}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900">Vanlige spørsmål</h2>
        <div className="mt-4 divide-y divide-gray-100">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} className="py-4">
              <h3 className="font-semibold text-gray-900">{item.q}</h3>
              <p className="mt-1 text-sm text-gray-600">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 rounded-xl bg-orange-50 border border-orange-100 p-8">
        <h2 className="text-xl font-semibold text-gray-900">Kom i gang</h2>
        <p className="mt-2 text-gray-600">
          Bruk konfiguratoren vår for å designe garasjen og få et øyeblikkelig prisestimat, eller ta kontakt direkte.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/configurator" className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors">
            Design din garasje
          </Link>
          <Link href="/soknadshjelp" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Søknadshjelp
          </Link>
          <Link href="/kontakt" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Kontakt oss
          </Link>
        </div>
      </div>
      <p className="mt-8 text-sm text-gray-500">
        Se også:{" "}
        <Link href="/garasje-rogaland" className="text-orange-600 hover:underline">Garasje i Rogaland</Link>{" · "}
        <Link href="/byggesoknad-garasje" className="text-orange-600 hover:underline">Byggesøknad for garasje</Link>{" · "}
        <Link href="/prefabrikkert-garasje" className="text-orange-600 hover:underline">Prefabrikkert garasje</Link>{" · "}
        <Link href="/materialpakke-garasje" className="text-orange-600 hover:underline">Materialpakke</Link>
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQ_ITEMS.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Forside", item: "https://www.garasjeproffen.no" },
                { "@type": "ListItem", position: 2, name: "Garasje på Jæren", item: "https://www.garasjeproffen.no/garasje-jaeren" },
              ],
            },
          ]),
        }}
      />
    </div>
  );
}
