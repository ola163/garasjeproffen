import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Col 1 – contact */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Kontakt</p>
            <div className="space-y-0.5 text-xs text-gray-400">
              <a href="mailto:christian@garasjeproffen.no" className="block hover:text-orange-500">
                Christian – christian@garasjeproffen.no
              </a>
              <a href="tel:+4747617563" className="block hover:text-orange-500">+47 476 17 563</a>
              <a href="mailto:ola@garasjeproffen.no" className="block mt-2 hover:text-orange-500">
                Ola – ola@garasjeproffen.no
              </a>
              <a href="tel:+4791344486" className="block hover:text-orange-500">+47 913 44 486</a>
            </div>
          </div>

          {/* Col 2 – tjenester */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tjenester</p>
            <ul className="space-y-1 text-xs text-gray-400">
              <li><Link href="/prefabrikkert-garasje" className="hover:text-orange-500">Prefabrikkert garasje</Link></li>
              <li><Link href="/materialpakke-garasje" className="hover:text-orange-500">Materialpakke garasje</Link></li>
              <li><Link href="/soknadshjelp" className="hover:text-orange-500">Søknadshjelp</Link></li>
              <li><Link href="/byggesoknad-garasje" className="hover:text-orange-500">Byggesøknad for garasje</Link></li>
              <li><Link href="/configurator" className="hover:text-orange-500">3D-konfigurator</Link></li>
            </ul>
          </div>

          {/* Col 3 – lokalt */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Områder</p>
            <ul className="space-y-1 text-xs text-gray-400">
              <li><Link href="/garasje-rogaland" className="hover:text-orange-500">Garasje i Rogaland</Link></li>
              <li><Link href="/garasje-jaeren" className="hover:text-orange-500">Garasje på Jæren</Link></li>
              <li><Link href="/referanseprosjekter" className="hover:text-orange-500">Referanseprosjekter</Link></li>
            </ul>
          </div>

          {/* Col 4 – om oss + facebook */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Om oss</p>
            <ul className="space-y-1 text-xs text-gray-400 mb-4">
              <li><Link href="/om-oss" className="hover:text-orange-500">Om GarasjeProffen</Link></li>
              <li><Link href="/kontakt" className="hover:text-orange-500">Kontakt oss</Link></li>
            </ul>
            <a
              href="https://www.facebook.com/garasjeproffen"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#1877F2] px-3 py-1.5 text-xs text-white hover:bg-[#1464d8] transition-colors"
            >
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
              Følg oss
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-1 border-t border-gray-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-400">Tjødnavegen 8b, 4342 Bryne</p>
          <div className="flex flex-col items-start gap-0.5 sm:items-end">
            <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} GarasjeProffen.no</p>
            <p className="text-xs text-gray-400">Org.nr. 937 606 966</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
