import Link from "next/link";

export const metadata = {
  title: "Garasje i Rogaland | Prefab, materialpakke og carport",
  description: "GarasjeProffen AS leverer garasjer og carporter i hele Rogaland. Base på Bryne – vi dekker Stavanger, Sandnes, Jæren og omegn raskt og til fast pris.",
  alternates: { canonical: "https://www.garasjeproffen.no/garasje-rogaland" },
};

const FAQ_ITEMS = [
  {
    q: "Leverer dere garasje i hele Rogaland?",
    a: "Ja, vi leverer garasjer og carporter i hele Rogaland. Med base på Bryne er vi godt plassert til å nå de fleste kommuner i regionen raskt og effektivt.",
  },
  {
    q: "Hvilke kommuner i Rogaland betjener dere?",
    a: "Vi betjener blant annet Time, Klepp, Hå, Gjesdal, Sandnes, Stavanger, Sola, Randaberg og Karmøy. Ta kontakt for å høre om vi kan levere til din kommune.",
  },
  {
    q: "Kan dere hjelpe med byggesøknad i Rogaland?",
    a: "Ja, vi tilbyr søknadshjelp for kunder i Rogaland. Vi hjelper deg å avklare om du trenger søknad og bistår med tegninger og dokumentasjon til kommunen.",
  },
  {
    q: "Er det mulig å tilpasse garasjen til tomten min?",
    a: "Absolutt. Via vår 3D-konfigurator kan du tilpasse dimensjoner, tak, port, kledning og andre detaljer til akkurat din tomt og dine ønsker.",
  },
  {
    q: "Hva er leveringstiden for garasje i Rogaland?",
    a: "Leveringstiden varierer avhengig av løsning og kapasitet, men for lokale kunder i Rogaland er vi raskt ute. Ta kontakt for en oppdatert estimert leveringstid.",
  },
];

export default function GarasjeRogaland() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Garasje i Rogaland
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        GarasjeProffen AS er din lokale leverandør av garasjer og carporter i Rogaland. Vi holder til på Bryne og dekker hele regionen – fra Stavanger og Sandnes i nord til Hå i sør. Med lokal kunnskap om byggeforskrifter, tomteforhold og leveringslogistikk gir vi deg et raskt og presist tilbud.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Hva vi tilbyr i Rogaland</h2>
        <ul className="mt-4 space-y-3 text-gray-600">
          {[
            { title: "Prefabrikkert garasje", desc: "Elementer produseres på verkstedet og monteres raskt på din tomt – uavhengig av vær og årstid." },
            { title: "Materialpakke", desc: "Komplett pakke med alle materialer for selvbygging eller bruk av egne håndverkere." },
            { title: "Carport", desc: "Åpen overbygging for bil – raskt, rimelig og tilpasset tomten din." },
            { title: "Søknadshjelp", desc: "Vi hjelper deg å avklare om du trenger byggesøknad og bistår med hele prosessen." },
            { title: "Tegninger og prosjektering", desc: "Vi leverer tegninger og teknisk dokumentasjon som kommunen krever." },
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
        <p className="mt-2 text-sm text-gray-600">
          Vi leverer primært til Jæren og Stavanger-regionen, og kan i mange tilfeller levere materialpakker til hele Norge.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["Stavanger", "Sandnes", "Bryne", "Time", "Klepp", "Hå", "Gjesdal", "Sola", "Randaberg", "Karmøy", "Nærbø", "Egersund"].map((k) => (
            <div key={k} className="rounded-lg bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700">
              {k}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-orange-100 bg-orange-50 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900">Fordeler med lokal leverandør</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { title: "Kort leveringstid", desc: "Med base på Bryne kan vi levere og montere raskt i hele Rogaland – uten lange ventelister." },
            { title: "Lokalkunnskap", desc: "Vi kjenner kommunenes krav og lokale tomteforhold, og gir deg råd tilpasset din situasjon." },
            { title: "Ærlig prissetting", desc: "Vi gir deg et klart prisestimat direkte i konfiguratoren – ingen skjulte kostnader." },
            { title: "Personlig oppfølging", desc: "Du har direkte kontakt med oss gjennom hele prosessen – fra design til ferdig garasje." },
          ].map((item) => (
            <div key={item.title}>
              <p className="font-semibold text-gray-900">{item.title}</p>
              <p className="mt-1 text-sm text-gray-600">{item.desc}</p>
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

      <div className="mt-10 flex flex-wrap gap-4">
        <Link href="/configurator" className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors">
          Design din garasje
        </Link>
        <Link href="/soknadshjelp" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          Søknadshjelp
        </Link>
        <Link href="/kontakt" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          Ta kontakt
        </Link>
      </div>

      <p className="mt-8 text-sm text-gray-500">
        Se også:{" "}
        <Link href="/garasje-jaeren" className="text-orange-600 hover:underline">Garasje på Jæren</Link>{" · "}
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
                { "@type": "ListItem", position: 2, name: "Garasje i Rogaland", item: "https://www.garasjeproffen.no/garasje-rogaland" },
              ],
            },
          ]),
        }}
      />
    </div>
  );
}
