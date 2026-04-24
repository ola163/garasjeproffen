import Link from "next/link";
import SoknadshjelWizard, { type GarageConfig } from "@/components/soknadshjelp/SoknadshjelWizard";

export const metadata = {
  title: "Søknadshjelp garasje – hjelp med byggesøknad",
  description: "Trenger du hjelp med byggesøknad for garasje eller carport? GarasjeProffen AS hjelper med situasjonsplan, tegninger og innsending i Rogaland og på Jæren.",
  alternates: { canonical: "https://www.garasjeproffen.no/soknadshjelp" },
};

const FAQ_ITEMS = [
  {
    q: "Trenger jeg alltid byggesøknad for garasje?",
    a: "Ikke nødvendigvis. Garasjer under 50 m² kan i mange tilfeller bygges uten søknad, men dette avhenger av kommunens reguleringsplan, avstand til nabogrense og tomtens plassering. Vi hjelper deg å avklare hva som gjelder for din tomt.",
  },
  {
    q: "Hva inkluderer søknadshjelpen fra GarasjeProffen?",
    a: "Vi hjelper deg med å vurdere om du trenger søknad, utarbeider situasjonsplan og tegninger, og kan sende inn søknaden til kommunen på dine vegne. Vi bistår også med nabovarsel der det er påkrevd.",
  },
  {
    q: "Kan dere sende byggesøknaden på mine vegne?",
    a: "Ja, vi kan stå som ansvarlig søker og håndtere all kommunikasjon med kommunen. Da slipper du å følge opp papirarbeidet selv og vi holder deg oppdatert om fremdriften.",
  },
  {
    q: "Hvor lang tid tar kommunen å behandle en byggesøknad?",
    a: "Kommunen har 12 ukers behandlingsfrist etter plan- og bygningsloven. Mange kommuner behandler enklere garasjesøknader raskere. Saker som krever dispensasjon kan ta lengre tid.",
  },
  {
    q: "Hva skjer hvis søknaden trenger dispensasjon?",
    a: "Noen ganger kan kommunens reguleringsplan kreve dispensasjon for å bygge slik du ønsker. I slike tilfeller hjelper vi deg med å vurdere om dispensasjon er aktuelt og bistår med søknaden om det er ønskelig.",
  },
];

interface Props {
  searchParams: Promise<{ lengthMm?: string; widthMm?: string; doorWidthMm?: string; doorHeightMm?: string; buildingType?: string; roofType?: string }>;
}

export default async function Soknadshjelp({ searchParams }: Props) {
  const params = await searchParams;

  const garageConfig: GarageConfig | undefined =
    params.lengthMm && params.widthMm && params.doorWidthMm && params.doorHeightMm
      ? {
          lengthMm:    Number(params.lengthMm),
          widthMm:     Number(params.widthMm),
          doorWidthMm: Number(params.doorWidthMm),
          doorHeightMm: Number(params.doorHeightMm),
          roofType:    params.roofType === "flattak" ? "flattak" : "saltak",
        }
      : undefined;

  return (
    <>
      <SoknadshjelWizard garageConfig={garageConfig} initialBuildingType={params.buildingType === "garasje" ? "garasje" : undefined} />
      <div className="mx-auto max-w-4xl px-6 py-16 border-t border-gray-100">
        <h2 className="text-xl font-semibold text-gray-900">Vanlige spørsmål om byggesøknad</h2>
        <div className="mt-4 divide-y divide-gray-100">
          {FAQ_ITEMS.map((item) => (
            <div key={item.q} className="py-4">
              <h3 className="font-semibold text-gray-900">{item.q}</h3>
              <p className="mt-1 text-sm text-gray-600">{item.a}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/byggesoknad-garasje" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Les mer om byggesøknad
          </Link>
          <Link href="/kontakt" className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Ta kontakt
          </Link>
        </div>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQ_ITEMS.map((item) => ({
              "@type": "Question",
              name: item.q,
              acceptedAnswer: { "@type": "Answer", text: item.a },
            })),
          }),
        }}
      />
    </>
  );
}
