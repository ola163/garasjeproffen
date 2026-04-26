import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import HeroButtons from "@/components/home/HeroButtons";
import ReferansePreview from "@/components/referanseprosjekter/ReferansePreview";

export const metadata: Metadata = {
  title: "Garasje og carport tilpasset din tomt | GarasjeProffen AS",
  description:
    "GarasjeProffen AS leverer garasjer og carporter tilpasset mål, behov og tomt. Velg materialpakke for egen montering eller prefabrikkert løsning. Org.nr. 937 606 966.",
  alternates: { canonical: "https://www.garasjeproffen.no" },
};

export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-12 gap-12">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center lg:items-start gap-12 lg:gap-16">

        {/* Left: description — server-rendered, crawlable */}
        <div className="flex-1 text-left order-last lg:order-first">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 leading-snug">
            Garasje og carport tilpasset din tomt
          </h2>
          <p className="mt-4 text-base text-gray-600 leading-relaxed">
            GarasjeProffen AS leverer garasjer og carporter tilpasset mål, behov og tomt.
            Velg mellom komplette materialpakker for egen montering, eller prefabrikkerte
            løsninger som gir en raskere og mer effektiv byggeprosess.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Tilpasses dine mål, behov og tomt",
              "Materialpakke leveres klar for montering – du bygger selv",
              "Prefabrikkerte moduler – heises på plass av oss",
              "Effektiv produksjon med redusert materialsvinn",
              "Levering over hele Norge",
              "Vi kan bistå med tegninger og byggesøknad",
            ].map((text) => (
              <li key={text} className="flex items-start gap-3 text-sm text-gray-700">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {text}
              </li>
            ))}
          </ul>

          {/* Contact info — server-rendered */}
          <div className="mt-8 flex flex-wrap gap-4 text-sm text-gray-500">
            <a href="tel:+4747617563" className="flex items-center gap-1.5 hover:text-orange-500">
              <svg className="h-4 w-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              +47 476 17 563
            </a>
            <a href="mailto:post@garasjeproffen.no" className="flex items-center gap-1.5 hover:text-orange-500">
              <svg className="h-4 w-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              post@garasjeproffen.no
            </a>
          </div>

          {/* Referanseprosjekter — client component, lazy */}
          <ReferansePreview />
        </div>

        {/* Right: configurator panel */}
        <div className="w-full max-w-sm flex-shrink-0 text-center order-first lg:order-last">
          <Image
            src="/logo.jpg"
            alt="GarasjeProffen AS – garasjer og carporter"
            width={400}
            height={120}
            className="mx-auto mb-6 h-auto w-72"
            priority
          />
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Start garasjedesign
          </h1>
          <p className="mt-3 text-base text-gray-600">
            Tilpass garasjen etter dine mål og tomt, og få et prisestimat med én gang.
          </p>

          {/* Interactive buttons — client component */}
          <HeroButtons />
        </div>
      </div>

      {/* Business info — server-rendered, visible to crawlers and security filters */}
      <section className="w-full max-w-5xl border-t border-gray-100 pt-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-sm text-gray-500">
          <div>
            <p className="font-semibold text-gray-700 mb-1">GarasjeProffen AS</p>
            <p>Org.nr. 937 606 966</p>
            <p>Tjødnavegen 8b, 4342 Bryne</p>
            <p>Rogaland, Norge</p>
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Kontakt</p>
            <a href="tel:+4747617563" className="block hover:text-orange-500">+47 476 17 563 (Christian)</a>
            <a href="tel:+4791344486" className="block hover:text-orange-500">+47 913 44 486 (Ola)</a>
            <a href="mailto:post@garasjeproffen.no" className="block hover:text-orange-500">post@garasjeproffen.no</a>
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Tjenester</p>
            <Link href="/garasje" className="block hover:text-orange-500">Garasje</Link>
            <Link href="/carport" className="block hover:text-orange-500">Carport</Link>
            <Link href="/materialpakke-garasje" className="block hover:text-orange-500">Materialpakke</Link>
            <Link href="/prefabrikkert-garasje" className="block hover:text-orange-500">Prefabrikkert løsning</Link>
            <Link href="/soknadshjelp" className="block hover:text-orange-500">Søknadshjelp</Link>
          </div>
          <div>
            <p className="font-semibold text-gray-700 mb-1">Informasjon</p>
            <Link href="/om-oss" className="block hover:text-orange-500">Om GarasjeProffen</Link>
            <Link href="/kontakt" className="block hover:text-orange-500">Kontakt oss</Link>
            <Link href="/referanseprosjekter" className="block hover:text-orange-500">Referanseprosjekter</Link>
            <Link href="/vilkar" className="block hover:text-orange-500">Personvernerklæring og vilkår</Link>
          </div>
        </div>

        {/* Geographic coverage — SEO */}
        <p className="mt-6 text-xs text-gray-400 leading-relaxed">
          GarasjeProffen AS holder til på Bryne og leverer garasjer, carporter og uthus på{" "}
          <Link href="/garasje-jaeren" className="text-orange-500 hover:underline">Jæren</Link>
          {" "}og i{" "}
          <Link href="/garasje-rogaland" className="text-orange-500 hover:underline">Rogaland</Link>
          {" "}– Time, Klepp, Hå, Gjesdal,{" "}
          <Link href="/garasje-sandnes" className="text-orange-500 hover:underline">Sandnes</Link>,{" "}
          <Link href="/garasje-stavanger" className="text-orange-500 hover:underline">Stavanger</Link>,
          {" "}Sola og Randaberg. Vi tilbyr{" "}
          <Link href="/materialpakke-garasje" className="text-orange-500 hover:underline">materialpakker for selvbygging</Link>
          ,{" "}
          <Link href="/prefabrikkert-garasje" className="text-orange-500 hover:underline">prefabrikkerte garasjer</Link>
          {" "}og hjelp med{" "}
          <Link href="/byggesoknad-garasje" className="text-orange-500 hover:underline">byggesøknad og nabovarsel</Link>.
        </p>
      </section>
    </div>
  );
}
