import Link from "next/link";

export const metadata = {
  title: "Garasje i Stavanger | Prefab og materialpakke | GarasjeProffen AS",
  description: "Trenger du garasje i Stavanger-regionen? GarasjeProffen AS leverer prefabrikkerte garasjer og materialpakker til Stavanger, Sandnes og Jæren.",
  alternates: { canonical: "https://www.garasjeproffen.no/garasje-stavanger" },
};

export default function GarasjeStavanger() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Garasje i Stavanger
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        GarasjeProffen AS leverer garasjer og carporter til Stavanger og omegn. Med base på Bryne – kun 40 minutter fra Stavanger – tilbyr vi rask levering og konkurransedyktige priser.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Prefabrikkert garasje</h2>
          <p className="mt-2 text-sm text-gray-600">
            Ferdigmontert garasje levert rett til tomten din i Stavanger. Kort montasjetid og forutsigbar pris.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Materialpakke</h2>
          <p className="mt-2 text-sm text-gray-600">
            All bygningsmateriale samlet i én pakke – perfekt for deg som vil bygge selv eller bruke egne håndverkere.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Søknadshjelp</h2>
          <p className="mt-2 text-sm text-gray-600">
            Stavanger kommune har egne regler for garasjebygg. Vi hjelper deg å navigere kravene og sender inn søknaden på dine vegne.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">3D-konfigurator</h2>
          <p className="mt-2 text-sm text-gray-600">
            Design garasjen din online og få et prisestimat med én gang – ingen forpliktelser, ingen ventetid.
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-xl bg-orange-50 border border-orange-100 p-8">
        <h2 className="text-xl font-semibold text-gray-900">Start i dag</h2>
        <p className="mt-2 text-gray-600">
          Bruk konfiguratoren for et prisestimat, eller kontakt oss for en uforpliktende prat.
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
  );
}
