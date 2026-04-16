import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-12">
      <div className="max-w-2xl text-center">
        <Image
          src="/logo.jpg"
          alt="GarasjeProffen.no"
          width={300}
          height={75}
          className="mx-auto mb-8 h-auto w-64"
          priority
        />
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Design din egen garasje
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          Bruk vår interaktive 3D-konfigurator til å tilpasse garasjen etter
          dine behov og få et prisestimat med en gang.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/configurator"
            className="inline-block rounded-lg bg-orange-500 px-8 py-3 text-lg font-medium text-white hover:bg-orange-600"
          >
            Start design
          </Link>
          <Link
            href="/soknadshjelp"
            className="inline-block rounded-lg border border-orange-400 px-8 py-3 text-lg font-medium text-orange-600 hover:bg-orange-50"
          >
            Søknadshjelp
          </Link>
        </div>

        {/* Package info boxes */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 text-left">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <h2 className="text-sm font-semibold text-gray-900">Materialpakke</h2>
            <p className="mt-2 text-sm text-gray-600">
              Vi leverer alle materialer ferdig spesifisert og tilskåret – du eller din bygger setter opp garasjen selv. Kostnadseffektivt alternativ for deg som vil ha kontroll på byggeprosessen.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
            <h2 className="text-sm font-semibold text-gray-900">Prefab element</h2>
            <p className="mt-2 text-sm text-gray-600">
              Ferdigproduserte veggelementer og tak levert til tomten din, klare for montering. Raskere og enklere å sette opp – perfekt for deg som ønsker en effektiv byggeprosess.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
