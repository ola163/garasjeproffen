"use client";

import { useState } from "react";
import Image from "next/image";

export default function Kontakt() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; error?: string } | null>(null);

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
              <input
                id="phone" type="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="000 00 000"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
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
