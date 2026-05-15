"use client";

import { useState, useEffect } from "react";

export default function MessePasswordEditor() {
  const [hasCustom, setHasCustom] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/messe-password")
      .then((r) => r.json())
      .then((d) => setHasCustom(d.hasCustomPassword ?? false))
      .catch(() => setHasCustom(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (password !== confirm) {
      setMsg({ type: "error", text: "Passordene stemmer ikke overens." });
      return;
    }
    if (password.length < 8) {
      setMsg({ type: "error", text: "Passord må være minst 8 tegn." });
      return;
    }

    setSaving(true);
    const res = await fetch("/api/admin/messe-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSaving(false);

    if (res.ok) {
      setMsg({ type: "success", text: "Messepassord oppdatert." });
      setPassword("");
      setConfirm("");
      setHasCustom(true);
    } else {
      const d = await res.json();
      setMsg({ type: "error", text: d.error ?? "Feil ved lagring." });
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100">
          <svg className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Messebruker passord</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Logg inn-side: <span className="font-mono text-gray-600">/messe</span>
            {hasCustom === null ? "" : hasCustom
              ? " · Tilpasset passord er satt"
              : " · Bruker standardpassord (Jærdagen2026)"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nytt passord</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minst 8 tegn"
            required
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bekreft passord</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Gjenta passord"
            required
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
          />
        </div>

        {msg && (
          <div className={`rounded-lg px-3 py-2 text-sm ${msg.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
        >
          {saving ? "Lagrer…" : "Oppdater passord"}
        </button>
      </form>
    </div>
  );
}
