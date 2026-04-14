"use client";

import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-44 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="GarasjeProffen.no"
            width={600}
            height={600}
            className="h-12 w-auto sm:h-40"
            priority
          />
        </Link>
        <nav className="flex items-center gap-3 sm:gap-6">
          <Link
            href="/om-oss"
            className="hidden text-sm font-medium text-gray-600 hover:text-gray-900 sm:block"
          >
            Om oss
          </Link>
          <Link
            href="/configurator"
            className="hidden text-sm font-medium text-gray-600 hover:text-gray-900 sm:block"
          >
            Design din garasje
          </Link>
          <Link
            href="/configurator"
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 sm:px-4 sm:py-2 sm:text-sm"
          >
            Kom i gang
          </Link>
        </nav>
      </div>
    </header>
  );
}
