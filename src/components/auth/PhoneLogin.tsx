"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

export default function PhoneLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
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
      setError(`Feil: ${code || "kunne ikke sende SMS"}`);
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
      const formatted = phone.startsWith("+") ? phone : `+47${phone.replace(/\s/g, "")}`;
      const res = await fetch("/api/auth/phone-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formatted }),
      });
      if (!res.ok) throw new Error("session");
      router.push("/min-side");
      router.refresh();
    } catch {
      setError("Noe gikk galt. Prøv igjen.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-4">
      {!otpSent ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefonnummer</label>
            <div className="mt-1 flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                placeholder="000 00 000"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={sendOtp}
                disabled={sending || !phone}
                className="shrink-0 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Sender…" : "Send kode"}
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400">Vi sender en engangskode til ditt nummer via SMS.</p>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">Engangskode</label>
            <p className="mt-0.5 text-xs text-gray-400">Kode sendt til {phone}</p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                placeholder="6-sifret kode"
                autoFocus
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button
                type="button"
                onClick={verifyOtp}
                disabled={verifying || otp.length < 4}
                className="shrink-0 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifying ? "Logger inn…" : "Logg inn"}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setOtpSent(false); setOtp(""); setError(""); recaptchaRef.current?.clear(); recaptchaRef.current = null; }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ← Endre nummer
          </button>
        </>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div ref={containerRef} />
    </div>
  );
}
