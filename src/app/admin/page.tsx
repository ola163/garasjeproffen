"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import Image from "next/image";

const ALLOWED_ADMINS = ["ola@garasjeproffen.no", "christian@garasjeproffen.no"];

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [cookieAdmin, setCookieAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [forgotView, setForgotView] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResult, setForgotResult] = useState<{ success: boolean; message: string } | null>(null);
  const [newQuoteCount, setNewQuoteCount] = useState<number | null>(null);
  const [projectCount, setProjectCount] = useState<number | null>(null);

  useEffect(() => {
    // Check cookie-based admin session (from min-side login)
    fetch("/api/auth/me").then(r => r.json()).then(({ isAdmin }) => {
      if (isAdmin) { setCookieAdmin(true); setAuthLoading(false); loadCounts(); }
    }).catch(() => {});

    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
      if (data.user) loadCounts();
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadCounts();
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCounts() {
    if (!supabase) return;
    const [quotesRes, projectsRes] = await Promise.all([
      supabase.from("quotes").select("id", { count: "exact" }).eq("status", "new"),
      supabase.from("reference_projects").select("id", { count: "exact" }),
    ]);
    setNewQuoteCount(quotesRes.count ?? 0);
    setProjectCount(projectsRes.count ?? 0);
  }

  async function handleLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoginLoading(true); setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoginLoading(false);
    if (error) setLoginError("Feil e-post eller passord.");
  }

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50"><div className="text-gray-400">Laster...</div></div>;
  }

  if (!supabase) {
    return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Supabase ikke konfigurert.</p></div>;
  }

  // ── Login ──
  if (!cookieAdmin && (!user || !ALLOWED_ADMINS.includes(user.email?.toLowerCase() ?? ""))) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
        <div className="mb-8">
          <Image src="/logo-header.jpg" alt="GarasjeProffen" width={400} height={100} className="h-16 w-auto" />
        </div>
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-bold text-gray-900">Admin</h1>
          <p className="mb-6 text-sm text-gray-500">Logg inn for å administrere GarasjeProffen.</p>

          {user && !ALLOWED_ADMINS.includes(user.email?.toLowerCase() ?? "") ? (
            <div className="text-center">
              <p className="text-sm text-gray-600">Denne kontoen har ikke admin-tilgang.</p>
              <p className="mt-1 text-xs text-gray-400">{user.email}</p>
              <button onClick={() => supabase?.auth.signOut()} className="mt-4 text-sm text-orange-500 hover:underline">
                Logg ut og prøv igjen
              </button>
            </div>
          ) : forgotView ? (
            /* ── Forgot password ── */
            forgotResult?.success ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">Sjekk e-posten din</p>
                <p className="mt-1 text-xs text-gray-500">Vi har sendt en tilbakestillingslenke til <strong>{forgotEmail}</strong>.</p>
                <button onClick={() => { setForgotView(false); setForgotResult(null); setForgotEmail(""); }} className="mt-4 text-sm text-orange-500 hover:underline">
                  Tilbake til innlogging
                </button>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!supabase) return;
                setForgotLoading(true); setForgotResult(null);
                const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                  redirectTo: `${window.location.origin}/admin/reset-passord`,
                });
                setForgotLoading(false);
                setForgotResult(error
                  ? { success: false, message: "Kunne ikke sende e-post. Prøv igjen." }
                  : { success: true, message: "Sendt!" }
                );
              }} className="space-y-3">
                <p className="text-sm text-gray-500 mb-4">Skriv inn e-postadressen din så sender vi en lenke for å tilbakestille passordet.</p>
                <input
                  type="email"
                  required
                  placeholder="E-post"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                {forgotResult?.success === false && <p className="text-xs text-red-500">{forgotResult.message}</p>}
                <button type="submit" disabled={forgotLoading}
                  className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
                  {forgotLoading ? "Sender…" : "Send tilbakestillingslenke"}
                </button>
                <button type="button" onClick={() => { setForgotView(false); setForgotResult(null); }} className="w-full text-center text-sm text-gray-400 hover:text-gray-600">
                  Avbryt
                </button>
              </form>
            )
          ) : (
            /* ── Login ── */
            <form onSubmit={handleLogin} className="space-y-3">
              <input
                type="email"
                required
                placeholder="E-post"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <input
                type="password"
                required
                placeholder="Passord"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              {loginError && <p className="text-xs text-red-500">{loginError}</p>}
              <button type="submit" disabled={loginLoading}
                className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
                {loginLoading ? "Logger inn…" : "Logg inn"}
              </button>
              <button type="button" onClick={() => { setForgotView(true); setForgotEmail(loginEmail); }}
                className="w-full text-center text-sm text-gray-400 hover:text-orange-500">
                Glemt passord?
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── Dashboard ──
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-12 sm:px-6">

        {/* Header */}
        <div className="mb-6 sm:mb-10 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo-header.jpg" alt="GarasjeProffen" width={400} height={100} className="h-8 sm:h-10 w-auto" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Admin</h1>
              <p className="text-xs text-gray-400 truncate max-w-[180px] sm:max-w-none">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← Til siden</Link>
            <button
              onClick={() => supabase?.auth.signOut()}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100"
            >
              Logg ut
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Quotes */}
          <Link
            href="/admin/quotes"
            className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
              <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-orange-600">Tilbudsforespørsler</h2>
            <p className="mt-1 text-sm text-gray-500">Se og behandle forespørsler, bygg tilbud og send til kunde.</p>
            {newQuoteCount !== null && newQuoteCount > 0 && (
              <span className="absolute right-4 top-4 flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-500 px-1.5 text-xs font-bold text-white">
                {newQuoteCount} ny{newQuoteCount !== 1 ? "e" : ""}
              </span>
            )}
            <p className="mt-4 text-xs font-medium text-orange-500 group-hover:underline">Åpne →</p>
          </Link>

          {/* Kontakthenvendelser */}
          <Link
            href="/admin/kontakt"
            className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-purple-600">Kontakthenvendelser</h2>
            <p className="mt-1 text-sm text-gray-500">Arkiv over kontaktskjema-innmeldinger med status.</p>
            <p className="mt-4 text-xs font-medium text-purple-500 group-hover:underline">Åpne →</p>
          </Link>

          {/* Kunderegister */}
          <Link
            href="/admin/kunder"
            className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-green-600">Kunderegister</h2>
            <p className="mt-1 text-sm text-gray-500">Oversikt over alle kunder som har sendt forespørsler.</p>
            <p className="mt-4 text-xs font-medium text-green-500 group-hover:underline">Åpne →</p>
          </Link>

          {/* Chat-logg */}
          <Link
            href="/admin/chat-logg"
            className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
              <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-orange-600">Chat-logg</h2>
            <p className="mt-1 text-sm text-gray-500">Samtaler med GarasjeDrøsaren – innloggede og anonyme, topp-spørsmål.</p>
            <p className="mt-4 text-xs font-medium text-orange-500 group-hover:underline">Åpne →</p>
          </Link>

          {/* Referanseprosjekter */}
          <Link
            href="/referanseprosjekter/admin"
            className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-gray-900 group-hover:text-blue-600">Referanseprosjekter</h2>
            <p className="mt-1 text-sm text-gray-500">Publiser og rediger bilder og beskrivelser av utførte prosjekter.</p>
            {projectCount !== null && (
              <p className="mt-1 text-xs text-gray-400">{projectCount} publiserte prosjekter</p>
            )}
            <p className="mt-4 text-xs font-medium text-blue-500 group-hover:underline">Åpne →</p>
          </Link>

        </div>
      </div>
    </div>
  );
}
