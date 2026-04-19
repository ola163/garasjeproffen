"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exchanging, setExchanging] = useState(true);

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code || !supabase) {
      setError("Ugyldig eller utløpt lenke. Be om en ny tilbakestillingslenke.");
      setExchanging(false);
      return;
    }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError("Lenken er ugyldig eller utløpt. Be om en ny tilbakestillingslenke.");
      }
      setExchanging(false);
    });
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passordene stemmer ikke."); return; }
    if (password.length < 6) { setError("Passordet må være minst 6 tegn."); return; }
    setError("");
    setLoading(true);
    try {
      if (!supabase) throw new Error("no-supabase");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/min-side?reset=ok");
    } catch (err: unknown) {
      setError("Kunne ikke oppdatere passordet. Prøv igjen.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (exchanging) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <p className="text-sm text-gray-500">Verifiserer lenke…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Nytt passord</h1>
        <p className="mt-2 text-sm text-gray-500">Skriv inn et nytt passord for kontoen din.</p>

        {error ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-red-600">{error}</p>
            <a href="/min-side" className="text-sm text-orange-500 hover:underline">
              ← Tilbake til innlogging
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nytt passord</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minst 6 tegn"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bekreft passord</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Lagrer…" : "Lagre nytt passord"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center">
        <p className="text-sm text-gray-500">Laster…</p>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
