export const metadata = {
  title: "Om oss – GarasjeProffen.no",
  description:
    "Les mer om GarasjeProffen.no – hvem vi er, hva vi gjør, og hvorfor vi brenner for gode garasjeløsninger.",
};

export default function OmOss() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 sm:py-20">
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

      {/* Team */}
      <section className="mb-14">
        <h2 className="text-xl font-semibold text-gray-900">Menneskene bak</h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          {/* Christian */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-base font-semibold text-gray-900">
              Christian Årsland
            </p>
            <p className="mt-0.5 text-sm text-orange-600">Medgründer</p>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Christian har lang erfaring fra byggebransjen og vet hva som skal
              til for å levere et solid bygg. Han er opptatt av at hvert prosjekt
              skal gjennomføres profesjonelt – fra første tegning til nøkkelen er
              i hånden på kunden. Med bakgrunn fra både produksjon og prosjektledelse
              sørger han for at ting faktisk skjer.
            </p>
          </div>

          {/* Ola */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-base font-semibold text-gray-900">
              Ola Undheim
            </p>
            <p className="mt-0.5 text-sm text-orange-600">Medgründer</p>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Ola har bakgrunn innen teknologi og produktutvikling. Han har bygget
              digitale løsninger for ulike bransjer og brenner for å gjøre det
              enkelt for kunden å ta gode beslutninger. Hos GarasjeProffen har han
              ansvaret for den digitale plattformen – inkludert 3D-konfiguratoren
              du nettopp har brukt.
            </p>
          </div>
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
