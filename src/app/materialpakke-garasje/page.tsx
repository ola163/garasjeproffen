import Link from "next/link";

const FAQ_ITEMS = [
  {
    q: "Hva er inkludert i en materialpakke for garasje?",
    a: "Pakken inkluderer alle konstruksjonsmaterialer i tre, kledning, tak og undertaket, vinduer, dør og eventuell garasjeport etter din konfigurasjon, samt en komplett stykliste med varenummer og mengde. Alt er spesifisert og kvalitetssikret.",
  },
  {
    q: "Kan jeg bruke egne håndverkere eller bygge selv?",
    a: "Ja, det er hele poenget med materialpakken. Du bestemmer hvem som bygger – enten det er deg selv, en leid håndverker eller familien. Vi sørger for at du har alt du trenger.",
  },
  {
    q: "Kan jeg tilpasse materialpakken til min tomt og ønsker?",
    a: "Absolutt. Du bruker vår 3D-konfigurator til å tilpasse dimensjoner, takform, kledning, port og andre detaljer. Pakken spesifiseres nøyaktig etter din konfigurasjon.",
  },
  {
    q: "Leverer dere materialpakke til hele Norge?",
    a: "Ja, vi kan levere materialpakker over hele Norge. Leveringskostnader beregnes etter avstand. Ta kontakt for et nøyaktig tilbud.",
  },
  {
    q: "Hva er forskjellen på materialpakke og prefabrikkert garasje?",
    a: "Med materialpakken får du alle materialer for å bygge selv eller med egne håndverkere – vi leverer, men monterer ikke. Med prefabrikkert løsning produserer vi elementer og monterer dem ferdig på tomten din. Prefab er raskere; materialpakke er ofte rimeligere og mer fleksibelt.",
  },
];

export const metadata = {
  title: "Materialpakke garasje | Alt du trenger for selvbygging | GarasjeProffen AS",
  description: "Kjøp en komplett materialpakke for garasje fra GarasjeProffen AS. Alle materialer spesifisert og klare for selvbygging eller montering av egne håndverkere. Rogaland og hele Norge.",
  alternates: { canonical: "https://www.garasjeproffen.no/materialpakke-garasje" },
};

export default function MaterialpakkeGarasje() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Materialpakke for garasje
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        Vil du bygge garasjen selv, eller bruke dine egne håndverkere? Vår materialpakke gir deg alt du trenger – spesifisert og kvalitetssikret – slik at du slipper å samle materialer fra mange leverandører.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Hva er inkludert?</h2>
        <ul className="mt-4 space-y-2 text-gray-600">
          {[
            "Alle konstruksjonsmaterialer i tre (stendere, bjelker, sperrer)",
            "Kledning og panel etter valgt design",
            "Tak og undertaket",
            "Vinduer og dør etter konfigurasjon",
            "Garasjeport (valgfritt)",
            "Komplett stykliste med varenummer og mengde",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-xl border border-orange-100 bg-orange-50 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900">Fordeler med materialpakke</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { title: "Spar tid", desc: "Alt spesifisert og samlet – du bestiller én pakke, ikke 20 produkter fra ulike leverandører." },
            { title: "Trygg prissetting", desc: "Du vet nøyaktig hva du betaler for materialene. Bruk konfiguratoren for prisestimat." },
            { title: "Fleksibelt", desc: "Bruk egne håndverkere eller bygg selv. Pakken fungerer uansett hvem som monterer." },
            { title: "Tilpasset din tomt", desc: "Vi tilpasser spesifikasjonen til dine mål og ønsker via 3D-konfiguratoren." },
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
          Konfigurer og få prisestimat
        </Link>
        <Link href="/prefabrikkert-garasje" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          Se prefabrikkert alternativet
        </Link>
        <Link href="/kontakt" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          Ta kontakt
        </Link>
      </div>

      <p className="mt-8 text-sm text-gray-500">
        Se også:{" "}
        <Link href="/byggesoknad-garasje" className="text-orange-600 hover:underline">Byggesøknad for garasje</Link>{" · "}
        <Link href="/garasje-rogaland" className="text-orange-600 hover:underline">Garasje i Rogaland</Link>{" · "}
        <Link href="/garasje-jaeren" className="text-orange-600 hover:underline">Garasje på Jæren</Link>{" · "}
        <Link href="/carport" className="text-orange-600 hover:underline">Carport</Link>
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
                { "@type": "ListItem", position: 2, name: "Materialpakke garasje", item: "https://www.garasjeproffen.no/materialpakke-garasje" },
              ],
            },
          ]),
        }}
      />
    </div>
  );
}
