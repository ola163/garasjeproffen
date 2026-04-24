import Link from "next/link";

export const metadata = {
  title: "Garasje i Sandnes | Prefab og materialpakke | GarasjeProffen AS",
  description: "Bestill garasje i Sandnes fra GarasjeProffen AS. Vi leverer prefabrikkerte garasjer og materialpakker med kort leveringstid til Sandnes og omegn.",
  alternates: { canonical: "https://www.garasjeproffen.no/garasje-sandnes" },
};

export default function GarasjeSandnes() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Garasje i Sandnes
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        GarasjeProffen AS leverer garasjer og carporter til Sandnes og nærliggende kommuner. Vi holder til på Bryne, rett sør for Sandnes, og tilbyr rask levering med lokalkunnskap om krav og terreng.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Kort leveringstid</h2>
          <p className="mt-2 text-sm text-gray-600">
            Fra Bryne til Sandnes er det kun minutter. Vi kan levere og montere raskt uten lange ventelister.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Skreddersydd løsning</h2>
          <p className="mt-2 text-sm text-gray-600">
            Vi tilpasser garasjen til din tomt i Sandnes – enten det er prefab, materialpakke eller en kombinasjon.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Byggesøknad</h2>
          <p className="mt-2 text-sm text-gray-600">
            Sandnes kommune har egne regler. Vi hjelper deg å avklare om du trenger søknad og bistår med dokumentasjonen.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Ærlig pris</h2>
          <p className="mt-2 text-sm text-gray-600">
            Prisestimat direkte i konfiguratoren – du vet hva du betaler før du forplikter deg til noe.
          </p>
        </div>
      </div>

      <div className="mt-12 rounded-xl bg-orange-50 border border-orange-100 p-8">
        <h2 className="text-xl font-semibold text-gray-900">Kom i gang</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/configurator" className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors">
            Design din garasje
          </Link>
          <Link href="/kontakt" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Ta kontakt
          </Link>
        </div>
      </div>
    </div>
  );
}
