"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { GarageConfiguration, PricingResult } from "@/types/configurator";
import type { QuoteResponse } from "@/types/quote";
import type { AddedElement } from "@/components/configurator/DoorWindowAdder";
import { supabase } from "@/lib/supabase";
import { getFirebaseAuth } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

interface QuoteFormProps {
  configuration: GarageConfiguration;
  pricing: PricingResult;
  packageType: string;
  roofType: string;
  addedElements: AddedElement[];
  open: boolean;
}

export default function QuoteForm({ configuration, pricing, packageType, roofType, addedElements, open }: QuoteFormProps) {
  const router = useRouter();
  const [needsPermit, setNeedsPermit] = useState<"nei" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuoteResponse | null>(null);

  // Phone verification
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recaptchaRef = useRef<any>(null);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
    };
  }, []);

  async function sendOtp() {
    if (!phone) { setPhoneError("Skriv inn telefonnummer først."); return; }
    setPhoneError("");
    setSendingOtp(true);
    try {
      const firebaseAuth = getFirebaseAuth();
      if (!firebaseAuth) { setPhoneError("Firebase er ikke tilgjengelig. Prøv igjen."); return; }
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, recaptchaContainerRef.current!, { size: "invisible" });
      }
      const formatted = phone.startsWith("+") ? phone : `+47${phone.replace(/\s/g, "")}`;
      confirmationRef.current = await signInWithPhoneNumber(firebaseAuth, formatted, recaptchaRef.current);
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

  const p = configuration.parameters;
  const soknadUrl = `/soknadshjelp?buildingType=garasje&lengthMm=${p.length ?? 6000}&widthMm=${p.width ?? 8400}&doorWidthMm=${p.doorWidth ?? 2500}&doorHeightMm=${p.doorHeight ?? 2125}`;

  async function uploadFiles(): Promise<string[]> {
    if (!supabase || files.length === 0) return [];
    const prefix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const urls: string[] = [];
    for (const file of files) {
      const path = `${prefix}/${file.name}`;
      const { error } = await supabase.storage.from("quote-attachments").upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("quote-attachments").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const attachmentUrls = await uploadFiles();
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configuration,
          pricing,
          packageType,
          roofType,
          addedElements,
          customer: { name, email, phone, message, phoneVerified },
          attachmentUrls,
        }),
      });
      const data: QuoteResponse = await res.json();
      setResult(data);
      if (data.success) {
        setName(""); setEmail(""); setPhone(""); setFiles([]);
      }
    } catch {
      setResult({ success: false, error: "Nettverksfeil. Vennligst prøv igjen." });
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  if (result?.success) {
    return (
      <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
        <p className="font-semibold">Forespørselen er sendt!</p>
        <p className="mt-1">Vi tar kontakt med deg snart med et endelig tilbud.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Søknadshjelp question */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm font-medium text-gray-700">Trenger du hjelp med byggesøknad?</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => router.push(soknadUrl)}
            className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:border-orange-300 transition-all"
          >
            Ja
          </button>
          <button
            type="button"
            onClick={() => setNeedsPermit("nei")}
            className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-all ${
              needsPermit === "nei"
                ? "border-orange-500 bg-orange-50 text-orange-700"
                : "border-gray-200 text-gray-600 hover:border-orange-300"
            }`}
          >
            Nei
          </button>
        </div>
      </div>

      {/* Quote form — shown when no permit needed */}
      {needsPermit === "nei" && (
        <>
          <h3 className="mt-6 text-lg font-semibold text-gray-900">Be om tilbud</h3>
          <p className="mt-1 text-sm text-gray-500">
            Fyll inn dine opplysninger, så tar vi kontakt med et endelig tilbud.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">Navn *</label>
              <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">E-post *</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
            </div>
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Telefon</label>
              <div className="mt-1 flex gap-2">
                <input id="phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setPhoneVerified(false); setOtpSent(false); }}
                  disabled={phoneVerified}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50" />
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
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">Eventuelle spesielle ønsker</label>
              <textarea id="message" rows={3} value={message} onChange={(e) => setMessage(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="Skriv inn eventuelle spesielle ønsker eller kommentarer..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Vedlegg (valgfritt)</label>
              <p className="mt-0.5 text-xs text-gray-400">Tegninger, bilder, tomtekart o.l. Maks 10 MB per fil.</p>
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
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{result.error}</div>
            )}
            <button type="submit" disabled={submitting}
              className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? (files.length > 0 ? "Laster opp vedlegg…" : "Sender...") : "Send tilbudsforespørsel"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
