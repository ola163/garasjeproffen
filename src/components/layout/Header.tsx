"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#111111] border-b border-white/8">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="GarasjeProffen.no"
            width={480}
            height={120}
            className="h-9 w-auto"
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden sm:flex items-center gap-8">
          <Link
            href="/configurator"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            Konfigurator
          </Link>
          <Link
            href="/interesse"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            Kontakt oss
          </Link>
          <Link
            href="/configurator"
            className="rounded-md bg-[#e2520a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c94609] transition-colors"
          >
            Design din garasje
          </Link>
        </nav>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Meny"
        >
          <span className={`block h-0.5 w-6 bg-white transition-all ${menuOpen ? "rotate-45 translate-y-2" : ""}`} />
          <span className={`block h-0.5 w-6 bg-white transition-all ${menuOpen ? "opacity-0" : ""}`} />
          <span className={`block h-0.5 w-6 bg-white transition-all ${menuOpen ? "-rotate-45 -translate-y-2" : ""}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden bg-[#1a1a1a] border-t border-white/8 px-5 py-4 flex flex-col gap-4">
          <Link href="/configurator" className="text-sm text-white/70 hover:text-white" onClick={() => setMenuOpen(false)}>Konfigurator</Link>
          <Link href="/interesse"   className="text-sm text-white/70 hover:text-white" onClick={() => setMenuOpen(false)}>Kontakt oss</Link>
          <Link href="/configurator" className="rounded-md bg-[#e2520a] px-4 py-2 text-sm font-semibold text-white text-center" onClick={() => setMenuOpen(false)}>
            Design din garasje
          </Link>
        </div>
      )}
    </header>
  );
}
