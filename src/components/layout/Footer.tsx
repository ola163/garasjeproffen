import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          {/* Left – contact */}
          <div className="space-y-0.5 text-xs text-gray-400">
            <a href="mailto:christian@garasjeproffen.no" className="block hover:text-orange-500">
              Christian – christian@garasjeproffen.no · +47 476 17 563
            </a>
            <a href="mailto:ola@garasjeproffen.no" className="block hover:text-orange-500">
              Ola – ola@garasjeproffen.no · +47 913 44 486
            </a>
          </div>

          {/* Right – nav + copyright */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/kontakt" className="hover:text-orange-500">Kontakt oss</Link>
            <Link href="/om-oss" className="hover:text-orange-500">Om oss</Link>
            <span>&copy; {new Date().getFullYear()} GarasjeProffen.no</span>
          </div>
        </div>

        {/* Bottom – address */}
        <p className="mt-4 text-xs text-gray-400">📍 Tjødnavegen 8b, 4342 Bryne</p>
      </div>
    </footer>
  );
}
