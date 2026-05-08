import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Slett konto – GarasjeProffen",
  description: "Be om sletting av din konto og tilhørende data hos GarasjeProffen.",
  alternates: { canonical: "https://www.garasjeproffen.no/slett-konto" },
};

export default function SlettKontoPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Slett konto</h1>
      <p className="text-gray-600 mb-8">
        Du kan når som helst be om at kontoen din og tilhørende data slettes fra GarasjeProffen.
      </p>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Slik ber du om sletting</h2>
        <p className="text-gray-600 mb-3">
          Send en e-post til{" "}
          <a href="mailto:christian@garasjeproffen.no" className="text-orange-600 hover:underline font-medium">
            christian@garasjeproffen.no
          </a>{" "}
          med emnet <strong>«Slett konto»</strong> og oppgi e-postadressen du brukte ved registrering.
        </p>
        <p className="text-gray-600">
          Vi behandler forespørselen innen 7 virkedager og sender bekreftelse når kontoen er slettet.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Hva som slettes</h2>
        <ul className="list-disc list-inside text-gray-600 space-y-1">
          <li>Navn og e-postadresse</li>
          <li>Lagrede garasje- og carport-konfigurasjoner</li>
          <li>Tilbudshistorikk og korrespondanse via appen</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Hva som beholdes</h2>
        <p className="text-gray-600">
          Data vi er pålagt å oppbevare etter regnskaps- og bokføringsloven (f.eks. fakturaer og
          transaksjonshistorikk) beholdes i inntil 5 år etter gjeldende lovkrav.
        </p>
      </section>

      <p className="text-sm text-gray-400">
        Les også vår{" "}
        <Link href="/vilkar" className="text-orange-500 hover:underline">
          personvernerklæring
        </Link>
        .
      </p>
    </main>
  );
}
