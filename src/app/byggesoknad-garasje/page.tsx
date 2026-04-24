import Link from "next/link";

export const metadata = {
  title: "Byggesøknad for garasje – hjelp med søknadsprosessen",
  description: "Trenger du hjelp med byggesøknad for garasje eller carport? GarasjeProffen AS hjelper deg med tegninger, situasjonsplan og innsending i Rogaland og på Jæren.",
  alternates: { canonical: "https://www.garasjeproffen.no/byggesoknad-garasje" },
};

const FAQ_ITEMS = [
  {
    q: "Trenger jeg byggesøknad for garasje?",
    a: "Det avhenger av størrelse og plassering. Garasjer under 50 m² og lavere enn 4 meter i mønehøyde kan ofte bygges uten søknad, forutsatt at de er i tråd med kommunens reguleringsplan og har tilstrekkelig avstand til nabogrense og vei. Vi hjelper deg å avklare hva som gjelder for din tomt.",
  },
  {
    q: "Hvor stor garasje kan jeg bygge uten å søke?",
    a: "Etter plan- og bygningsloven kan frittliggende bygg under 50 m² bygges uten søknad, forutsatt at de er lavere enn 4 meter i mønehøyde og oppfyller krav om avstand til nabogrense og vei. Kommunens reguleringsplan kan imidlertid ha strengere krav – sjekk alltid med oss eller kommunen din.",
  },
  {
    q: "Kan GarasjeProffen sende byggesøknaden på mine vegne?",
    a: "Ja, vi kan stå som ansvarlig søker og håndtere all kommunikasjon med kommunen. Da slipper du å følge opp papirarbeidet selv og vi holder deg oppdatert om fremdriften.",
  },
  {
    q: "Hva koster søknadshjelp fra GarasjeProffen?",
    a: "Prisen på søknadshjelp avhenger av hva saken krever. Enkle avklaringer er rimeligere enn saker som trenger dispensasjon eller detaljerte tegninger. Ta kontakt for et uforpliktende prisestimat.",
  },
  {
    q: "Hvor lang tid tar det å få byggetillatelse?",
    a: "Kommunen har 12 ukers behandlingsfrist etter plan- og bygningsloven. Mange kommuner behandler enklere garasjesøknader raskere. Saker som krever dispensasjon kan ta lengre tid.",
  },
  {
    q: "Hva er en situasjonsplan og trenger jeg det?",
    a: "En situasjonsplan er et kart som viser tomten din med plassering av eksisterende og planlagte bygninger, mål og avstand til nabogrenser. Dette er et krav i de fleste byggesøknader, og vi hjelper deg med å utarbeide det.",
  },
];

export default function ByggesoknadGarasje() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Byggesøknad for garasje
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        Å sende inn byggesøknad for garasje kan virke komplisert, men vi hjelper deg gjennom hele prosessen. GarasjeProffen AS har erfaring med søknader i kommunene på Jæren og i Rogaland – og vi kjenner kravene som gjelder lokalt.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Når trenger du byggesøknad?</h2>
        <p className="mt-3 text-gray-600">
          Ikke alle garasjer krever byggesøknad. Som en tommelfingerregel kan frittliggende bygg under 50 m² ofte oppføres uten søknad, men det finnes unntak. Faktorer som avgjør om du trenger søknad:
        </p>
        <ul className="mt-4 space-y-2 text-gray-600">
          {[
            "Størrelse – over 50 m² krever alltid søknad",
            "Høyde – mønehøyde over 4 meter krever søknad",
            "Avstand til nabogrense – under 4 meter kan utløse søknadsplikt",
            "Avstand til vei – kommunen har egne krav",
            "Reguleringsplan – kan ha strengere krav enn loven",
            "Plassering i strandsone eller vernede områder – egne regler gjelder",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-xl border border-orange-100 bg-orange-50 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900">Hva hjelper vi med?</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            { title: "Avklaring av søknadsbehov", desc: "Vi vurderer om din garasje trenger søknad basert på størrelse, plassering og kommunens krav." },
            { title: "Tegninger og situasjonsplan", desc: "Vi utarbeider tekniske tegninger og situasjonsplan som kommunen krever." },
            { title: "Innsending av søknad", desc: "Vi kan stå som ansvarlig søker og sende inn søknaden til kommunen på dine vegne." },
            { title: "Nabovarsel", desc: "Vi hjelper deg med å sende nabovarsel der det er påkrevd." },
            { title: "Dispensasjonssøknad", desc: "Trenger du dispensasjon fra reguleringsplanen? Vi hjelper deg å vurdere og søke." },
            { title: "Oppfølging mot kommunen", desc: "Vi håndterer kommunikasjon med kommunen og holder deg oppdatert underveis." },
          ].map((item) => (
            <div key={item.title}>
              <p className="font-semibold text-gray-900">{item.title}</p>
              <p className="mt-1 text-sm text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-gray-900">Slik fungerer det</h2>
        <ol className="mt-4 space-y-4">
          {[
            { nr: "1", title: "Ta kontakt", desc: "Fortell oss hva du ønsker å bygge og gi oss adressen til tomten din." },
            { nr: "2", title: "Vi vurderer søknadsbehov", desc: "Vi sjekker reguleringsplan, kommunens krav og vurderer om søknad er nødvendig." },
            { nr: "3", title: "Utarbeide dokumentasjon", desc: "Vi lager nødvendige tegninger, situasjonsplan og fyller ut søknadsskjemaer." },
            { nr: "4", title: "Innsending og oppfølging", desc: "Vi sender søknaden og følger opp med kommunen frem til vedtak foreligger." },
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

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900">Vanlige spørsmål om byggesøknad</h2>
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
        <Link href="/soknadshjelp" className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors">
          Start søknadsprosessen
        </Link>
        <Link href="/configurator" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          Design din garasje
        </Link>
        <Link href="/kontakt" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          Ta kontakt
        </Link>
      </div>

      <p className="mt-8 text-sm text-gray-500">
        Se også:{" "}
        <Link href="/prefabrikkert-garasje" className="text-orange-600 hover:underline">Prefabrikkert garasje</Link>{" · "}
        <Link href="/materialpakke-garasje" className="text-orange-600 hover:underline">Materialpakke</Link>{" · "}
        <Link href="/garasje-jaeren" className="text-orange-600 hover:underline">Garasje på Jæren</Link>
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />
    </div>
  );
}
