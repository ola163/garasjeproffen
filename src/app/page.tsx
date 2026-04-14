import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <Image
          src="/logo.png"
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
        <div className="mt-8">
          <Link
            href="/configurator"
            className="inline-block rounded-lg bg-orange-500 px-8 py-3 text-lg font-medium text-white hover:bg-orange-600"
          >
            Start design
          </Link>
        </div>
        <p className="mt-6 text-sm text-gray-400">
          📍 Tjødnavegen 8b, 4342 Bryne
        </p>

        <div className="mt-10 border-t border-gray-100 pt-8">
          <h2 className="text-lg font-semibold text-gray-900">Kontakt oss</h2>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-10">
            <div className="text-center">
              <p className="font-medium text-gray-800">Christian Salte Årsland</p>
              <p className="text-sm text-gray-500">Daglig leder</p>
              <a href="mailto:christian@garasjeproffen.no"
                 className="mt-1 block text-sm text-orange-600 hover:text-orange-700">
                christian@garasjeproffen.no
              </a>
              <a href="tel:+4747617563"
                 className="block text-sm text-gray-500 hover:text-orange-600">
                +47 476 17 563
              </a>
            </div>
            <div className="hidden h-12 w-px bg-gray-200 sm:block" />
            <div className="text-center">
              <p className="font-medium text-gray-800">Ola K. Undheim</p>
              <p className="text-sm text-gray-500">Teknisk sjef</p>
              <a href="mailto:ola@garasjeproffen.no"
                 className="mt-1 block text-sm text-orange-600 hover:text-orange-700">
                ola@garasjeproffen.no
              </a>
              <a href="tel:+4791344486"
                 className="block text-sm text-gray-500 hover:text-orange-600">
                +47 913 44 486
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
