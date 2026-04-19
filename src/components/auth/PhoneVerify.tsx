"use client";

import { useState, useRef } from "react";
import { getFirebaseAuth } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

export default function PhoneVerify() {
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recaptchaRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function sendOtp() {
    if (!phone) { setError("Skriv inn telefonnummer."); return; }
    setError("");
    setSending(true);
    try {
      const auth = await getFirebaseAuth();
      if (!auth) { setError("Firebase er ikke tilgjengelig."); return; }
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, containerRef.current!, { size: "invisible" });
      }
      const formatted = phone.startsWith("+") ? phone : `+47${phone.replace(/\s/g, "")}`;
      confirmationRef.current = await signInWithPhoneNumber(auth, formatted, recaptchaRef.current);
      setOtpSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      setError(`Kunne ikke sende SMS: ${code || "ukjent feil"}`);
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setSending(false);
    }
  }

  async function verifyOtp() {
    if (!otp || !confirmationRef.current) return;
    setError("");
    setVerifying(true);
    try {
      await confirmationRef.current.confirm(otp);
      setVerified(true);
    } catch {
      setError("Feil kode. Prøv igjen.");
    } finally {
      setVerifying(false);
    }
  }

  if (verified) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
        Telefon verifisert
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setOtpSent(false); }}
          disabled={otpSent}
          placeholder="000 00 000"
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50"
        />
        <button
          type="button"
          onClick={sendOtp}
          disabled={sending || !phone}
          className="shrink-0 rounded-md bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? "Sender…" : otpSent ? "Send på nytt" : "Send kode"}
        </button>
      </div>
      {otpSent && (
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-sifret kode"
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <button
            type="button"
            onClick={verifyOtp}
            disabled={verifying || otp.length < 4}
            className="shrink-0 rounded-md border border-orange-500 px-3 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying ? "Sjekker…" : "Bekreft"}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div ref={containerRef} />
    </div>
  );
}
