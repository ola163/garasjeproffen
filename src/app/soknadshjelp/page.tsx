import SoknadshjelWizard, { type GarageConfig } from "@/components/soknadshjelp/SoknadshjelWizard";

export const metadata = {
  title: "Søknadshjelp for garasje og carport | Byggesøknad",
  description: "Trenger du hjelp med byggesøknad for garasje eller carport? GarasjeProffen AS guider deg gjennom prosessen – finn tomten din og få en skreddersydd søknad.",
  alternates: { canonical: "https://www.garasjeproffen.no/soknadshjelp" },
};

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

  return <SoknadshjelWizard garageConfig={garageConfig} initialBuildingType={params.buildingType === "garasje" ? "garasje" : undefined} />;
}
