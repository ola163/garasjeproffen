"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";

const STORAGE_KEY = "gd-dismissed";

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [gdDismissed, setGdDismissed] = useState(false);
  const [ctaOpen, setCtaOpen] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGdDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    function onVisibility() { setGdDismissed(localStorage.getItem(STORAGE_KEY) === "1"); }
    window.addEventListener("gd-visibility", onVisibility);
    return () => window.removeEventListener("gd-visibility", onVisibility);
  }, []);

  useEffect(() => {
    if (!ctaOpen) return;
    function close(e: MouseEvent) {
      if (ctaRef.current && !ctaRef.current.contains(e.target as Node)) setCtaOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctaOpen]);

  function enableGd() {
    localStorage.removeItem(STORAGE_KEY);
    setGdDismissed(false);
    window.dispatchEvent(new Event("gd-visibility"));
  }

  const soknadshjelLink =
    pathname === "/garasje" || pathname === "/carport"
      ? "/soknadshjelp?buildingType=garasje"
      : "/soknadshjelp";

  const navLinks = [
    { href: "/referanseprosjekter", label: "Referanseprosjekter" },
    { href: "/om-oss", label: "Om oss" },
  ];

  const ctaLinks = [
    { href: "/configurator", label: "Design din garasje" },
    { href: soknadshjelLink, label: "Søknadshjelp" },
  ];

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo-header.jpg"
            alt="GarasjeProffen.no"
            width={800}
            height={200}
            className="h-9 w-auto sm:h-11"
            priority
          />
        </Link>

        <nav className="flex items-center gap-3 sm:gap-6">
          {/* Desktop links */}
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`hidden text-sm font-medium transition-colors sm:block ${
                pathname === link.href || pathname.startsWith(link.href + "/")
                  ? "text-gray-900"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {link.label}
            </Link>
          ))}

          {/* Min side – desktop */}
          <Link
            href="/min-side"
            className={`hidden sm:flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname === "/min-side"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50"
            }`}
          >
            <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Min side
          </Link>

          {gdDismissed && (
            <button
              onClick={enableGd}
              title="Vis GarasjeDrøsaren igjen"
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 hover:bg-orange-200 transition-colors"
            >
              <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </button>
          )}

          {/* Kom i gang dropdown – desktop */}
          <div ref={ctaRef} className="relative hidden sm:block">
            <button
              onClick={() => setCtaOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
            >
              Kom i gang
              <svg
                className={`h-4 w-4 transition-transform ${ctaOpen ? "rotate-180" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {ctaOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                {ctaLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setCtaOpen(false)}
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Hamburger – mobile only */}
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
            {[...navLinks, { href: "/min-side", label: "Min side" }, ...ctaLinks].map((link) => (
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
