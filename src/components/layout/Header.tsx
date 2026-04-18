"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const soknadshjelLink =
    pathname === "/garasje" || pathname === "/carport"
      ? "/soknadshjelp?buildingType=garasje"
      : "/soknadshjelp";

  const navLinks = [
    { href: "/om-oss", label: "Om oss" },
    { href: "/kontakt", label: "Kontakt" },
    { href: "/referanseprosjekter", label: "Referanseprosjekter" },
    { href: soknadshjelLink, label: "Søknadshjelp" },
    { href: "/configurator", label: "Design din garasje" },
  ];

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 sm:h-44 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo-header.jpg"
            alt="GarasjeProffen.no"
            width={800}
            height={200}
            className="h-7 w-auto sm:h-24"
            priority
          />
        </Link>

        <nav className="flex items-center gap-3 sm:gap-6">
          {/* Desktop links */}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden text-sm font-medium text-gray-600 hover:text-gray-900 sm:block"
            >
              {link.label}
            </Link>
          ))}

          <Link
            href="/configurator"
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 sm:px-4 sm:py-2 sm:text-sm"
          >
            Kom i gang
          </Link>

          {/* Hamburger button – mobile only */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 sm:hidden"
            aria-label="Meny"
          >
            {mobileOpen ? (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </nav>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 sm:hidden">
          <ul className="space-y-1 pt-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
