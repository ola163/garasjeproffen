import Image from "next/image";
import ContactForm from "@/components/om-oss/ContactForm";

export const metadata = {
  title: "Om oss – GarasjeProffen AS på Bryne",
  description: "Les mer om GarasjeProffen AS – hvem vi er, hva vi gjør, og hvorfor vi brenner for gode garasjeløsninger på Jæren og i Rogaland.",
  alternates: { canonical: "https://www.garasjeproffen.no/om-oss" },
};

export default function OmOss() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
      {/* Intro */}
      <section className="mb-14">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          Om oss
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-gray-600">
          GarasjeProffen.no er en norsk leverandør av garasjebygg som kombinerer
          solid håndverkskompetanse med moderne digitale verktøy. Vi hjelper
          privatpersoner og næringsdrivende med å prosjektere, produsere og sette
          opp garasjer tilpasset deres behov – raskt, ryddig og til riktig pris.
        </p>
      </section>

      {/* Services */}
      <section className="mb-14">
        <h2 className="text-xl font-semibold text-gray-900">Hva vi tilbyr</h2>
        <ul className="mt-4 space-y-2 text-gray-600">
          {[
            "Skreddersydde garasjebygg i tre",
            "Prefabrikkerte løsninger for rask montering",
            "3D-konfigurator for enkel tilpasning",
            "Prisestimat direkte i nettleseren",
            "Prosjektering og tegningsunderlag",
            "Levering og montering i Rogaland og omegn",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Prefab focus */}
      <section className="mb-14 rounded-xl border border-orange-100 bg-orange-50 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900">
          Prefabrikkerte løsninger – vår spesialitet
        </h2>
        <p className="mt-3 leading-relaxed text-gray-600">
          Vi har bygget opp et system der garasjeelementer produseres ferdig på
          verkstedet og monteres på tomten på rekordtid. Det betyr færre
          forsinkelser, forutsigbar pris og høy kvalitet – uansett vær.
          Kunden slipper å koordinere mange ulike håndverkere; vi leverer et
          komplett bygg fra grunnmur til møne.
        </p>
      </section>

      {/* Team + Contact */}
      <section className="mb-14">
        <h2 className="text-xl font-semibold text-gray-900">Menneskene bak</h2>
        <div className="mt-6 flex flex-col gap-8 lg:flex-row">
          {/* People cards */}
          <div className="grid gap-8 sm:grid-cols-2 lg:flex-1">
            {/* Christian */}
            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm">
              <div className="relative h-56 w-full bg-transparent">
                <Image src="/Christian.png" alt="Christian S. Årsland" fill className="object-contain" />
              </div>
              <div className="p-6">
                <p className="text-base font-semibold text-gray-900">Christian S. Årsland</p>
                <p className="mt-0.5 text-sm text-orange-600">Daglig leder</p>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  Christian har bakgrunn som prosjektingeniør og jobber med tekniske
                  løsninger og 3D-modellering. Han har erfaring fra både design,
                  produksjon og prosjektarbeid, og er opptatt av løsninger som er
                  praktiske og enkle å gjennomføre. Hos GarasjeProffen jobber han med
                  tegninger, tekniske vurderinger og sørger for at prosjektene lar seg
                  bygge i praksis.
                </p>
                <div className="mt-4 space-y-1 text-sm">
                  <a href="mailto:christian@garasjeproffen.no" className="flex items-center gap-2 text-gray-500 hover:text-orange-600">
                    <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                    christian@garasjeproffen.no
                  </a>
                  <a href="tel:+4747617563" className="flex items-center gap-2 text-gray-500 hover:text-orange-600">
                    <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                    +47 476 17 563
                  </a>
                </div>
              </div>
            </div>

            {/* Ola */}
            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm">
              <div className="relative h-56 w-full bg-transparent">
                <Image src="/Ola.png" alt="Ola K. Undheim" fill className="object-contain" />
              </div>
              <div className="p-6">
                <p className="text-base font-semibold text-gray-900">Ola K. Undheim</p>
                <p className="mt-0.5 text-sm text-orange-600">Teknisk sjef</p>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  Ola er byggingeniør med mastergrad og har god kompetanse innen
                  konstruksjon og byggeteknikk. Han har også erfaring med utvikling av
                  digitale løsninger. Hos GarasjeProffen jobber han både med
                  prosjektering og utvikling av den digitale plattformen, med fokus på
                  å gjøre det enkelt for kunden å planlegge sitt prosjekt.
                </p>
                <div className="mt-4 space-y-1 text-sm">
                  <a href="mailto:ola@garasjeproffen.no" className="flex items-center gap-2 text-gray-500 hover:text-orange-600">
                    <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                    ola@garasjeproffen.no
                  </a>
                  <a href="tel:+4791344486" className="flex items-center gap-2 text-gray-500 hover:text-orange-600">
                    <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                    +47 913 44 486
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Contact form */}
          <ContactForm />
        </div>
      </section>

      {/* Collaboration */}
      <section className="mb-14">
        <h2 className="text-xl font-semibold text-gray-900">
          Slik samarbeider vi
        </h2>
        <p className="mt-3 leading-relaxed text-gray-600">
          Vi tror på åpenhet og tett dialog gjennom hele prosessen. Kunden får
          alltid vite hva ting koster, hvorfor vi anbefaler en løsning, og hva
          neste steg er. Ingen skjulte kostnader, ingen overraskelser. Når du
          sender en forespørsel gjennom konfiguratoren, tar vi kontakt raskt –
          vanligvis innen én arbeidsdag.
        </p>
      </section>

      {/* Vision */}
      <section className="mb-14">
        <h2 className="text-xl font-semibold text-gray-900">Vår visjon</h2>
        <p className="mt-3 leading-relaxed text-gray-600">
          Vi ønsker å være det naturlige førstevalget for alle som skal bygge
          garasje på Sør-Vestlandet. På sikt vil vi utvide sortimentet med
          carporter, uthus og næringsbygg – alltid med samme filosofi: god
          kvalitet, ærlig pris og smidig prosess.
        </p>
      </section>

      {/* Location */}
      <section className="rounded-xl bg-gray-50 p-6 sm:p-8">
        <h2 className="text-xl font-semibold text-gray-900">
          Lokalt forankret i Rogaland
        </h2>
        <p className="mt-3 leading-relaxed text-gray-600">
          Vi holder til på Bryne og betjener primært kunder i Rogaland og
          nærliggende fylker. Som lokalt selskap kjenner vi terrenget, de lokale
          reglene og forholdene – og vi kan stille opp i person når det trengs.
        </p>
        <p className="mt-3 flex items-center gap-2 text-sm text-gray-500">
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>
          Tjødnavegen 8b, 4342 Bryne
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Spørsmål?{" "}
          <a
            href="mailto:post@garasjeproffen.no"
            className="font-medium text-orange-600 hover:text-orange-700"
          >
            post@garasjeproffen.no
          </a>
        </p>
      </section>
    </div>
  );
}
