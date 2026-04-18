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

          {/* Right – nav + facebook + copyright */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <a
              href="https://www.facebook.com/garasjeproffen"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-[#1877F2] px-3 py-1.5 text-white hover:bg-[#1464d8] transition-colors"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
              Følg oss på Facebook
            </a>
            <Link href="/kontakt" className="hover:text-orange-500">Kontakt oss</Link>
            <Link href="/om-oss" className="hover:text-orange-500">Om oss</Link>
            <span>&copy; {new Date().getFullYear()} GarasjeProffen.no</span>
          </div>
        </div>

        {/* Bottom – address */}
        <p className="mt-4 text-xs text-gray-400">Tjødnavegen 8b, 4342 Bryne</p>
      </div>
    </footer>
  );
}
