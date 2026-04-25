"use client";

import { useState, useEffect, useRef } from "react";
import { getFirebaseAuth } from "@/lib/firebase";

const GENERIC_ERROR = "Vi kunne ikke bekrefte innsendingen. Prøv igjen, eller kontakt oss direkte på post@garasjeproffen.no.";
const MIN_SUBMIT_MS = 3000;

export default function ContactForm() {
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState("");

  const mountedAt  = useRef(Date.now());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recaptchaRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Render reCAPTCHA widget when component mounts
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const auth = await getFirebaseAuth();
      if (!auth || cancelled || !containerRef.current) return;
      if (recaptchaRef.current) return;
      try {
        const { RecaptchaVerifier } = await import("firebase/auth");
        recaptchaRef.current = new RecaptchaVerifier(auth, containerRef.current, { size: "normal" });
        recaptchaRef.current.render();
      } catch {
        // Firebase not available — continue without reCAPTCHA (fail-closed at submit)
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");

    // Minimum time since page load — catch very fast bot submissions
    if (Date.now() - mountedAt.current < MIN_SUBMIT_MS) {
      setError(GENERIC_ERROR);
      setSending(false);
      return;
    }

    try {
      // Require reCAPTCHA verification before submitting
      if (!recaptchaRef.current) throw new Error("recaptcha_missing");
      await recaptchaRef.current.verify();

      const formData = new FormData();
      formData.append("name", name);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("message", message);
      // Honeypot — always empty for real users
      formData.append("website", "");

      const res = await fetch("/api/kontakt", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error("api_error");
      setSent(true);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "";
      if (msg === "recaptcha_missing" || msg.includes("reCAPTCHA") || msg.includes("recaptcha") || msg.includes("Firebase")) {
        setError(GENERIC_ERROR);
      } else {
        setError(GENERIC_ERROR);
      }
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-green-100 bg-green-50 p-8 text-center h-full min-h-[300px]">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="font-semibold text-green-800">Melding sendt!</p>
        <p className="mt-1 text-sm text-green-600">Vi tar kontakt med deg snart.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900">Ta kontakt</h3>
      <p className="mt-1 text-sm text-gray-500">Fyll inn skjemaet så svarer vi deg raskt.</p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        {/* Honeypot — hidden from real users, bots fill it */}
        <div aria-hidden="true" style={{ display: "none" }}>
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Navn *</label>
          <input
            required
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ditt navn"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">E-post *</label>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@epost.no"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Telefon</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="000 00 000"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Melding *</label>
          <textarea
            required
            rows={4}
            maxLength={3000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Hva kan vi hjelpe deg med?"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none"
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {/* reCAPTCHA widget */}
        <div ref={containerRef} className="flex justify-center" />

        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "Sender…" : "Send melding"}
        </button>

        <p className="text-[11px] text-gray-400 text-center leading-snug">
          Dette skjemaet er beskyttet mot spam og misbruk.{" "}
          <a href="/vilkar#personvern" className="underline hover:text-gray-600">Personvernerklæring</a>.
        </p>
      </form>

      <div className="mt-4 border-t border-gray-100 pt-4 space-y-1">
        <a href="mailto:post@garasjeproffen.no" className="flex items-center gap-2 text-xs text-gray-400 hover:text-orange-600">
          <span>✉</span> post@garasjeproffen.no
        </a>
        <a href="tel:+4747617563" className="flex items-center gap-2 text-xs text-gray-400 hover:text-orange-600">
          <span>📱</span> +47 476 17 563
        </a>
      </div>
    </div>
  );
}
