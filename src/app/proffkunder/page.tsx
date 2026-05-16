import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proffkunder – GarasjeProffen AS",
  robots: { index: false, follow: false },
};

export default async function ProffkunderPage() {
  const cookieStore = await cookies();
  const isAdmin = cookieStore.get("gp-admin")?.value === "1";
  if (!isAdmin) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">

        {/* Admin badge */}
        <div className="mb-8 flex justify-end">
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
            Kun synlig for admin
          </span>
        </div>

        {/* Hero */}
        <div className="mb-10 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 px-8 py-10 text-white shadow-lg">
          <p className="mb-2 text-sm font-medium uppercase tracking-wider text-orange-100">For proffkunder</p>
          <h1 className="mb-4 text-3xl font-bold sm:text-4xl">Samarbeid med GarasjeProffen</h1>
          <p className="max-w-xl text-base text-orange-50 leading-relaxed">
            Vi leverer garasjeprosjekter i alle størrelser – fra enkeltgarasjer til større rekkegarasjeanlegg for utbyggere og borettslag. Ta kontakt for å høre om mulighetene for samarbeid.
          </p>
        </div>

        {/* Hva vi tilbyr */}
        <section className="mb-10">
          <h2 className="mb-5 text-xl font-bold text-gray-900">Hva vi tilbyr proffkunder</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100">
                <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">Rekkegarasjer</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Levering og montering av rekkegarasjeanlegg for utbyggere, borettslag og sameier. Vi håndterer alt fra prosjektering til ferdig nøkkelferdig løsning.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">Utbyggersamarbeid</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Fast samarbeidsavtale for utbyggere som trenger pålitelig leverandør av garasjeløsninger på tvers av flere prosjekter. Konkurransedyktige betingelser ved volum.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">Materialpakker i volum</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Egne priser på materialpakker ved bestilling av flere garasjer. Pakken inkluderer all konstruksjon, kledning, tak og porter ferdig tilpasset.
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-purple-100">
                <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">Søknadsassistanse</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Vi bistår med byggesøknad og situasjonsplan for alle prosjekter. Erfaring med kommunal saksbehandling i hele Rogaland og omegn.
              </p>
            </div>

          </div>
        </section>

        {/* Hvorfor velge oss */}
        <section className="mb-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Hvorfor velge GarasjeProffen?</h2>
          <ul className="space-y-3">
            {[
              "Lokalkunnskap og erfaring fra hundrevis av prosjekter i Rogaland",
              "Eget lager og direkte innkjøp – kortere leveringstid og bedre priser",
              "Hömann garasjeporter med motor og montering inkludert som standard",
              "Dedikert kontaktperson for proffkunder gjennom hele prosjektet",
              "Fleksibel fakturering og betalingsavtaler for faste samarbeidspartnere",
            ].map((point, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-100">
                  <svg className="h-3 w-3 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
                <span className="text-sm text-gray-700">{point}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Ta kontakt */}
        <section className="rounded-xl border border-orange-200 bg-orange-50 p-6">
          <h2 className="mb-2 text-lg font-bold text-gray-900">Ta kontakt</h2>
          <p className="mb-4 text-sm text-gray-600">
            Er du utbygger, håndverker eller på annen måte interessert i et fast samarbeid? Vi setter gjerne opp et møte for å snakke om behov og betingelser.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:post@garasjeproffen.no"
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              post@garasjeproffen.no
            </a>
            <a
              href="tel:+4747617563"
              className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-white px-4 py-2.5 text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              +47 476 17 563
            </a>
          </div>
        </section>

      </div>
    </div>
  );
}
