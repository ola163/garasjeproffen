import SoknadshjelWizard from "@/components/soknadshjelp/SoknadshjelWizard";

export const metadata = {
  title: "Søknadshjelp – GarasjeProffen.no",
  description: "Finn tomten din på kart, svar på noen spørsmål og få et prisestimat på garasjen din.",
};

export default function Soknadshjelp() {
  return <SoknadshjelWizard />;
}
