"use client";

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  decided: boolean;
  version: number;
  date: string;
};

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = "gp-cookie-consent";
const CONSENT_VERSION = 1;

function defaultConsent(): ConsentState {
  return {
    necessary: true,
    analytics: false,
    marketing: false,
    decided: false,
    version: CONSENT_VERSION,
    date: new Date().toISOString().slice(0, 10),
  };
}

function loadConsent(): ConsentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConsent();
    const parsed = JSON.parse(raw) as ConsentState;
    if (parsed.version !== CONSENT_VERSION) return defaultConsent();
    return parsed;
  } catch {
    return defaultConsent();
  }
}

function saveConsent(c: ConsentState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...c, date: new Date().toISOString().slice(0, 10) }),
    );
  } catch {}
}

// ─── Script loaders ───────────────────────────────────────────────────────────
// Uncomment and configure when the relevant tools are activated.

function loadAnalyticsScripts(): void {
  // ── Google Analytics (GA4) ──────────────────────────────────────────────
  // 1. Set NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX in .env.local / Vercel env
  // 2. Uncomment the block below:
  //
  // const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
  // if (!GA_ID || document.getElementById("ga-script")) return;
  // const s = document.createElement("script");
  // s.id = "ga-script";
  // s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  // s.async = true;
  // document.head.appendChild(s);
  // (window as unknown as Record<string, unknown>).dataLayer =
  //   (window as unknown as Record<string, unknown>).dataLayer || [];
  // function gtag(...args: unknown[]) {
  //   ((window as unknown as Record<string, unknown>).dataLayer as unknown[]).push(args);
  // }
  // gtag("js", new Date());
  // gtag("config", GA_ID, { anonymize_ip: true });
}

function loadMarketingScripts(): void {
  // ── Meta Pixel ──────────────────────────────────────────────────────────
  // 1. Set NEXT_PUBLIC_META_PIXEL_ID=XXXXXXXXXXXXXXX in .env.local / Vercel env
  // 2. Uncomment the block below:
  //
  // const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  // if (!PIXEL_ID || document.getElementById("meta-pixel")) return;
  // const s = document.createElement("script");
  // s.id = "meta-pixel";
  // s.innerHTML = `
  //   !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){...};
  //   ...fbq('init','${PIXEL_ID}');fbq('track','PageView');
  // `;
  // document.head.appendChild(s);
  //
  // ── Google Ads ──────────────────────────────────────────────────────────
  // Similar pattern — add AW-XXXXXXXXX tag after consent
}

function applyConsent(c: ConsentState): void {
  if (c.analytics) loadAnalyticsScripts();
  if (c.marketing) loadMarketingScripts();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CookieConsent() {
  const [consent,      setConsent]      = useState<ConsentState | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [draft,        setDraft]        = useState({ analytics: false, marketing: false });

  useEffect(() => {
    const c = loadConsent();
    setConsent(c);
    setDraft({ analytics: c.analytics, marketing: c.marketing });
    if (c.decided) applyConsent(c);

    // Footer link dispatches this event to open settings
    const openHandler = () => {
      const current = loadConsent();
      setDraft({ analytics: current.analytics, marketing: current.marketing });
      setShowSettings(true);
    };
    window.addEventListener("open-cookie-settings", openHandler);
    return () => window.removeEventListener("open-cookie-settings", openHandler);
  }, []);

  if (!consent) return null;

  function save(analytics: boolean, marketing: boolean) {
    const c: ConsentState = {
      necessary: true,
      analytics,
      marketing,
      decided: true,
      version: CONSENT_VERSION,
      date: new Date().toISOString().slice(0, 10),
    };
    saveConsent(c);
    setConsent(c);
    applyConsent(c);
  }

  const showBanner = !consent.decided && !showSettings;
  if (!showBanner && !showSettings) return null;

  return (
    <>
      {/* ── Settings modal ─────────────────────────────────────────────────── */}
      {showSettings && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Informasjonskapsler</h2>
              <button
                onClick={() => setShowSettings(false)}
                aria-label="Lukk"
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Necessary */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">Nødvendige</p>
                  <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                    Brukersesjoner, kartplassering og skjemadata. Kreves for at nettsiden skal fungere.
                  </p>
                </div>
                <span className="shrink-0 mt-0.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
                  Alltid på
                </span>
              </div>

              <div className="border-t border-gray-100" />

              {/* Analytics */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">Analyse</p>
                  <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                    Google Analytics og lignende. Hjelper oss å forstå hvordan nettsiden brukes, slik at vi kan forbedre den.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={draft.analytics}
                  onClick={() => setDraft((d) => ({ ...d, analytics: !d.analytics }))}
                  className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${
                    draft.analytics ? "bg-orange-500" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      draft.analytics ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="border-t border-gray-100" />

              {/* Marketing */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">Markedsføring</p>
                  <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                    Meta Pixel og Google Ads. Brukes til å vise relevante annonser og måle effekten av annonsering.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={draft.marketing}
                  onClick={() => setDraft((d) => ({ ...d, marketing: !d.marketing }))}
                  className={`shrink-0 mt-0.5 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${
                    draft.marketing ? "bg-orange-500" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      draft.marketing ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="px-6 pb-6 pt-2 flex flex-col gap-2">
              <button
                onClick={() => { save(draft.analytics, draft.marketing); setShowSettings(false); }}
                className="w-full py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-colors"
              >
                Lagre valg
              </button>
              <button
                onClick={() => { save(true, true); setShowSettings(false); }}
                className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Godta alle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[100] p-3 sm:p-4 pointer-events-none">
          <div className="pointer-events-auto mx-auto max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 px-4 py-4 sm:px-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Vi bruker informasjonskapsler</p>
                <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
                  Nødvendige cookies er alltid aktive. Med ditt samtykke bruker vi også analyse og
                  markedsføring for å gi deg en bedre opplevelse.{" "}
                  <a href="/vilkar" className="underline hover:text-orange-500 transition-colors">
                    Les mer
                  </a>
                  .
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { setDraft({ analytics: false, marketing: false }); setShowSettings(true); }}
                  className="py-2 px-3 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap"
                >
                  Tilpass
                </button>
                <button
                  onClick={() => save(false, false)}
                  className="py-2 px-3 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  Kun nødvendige
                </button>
                <button
                  onClick={() => save(true, true)}
                  className="py-2 px-4 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition-colors whitespace-nowrap"
                >
                  Godta alle
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
