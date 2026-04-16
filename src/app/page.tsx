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
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 4a1 1 0 10-2 0v1H7a1 1 0 000 2h.071l.47 7.06A2 2 0 009.537 16h4.926a2 2 0 001.996-1.94L16.929 7H17a1 1 0 000-2h-2V4a1 1 0 10-2 0v1h-2V4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Byggesett / materialpakke</h2>
              <p className="text-sm text-gray-500">Bygg selv – komplett materialpakke</p>
            </div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Prefabrikert løsning / element</h2>
              <p className="text-sm text-gray-500">Ferdige elementer – rask montering</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
