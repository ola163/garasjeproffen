"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { getFirebaseAuth } from "@/lib/firebase";

export default function Kontakt() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recaptchaRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedAt    = useRef(Date.now());

  const MIN_SUBMIT_MS = 3000;
  const GENERIC_ERROR = "Vi kunne ikke bekrefte innsendingen. Prøv igjen, eller kontakt oss direkte på post@garasjeproffen.no.";

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setIsLoggedIn(d.isLoggedIn)).catch(() => {});
  }, []);

  const isLocalhost = typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    // Minimum time check — catch very fast bot submissions
    if (Date.now() - mountedAt.current < MIN_SUBMIT_MS) {
      setResult({ success: false, error: GENERIC_ERROR });
      setSubmitting(false);
      return;
    }

    try {
      // reCAPTCHA-verifisering via Firebase — alltid aktiv
      const auth = await getFirebaseAuth();
      if (!auth) throw new Error("Firebase utilgjengelig");
      const { RecaptchaVerifier } = await import("firebase/auth");
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, containerRef.current!, { size: "normal" });
        recaptchaRef.current.render();
      }
      await recaptchaRef.current.verify();

      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("address", address);
      formData.append("message", message);
      // Honeypot — always empty for real users
      formData.append("website", "");
      files.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/kontakt", { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setName(""); setEmail(""); setPhone(""); setAddress(""); setMessage(""); setFiles([]);
        recaptchaRef.current?.clear();
        recaptchaRef.current = null;
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.includes("Firebase") || msg.includes("recaptcha") || msg.includes("reCAPTCHA")) {
        setResult({ success: false, error: GENERIC_ERROR });
      } else {
        setResult({ success: false, error: GENERIC_ERROR });
      }
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Kontakt oss
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        Ta gjerne kontakt direkte – vi svarer raskt og hjelper deg med å komme i gang.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr] lg:items-start">
        {/* Left: people + address */}
        <div>
          <div className="grid gap-6 sm:grid-cols-3">
            {/* Christian */}
            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm">
              <div className="relative h-48 w-full bg-transparent">
                <Image src="/Christian.png" alt="Christian S. Årsland" fill className="object-contain" />
              </div>
              <div className="p-6">
                <p className="font-semibold text-gray-900">Christian S. Årsland</p>
                <p className="mt-0.5 text-sm text-orange-600">Daglig leder</p>
                <div className="mt-4 space-y-3">
                  <a href="mailto:christian@garasjeproffen.no" className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50">
                    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                    <span className="break-all">christian@garasjeproffen.no</span>
                  </a>
                  <a href="tel:+4747617563" className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50">
                    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                    +47 476 17 563
                  </a>
                </div>
              </div>
            </div>

            {/* Ola */}
            <div className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm">
              <div className="relative h-48 w-full bg-transparent">
                <Image src="/Ola.png" alt="Ola K. Undheim" fill className="object-contain" />
              </div>
              <div className="p-6">
                <p className="font-semibold text-gray-900">Ola K. Undheim</p>
                <p className="mt-0.5 text-sm text-orange-600">Teknisk sjef</p>
                <div className="mt-4 space-y-3">
                  <a href="mailto:ola@garasjeproffen.no" className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50">
                    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>
                    ola@garasjeproffen.no
                  </a>
                  <a href="tel:+4791344486" className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50">
                    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"/></svg>
                    +47 913 44 486
                  </a>
                </div>
              </div>
            </div>

            {/* GarasjeDrøsaren */}
            <div className="rounded-xl overflow-hidden shadow-sm bg-orange-500">
              <div className="relative h-48 w-full bg-orange-400">
                <Image src="/GarajseDrøsaren.png" alt="GarasjeDrøsaren" fill className="object-contain" />
              </div>
              <div className="p-6">
                <p className="font-semibold text-white">GarasjeDrøsaren</p>
                <p className="mt-0.5 text-sm text-orange-100">AI-rådgivar – alltid tilgjengeleg</p>
                <div className="mt-4 space-y-3">
                  <button
                    onClick={() => {
                      localStorage.removeItem("gd-dismissed");
                      window.dispatchEvent(new Event("gd-visibility"));
                      window.dispatchEvent(new Event("gd-open"));
                    }}
                    className="flex w-full items-center gap-3 rounded-lg bg-white/20 hover:bg-white/30 px-4 py-3 text-sm text-white transition-colors"
                  >
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>
                    Start ein samtale
                  </button>
                  <div className="flex items-center gap-3 rounded-lg bg-white/10 px-4 py-3 text-sm text-orange-100">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Svarer på sekundet
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="mt-6 rounded-xl bg-gray-50 px-6 py-5">
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">Besøksadresse</span><br />
              Tjødnavegen 8b, 4342 Bryne
            </p>
          </div>
        </div>

        {/* Right: Contact form */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Send oss en melding</h2>
          <p className="mt-2 text-sm text-gray-500">
            Fyll ut skjemaet så tar vi kontakt med deg så snart som mulig.
          </p>

        {result?.success ? (
          <div className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-800">
            Takk for henvendelsen! Vi tar kontakt snart.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {/* Honeypot — hidden from real users, bots fill it */}
            <div aria-hidden="true" style={{ display: "none" }}>
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Navn *</label>
              <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ola Nordmann"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">E-post *</label>
              <input id="email" type={isLocalhost ? "text" : "email"} required={!isLocalhost} value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ola@eksempel.no"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Telefon</label>
              <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="000 00 000"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">Adresse *</label>
              <input id="address" type="text" required value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Gateveien 1, 4342 Bryne"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">Melding</label>
              <textarea id="message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="Beskriv hva du ønsker hjelp med, f.eks. type bygg, størrelse, og eventuelle spørsmål..."
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Vedlegg (valgfritt)</label>
              <p className="mt-0.5 text-xs text-gray-400">Tegninger, bilder, tomtekart o.l.</p>
              {!isLoggedIn ? (
                <a href="/min-side" className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Logg inn på Min side for å legge ved filer
                </a>
              ) : (
                <>
                  <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-3 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors">
                    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    {files.length === 0 ? "Velg filer…" : `${files.length} fil${files.length !== 1 ? "er" : ""} valgt`}
                    <input type="file" multiple accept="image/*,.pdf,.dwg,.dxf" className="sr-only"
                      onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
                  </label>
                  {files.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {files.map((f, i) => (
                        <li key={i} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-600">
                          <span className="truncate">{f.name}</span>
                          <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                            className="ml-2 shrink-0 text-gray-400 hover:text-red-500">✕</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
            {result?.error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{result.error}</div>
            )}
            <div ref={containerRef} className="flex justify-center" />
            <button type="submit" disabled={submitting}
              className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? (files.length > 0 ? "Laster opp vedlegg…" : "Sender...") : "Send melding"}
            </button>
            <p className="text-[11px] text-gray-400 text-center leading-snug">
              Dette skjemaet er beskyttet mot spam og misbruk.{" "}
              <a href="/vilkar#personvern" className="underline hover:text-gray-600">Personvernerklæring</a>.
            </p>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
