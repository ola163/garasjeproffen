import Link from "next/link";

export const metadata = {
  title: "Garasje på Bryne | GarasjeProffen AS – Lokalt på Jæren",
  description: "Trenger du garasje på Bryne? GarasjeProffen AS er lokalisert på Bryne og leverer garasjer, carporter og materialpakker raskt og til riktig pris.",
  alternates: { canonical: "https://www.garasjeproffen.no/garasje-bryne" },
};

export default function GarasjeBryne() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Garasje på Bryne
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        GarasjeProffen AS holder til på Bryne og er din lokale leverandør av garasjer og carporter på Jæren. Vi kjenner lokale regler, tomteforhold og byggetradisjoner – og vi kan stille opp i person når det trengs.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Lokal leverandør</h2>
          <p className="mt-2 text-sm text-gray-600">
            Vi er basert på Bryne og leverer til hele Jæren. Kort avstand betyr rask levering, lavere fraktkostnader og enkel oppfølging gjennom hele prosjektet.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Prefab og materialpakke</h2>
          <p className="mt-2 text-sm text-gray-600">
            Velg mellom ferdigmontert prefabrikkert garasje eller materialpakke for selvbygging. Vi tilpasser løsningen til din tomt og dine ønsker.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Søknadshjelp</h2>
          <p className="mt-2 text-sm text-gray-600">
            Usikker på om du trenger byggesøknad? Vi hjelper deg med å avklare krav fra Time kommune og kan bistå med søknaden om nødvendig.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Ærlig prissetting</h2>
          <p className="mt-2 text-sm text-gray-600">
            Bruk konfiguratoren vår for et prisestimat med en gang – ingen skjulte kostnader, ingen overraskelser. Vi sender et endelig tilbud etter gjennomgang.
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
    </div>
  );
}
