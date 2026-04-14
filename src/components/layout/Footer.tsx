import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Contact row */}
        <div className="flex flex-col items-center gap-1 text-xs text-gray-400 sm:flex-row sm:justify-center sm:gap-6">
          <span className="font-medium text-gray-500">Kontakt:</span>
          <a href="mailto:christian@garasjeproffen.no" className="hover:text-orange-500">
            Christian – christian@garasjeproffen.no · +47 476 17 563
          </a>
          <span className="hidden sm:inline">|</span>
          <a href="mailto:ola@garasjeproffen.no" className="hover:text-orange-500">
            Ola – ola@garasjeproffen.no · +47 913 44 486
          </a>
        </div>

        {/* Bottom row */}
        <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          <p className="text-xs text-gray-400">
            📍 Tjødnavegen 8b, 4342 Bryne
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/kontakt" className="hover:text-orange-500">Kontakt oss</Link>
            <Link href="/om-oss" className="hover:text-orange-500">Om oss</Link>
            <span>&copy; {new Date().getFullYear()} GarasjeProffen.no</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
