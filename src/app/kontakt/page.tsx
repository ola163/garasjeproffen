"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { auth } from "@/lib/firebase";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";

export default function Kontakt() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => { recaptchaRef.current?.clear(); };
  }, []);

  async function sendOtp() {
    if (!phone) { setPhoneError("Skriv inn telefonnummer først."); return; }
    setPhoneError("");
    setSendingOtp(true);
    try {
      if (!auth) { setPhoneError("Firebase er ikke tilgjengelig. Prøv igjen."); return; }
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current!, { size: "invisible" });
      }
      const formatted = phone.startsWith("+") ? phone : `+47${phone.replace(/\s/g, "")}`;
      confirmationRef.current = await signInWithPhoneNumber(auth, formatted, recaptchaRef.current);
      setOtpSent(true);
    } catch (err) {
      setPhoneError("Kunne ikke sende SMS. Sjekk nummeret og prøv igjen.");
      console.error("OTP send error:", err);
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setSendingOtp(false);
    }
  }

  async function verifyOtp() {
    if (!otp || !confirmationRef.current) return;
    setPhoneError("");
    setVerifyingOtp(true);
    try {
      await confirmationRef.current.confirm(otp);
      setPhoneVerified(true);
      setOtpSent(false);
    } catch {
      setPhoneError("Feil kode. Prøv igjen.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("address", address);
      formData.append("message", message);
      files.forEach((f) => formData.append("files", f));
      const res = await fetch("/api/kontakt", { method: "POST", body: formData });
      const data = await res.json();
      setResult(data);
      if (data.success) {
        setName(""); setEmail(""); setPhone(""); setAddress(""); setMessage(""); setFiles([]);
      }
    } catch {
      setResult({ success: false, error: "Nettverksfeil. Vennligst prøv igjen." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 sm:py-20">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        Kontakt oss
      </h1>
      <p className="mt-4 text-lg text-gray-600">
        Ta gjerne kontakt direkte – vi svarer raskt og hjelper deg med å komme i gang.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {/* Christian */}
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm">
          <div className="relative h-48 w-full bg-transparent">
            <Image
              src="/Christian.png"
              alt="Christian S. Årsland"
              fill
              className="object-contain"
            />
          </div>
          <div className="p-6">
            <p className="font-semibold text-gray-900">Christian S. Årsland</p>
            <p className="mt-0.5 text-sm text-orange-600">Daglig leder</p>
            <div className="mt-4 space-y-3">
              <a
                href="mailto:christian@garasjeproffen.no"
                className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50"
              >
                <span className="text-base">✉</span>
                christian@garasjeproffen.no
              </a>
              <a
                href="tel:+4747617563"
                className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50"
              >
                <span className="text-base">📱</span>
                +47 476 17 563
              </a>
            </div>
          </div>
        </div>

        {/* Ola */}
        <div className="rounded-xl border border-gray-100 bg-white overflow-hidden shadow-sm">
          <div className="relative h-48 w-full bg-transparent">
            <Image
              src="/Ola.png"
              alt="Ola K. Undheim"
              fill
              className="object-contain"
            />
          </div>
          <div className="p-6">
            <p className="font-semibold text-gray-900">Ola K. Undheim</p>
            <p className="mt-0.5 text-sm text-orange-600">Teknisk sjef</p>
            <div className="mt-4 space-y-3">
              <a
                href="mailto:ola@garasjeproffen.no"
                className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50"
              >
                <span className="text-base">✉</span>
                ola@garasjeproffen.no
              </a>
              <a
                href="tel:+4791344486"
                className="flex items-center gap-3 rounded-lg border border-gray-100 px-4 py-3 text-sm text-gray-700 hover:border-orange-200 hover:bg-orange-50"
              >
                <span className="text-base">📱</span>
                +47 913 44 486
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="mt-8 rounded-xl bg-gray-50 px-6 py-5">
        <p className="text-sm text-gray-500">
          <span className="font-medium text-gray-700">Besøksadresse</span><br />
          Tjødnavegen 8b, 4342 Bryne
        </p>
      </div>

      {/* Contact form */}
      <div className="mt-12 border-t border-gray-100 pt-10">
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
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Navn *</label>
              <input
                id="name" type="text" required value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ola Nordmann"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">E-post *</label>
              <input
                id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ola@eksempel.no"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Telefon</label>
              <div className="mt-1 flex gap-2">
                <input
                  id="phone" type="tel" value={phone}
                  onChange={(e) => { setPhone(e.target.value); setPhoneVerified(false); setOtpSent(false); }}
                  disabled={phoneVerified}
                  placeholder="000 00 000"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50"
                />
                {!phoneVerified && (
                  <button type="button" onClick={sendOtp} disabled={sendingOtp || !phone}
                    className="shrink-0 rounded-md bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed">
                    {sendingOtp ? "Sender…" : otpSent ? "Send på nytt" : "Verifiser"}
                  </button>
                )}
                {phoneVerified && (
                  <span className="flex shrink-0 items-center gap-1 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                    Verifisert
                  </span>
                )}
              </div>
              {otpSent && !phoneVerified && (
                <div className="mt-2 flex gap-2">
                  <input type="text" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-sifret kode"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
                  <button type="button" onClick={verifyOtp} disabled={verifyingOtp || otp.length < 4}
                    className="shrink-0 rounded-md border border-orange-500 px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed">
                    {verifyingOtp ? "Sjekker…" : "Bekreft"}
                  </button>
                </div>
              )}
              {phoneError && <p className="mt-1 text-xs text-red-600">{phoneError}</p>}
              <div ref={recaptchaContainerRef} />
            </div>
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">Adresse *</label>
              <input
                id="address" type="text" required value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Gateveien 1, 4342 Bryne"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">Melding</label>
              <textarea
                id="message" rows={4} value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Beskriv hva du ønsker hjelp med, f.eks. type bygg, størrelse, og eventuelle spørsmål..."
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Vedlegg (valgfritt)</label>
              <p className="mt-0.5 text-xs text-gray-400">Tegninger, bilder, tomtekart o.l.</p>
              {!phoneVerified ? (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-400">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Verifiser telefonnummeret ditt for å legge til vedlegg
                </div>
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
            <button
              type="submit" disabled={submitting}
              className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (files.length > 0 ? "Laster opp vedlegg…" : "Sender...") : "Send melding"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
