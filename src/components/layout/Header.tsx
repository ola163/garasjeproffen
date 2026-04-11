"use client";

import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-44 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="GarasjeProffen.no"
            width={600}
            height={600}
            className="h-40 w-auto"
            priority
          />
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/configurator"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Design din garasje
          </Link>
          <Link
            href="/configurator"
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            Kom i gang
          </Link>
        </nav>
      </div>
    </header>
  );
}
