"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getFirebaseAuth } from "@/lib/firebase";
import type { ConfirmationResult } from "firebase/auth";

type Tab = "login" | "register";
type RegisterStep = "details" | "phone";

export default function EmailLogin() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Register phone step
  const [registerStep, setRegisterStep] = useState<RegisterStep>("details");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recaptchaRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  async function sendPasswordReset() {
    if (!email) { setError("Skriv inn e-postadressen din først."); return; }
    setError("");
    setLoading(true);
    try {
      if (!supabase) throw new Error("no-supabase");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/min-side`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch {
      setError("Kunne ikke sende tilbakestillingslenke. Sjekk e-postadressen.");
    } finally {
      setLoading(false);
    }
  }

  function switchTab(t: Tab) {
    setTab(t);
    setError("");
    setRegisterStep("details");
    setOtpSent(false);
    setOtp("");
  }

  async function createSession(userEmail: string) {
    const res = await fetch("/api/auth/email-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: userEmail }),
    });
    if (!res.ok) throw new Error("session");
    router.push("/min-side");
    router.refresh();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!supabase) { setError("Tjenesten er ikke tilgjengelig."); return; }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await createSession(data.user.email ?? email);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials")) {
        setError("Feil e-post eller passord.");
      } else {
        setError("Innlogging feilet. Prøv igjen.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterDetails(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passordene stemmer ikke."); return; }
    if (password.length < 6) { setError("Passordet må være minst 6 tegn."); return; }
    setRegisterStep("phone");
  }

  async function sendOtp() {
    if (!phone) { setError("Skriv inn telefonnummer."); return; }
    setError("");
    setSendingOtp(true);
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
      setSendingOtp(false);
    }
  }

  async function handleRegisterComplete() {
    if (!otp || !confirmationRef.current) return;
    setError("");
    setVerifyingOtp(true);
    try {
      await confirmationRef.current.confirm(otp);
      if (!supabase) throw new Error("no-supabase");
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      await createSession(data.user?.email ?? email);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      const msg = (err as { message?: string })?.message ?? "";
      if (code === "auth/invalid-verification-code") {
        setError("Feil kode. Prøv igjen.");
      } else if (code === "auth/code-expired") {
        setError("Koden er utløpt. Send en ny.");
      } else if (msg.toLowerCase().includes("already registered")) {
        setError("E-postadressen er allerede i bruk.");
      } else {
        setError("Registrering feilet. Prøv igjen.");
      }
    } finally {
      setVerifyingOtp(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex rounded-lg border border-gray-200 p-1 bg-gray-50">
        <button
          type="button"
          onClick={() => switchTab("login")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${tab === "login" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          Logg inn
        </button>
        <button
          type="button"
          onClick={() => switchTab("register")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition-all ${tab === "register" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
        >
          Registrer deg
        </button>
      </div>

      {/* Login */}
      {tab === "login" && (
        <div className="space-y-4">
          {!forgotMode ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">E-post</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="ola@eksempel.no"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Passord</label>
                  <button type="button" onClick={() => { setForgotMode(true); setError(""); setForgotSent(false); }}
                    className="text-xs text-orange-500 hover:underline">
                    Glemt passord?
                  </button>
                </div>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? "Logger inn…" : "Logg inn"}
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {forgotSent ? (
                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  Tilbakestillingslenke sendt til <strong>{email}</strong>. Sjekk innboksen din.
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500">Skriv inn e-postadressen din så sender vi en lenke for å tilbakestille passordet.</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">E-post</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="ola@eksempel.no"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
                  </div>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button type="button" onClick={sendPasswordReset} disabled={loading}
                    className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? "Sender…" : "Send tilbakestillingslenke"}
                  </button>
                </>
              )}
              <button type="button" onClick={() => { setForgotMode(false); setError(""); }}
                className="text-xs text-gray-400 hover:text-gray-600">
                ← Tilbake til innlogging
              </button>
            </div>
          )}
        </div>
      )}

      {/* Register — step 1: email + password */}
      {tab === "register" && registerStep === "details" && (
        <form onSubmit={handleRegisterDetails} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">E-post</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="ola@eksempel.no"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Passord</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Minst 6 tegn"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bekreft passord</label>
            <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit"
            className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600">
            Neste: verifiser mobilnummer
          </button>
        </form>
      )}

      {/* Register — step 2: phone verification */}
      {tab === "register" && registerStep === "phone" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-orange-50 px-4 py-3 text-sm text-orange-700">
            Verifiser mobilnummeret ditt for å fullføre registreringen.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Mobilnummer</label>
            <div className="mt-1 flex gap-2">
              <input type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setOtpSent(false); }}
                disabled={otpSent}
                placeholder="000 00 000"
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-50" />
              <button type="button" onClick={sendOtp} disabled={sendingOtp || !phone}
                className="shrink-0 rounded-lg bg-gray-800 px-3 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {sendingOtp ? "Sender…" : otpSent ? "Send på nytt" : "Send kode"}
              </button>
            </div>
          </div>
          {otpSent && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Engangskode</label>
              <div className="mt-1 flex gap-2">
                <input type="text" inputMode="numeric" maxLength={6} value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-sifret kode" autoFocus
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500" />
                <button type="button" onClick={handleRegisterComplete}
                  disabled={verifyingOtp || otp.length < 4}
                  className="shrink-0 rounded-lg bg-orange-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed">
                  {verifyingOtp ? "Oppretter…" : "Fullfør"}
                </button>
              </div>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="button" onClick={() => { setRegisterStep("details"); setError(""); }}
            className="text-xs text-gray-400 hover:text-gray-600">
            ← Tilbake
          </button>
          <div ref={containerRef} />
        </div>
      )}
    </div>
  );
}
