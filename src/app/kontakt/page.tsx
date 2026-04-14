export const metadata = {
  title: "Kontakt oss – GarasjeProffen.no",
  description: "Ta kontakt med GarasjeProffen.no – vi hjelper deg med garasjeprosjektet ditt.",
};

export default function Kontakt() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Kontakt oss
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        Ta gjerne kontakt direkte – vi svarer raskt og hjelper deg med å komme i gang.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {/* Christian */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="font-semibold text-gray-900">Christian Salte Årsland</p>
          <p className="mt-0.5 text-sm text-orange-600">Daglig leder</p>
          <div className="mt-4 space-y-3">
            <a
              href="mailto:christian@garasjeproffen.no"
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50"
            >
              <span className="text-base">✉</span>
              christian@garasjeproffen.no
            </a>
            <a
              href="tel:+4747617563"
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50"
            >
              <span className="text-base">📱</span>
              +47 476 17 563
            </a>
          </div>
        </div>

        {/* Ola */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="font-semibold text-gray-900">Ola K. Undheim</p>
          <p className="mt-0.5 text-sm text-orange-600">Teknisk sjef</p>
          <div className="mt-4 space-y-3">
            <a
              href="mailto:ola@garasjeproffen.no"
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50"
            >
              <span className="text-base">✉</span>
              ola@garasjeproffen.no
            </a>
            <a
              href="tel:+4791344486"
              className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50"
            >
              <span className="text-base">📱</span>
              +47 913 44 486
            </a>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="mt-8 rounded-xl bg-gray-50 px-6 py-5">
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-700">Besøksadresse</span><br />
          Tjødnavegen 8b, 4342 Bryne
        </p>
      </div>

      {/* CTA */}
      <div className="mt-10 border-t border-gray-100 pt-8 text-center">
        <p className="text-sm text-gray-500">
          Vil du heller konfigurere garasjen din selv først?
        </p>
        <a
          href="/configurator"
          className="mt-3 inline-block rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
        >
          Gå til 3D-konfiguratoren
        </a>
      </div>
    </div>
  );
}
