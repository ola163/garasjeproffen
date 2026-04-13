import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-[#111111] border-t border-white/8">
      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          {/* Brand */}
          <div>
            <Image
              src="/logo.png"
              alt="GarasjeProffen.no"
              width={480}
              height={120}
              className="h-8 w-auto mb-3"
            />
            <p className="text-sm text-white/40 max-w-xs">
              Profesjonelle garasjer skreddersydd til dine behov.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 text-sm">
            <div className="flex flex-col gap-2">
              <span className="text-white/25 text-xs font-semibold uppercase tracking-wider mb-1">Produkt</span>
              <Link href="/configurator" className="text-white/55 hover:text-white transition-colors">Konfigurator</Link>
              <Link href="/#slik-fungerer" className="text-white/55 hover:text-white transition-colors">Slik fungerer det</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-white/25 text-xs font-semibold uppercase tracking-wider mb-1">Kontakt</span>
              <Link href="/interesse" className="text-white/55 hover:text-white transition-colors">Send forespørsel</Link>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/8 text-center text-xs text-white/25">
          © {new Date().getFullYear()} GarasjeProffen.no — Alle rettigheter forbeholdt
        </div>
      </div>
    </footer>
  );
}
