import SoknadshjelWizard, { type GarageConfig } from "@/components/soknadshjelp/SoknadshjelWizard";

export const metadata = {
  title: "Søknadshjelp – GarasjeProffen.no",
  description: "Finn tomten din på kart, svar på noen spørsmål og få hjelp med byggesøknad.",
};

interface Props {
  searchParams: Promise<{ lengthMm?: string; widthMm?: string; doorWidthMm?: string; doorHeightMm?: string; buildingType?: string }>;
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
        }
      : undefined;

  return <SoknadshjelWizard garageConfig={garageConfig} initialBuildingType={params.buildingType === "garasje" ? "garasje" : undefined} />;
}
