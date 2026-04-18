"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

export default function ResetPassordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passordene stemmer ikke overens."); return; }
    if (password.length < 8) { setError("Passordet må være minst 8 tegn."); return; }
    if (!supabase) return;
    setLoading(true); setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError("Kunne ikke oppdatere passordet. Prøv å be om ny lenke."); return; }
    setSuccess(true);
    setTimeout(() => router.push("/admin"), 2500);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-8">
        <Image src="/logo-header.jpg" alt="GarasjeProffen" width={400} height={100} className="h-16 w-auto" />
      </div>
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        {success ? (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">Passord oppdatert!</p>
            <p className="mt-1 text-xs text-gray-500">Du sendes til innlogging…</p>
          </div>
        ) : !ready ? (
          <div className="text-center">
            <p className="text-sm text-gray-500">Venter på bekreftelse fra lenken…</p>
            <p className="mt-2 text-xs text-gray-400">Åpne denne siden via lenken i e-posten din.</p>
          </div>
        ) : (
          <>
            <h1 className="mb-1 text-xl font-bold text-gray-900">Nytt passord</h1>
            <p className="mb-6 text-sm text-gray-500">Skriv inn et nytt passord for din admin-konto.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="password"
                required
                placeholder="Nytt passord (min. 8 tegn)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <input
                type="password"
                required
                placeholder="Bekreft passord"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              {error && <p className="text-xs text-red-500">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
                {loading ? "Lagrer…" : "Sett nytt passord"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
