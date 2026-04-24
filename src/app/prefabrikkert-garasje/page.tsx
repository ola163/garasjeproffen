import Link from "next/link";

const FAQ_ITEMS = [
  {
    q: "Hva er en prefabrikkert garasje?",
    a: "En prefabrikkert garasje er en garasje der hovedelementene – vegger, tak og rammeverk – produseres ferdig på fabrikk og fraktes til tomten din for montering. Dette gir kortere byggetid, bedre kvalitetskontroll og lavere risiko for forsinkelser sammenlignet med tradisjonell bygning.",
  },
  {
    q: "Hvor lang tid tar montering av en prefabrikkert garasje?",
    a: "For de fleste garasjer er monteringen ferdig på 1–2 dager. Eksakt tid avhenger av garasjens størrelse og tomtens tilgjengelighet.",
  },
  {
    q: "Kan jeg tilpasse størrelse og utseende på en prefab garasje?",
    a: "Ja, vi tilbyr full tilpasning av dimensjoner, tak, porttype, kledning og vinduer via vår 3D-konfigurator. Du ser resultatet i 3D og får et prisestimat med én gang.",
  },
  {
    q: "Trenger jeg byggesøknad for prefabrikkert garasje?",
    a: "Behovet for byggesøknad avhenger av størrelse og plassering – ikke om garasjen er prefabrikkert. Garasjer under 50 m² kan i mange tilfeller bygges uten søknad, men dette avhenger av kommunens reguleringsplan. Vi hjelper deg å avklare hva som gjelder for din tomt.",
  },
  {
    q: "Leverer dere prefabrikkert garasje over hele Norge?",
    a: "Vi monterer primært i Rogaland og på Jæren, men kan levere garasjeelementer for selvmontering til hele landet. Ta kontakt for mer informasjon.",
  },
];

export const metadata = {
  title: "Prefabrikkert garasje | Rask montering | GarasjeProffen AS",
  description: "Prefabrikkert garasje fra GarasjeProffen AS – elementer produseres på verkstedet og monteres raskt på din tomt. Forutsigbar pris, høy kvalitet og kort byggetid. Rogaland og Jæren.",
  alternates: { canonical: "https://www.garasjeproffen.no/prefabrikkert-garasje" },
};

export default function PrefabrikertGarasje() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Prefabrikkert garasje
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        Vår prefabrikkerte løsning gir deg en ferdig garasje på rekordtid. Elementene produseres ferdig på verkstedet vårt på Bryne og monteres på din tomt – uavhengig av vær og årstid.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Slik fungerer det</h2>
        <ol className="mt-4 space-y-4">
          {[
            { nr: "1", title: "Design og konfigurasjon", desc: "Bruk 3D-konfiguratoren vår til å velge dimensjoner, tak, port og tilvalg." },
            { nr: "2", title: "Tilbud og godkjenning", desc: "Du mottar et komplett tilbud. Vi avklarer tomteforhold og søknadskrav." },
            { nr: "3", title: "Produksjon på verkstedet", desc: "Elementene produseres kontrollert i innendørs miljø – ingen forsinkelser fra dårlig vær." },
            { nr: "4", title: "Montering på tomten", desc: "Erfarne montører setter opp garasjen på tomten din. Vanligvis ferdig på 1–2 dager." },
          ].map((step) => (
            <li key={step.nr} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">
                {step.nr}
              </span>
              <div>
                <p className="font-semibold text-gray-900">{step.title}</p>
                <p className="mt-0.5 text-sm text-gray-600">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 rounded-xl border border-orange-100 bg-orange-50 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900">Fordeler med prefab</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { title: "Rask byggetid", desc: "Garasjen er klar på dager, ikke uker. Minimalt med rot og bråk på tomten din." },
            { title: "Forutsigbar pris", desc: "Alt er inkludert i tilbudet – materialer, transport og montering. Ingen skjulte kostnader." },
            { title: "Høy kvalitet", desc: "Produksjon i innendørs miljø gir bedre kvalitetskontroll enn bygging på åpen tomt." },
            { title: "Komplett leveranse", desc: "Vi koordinerer alt – fra planlegging til ferdig garasje. Du slipper å styre mange aktører." },
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
        <Link href="/materialpakke-garasje" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          Se materialpakke-alternativet
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
                { "@type": "ListItem", position: 2, name: "Prefabrikkert garasje", item: "https://www.garasjeproffen.no/prefabrikkert-garasje" },
              ],
            },
          ]),
        }}
      />
    </div>
  );
}
