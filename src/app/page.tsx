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
      </div>
    </div>
  );
}
