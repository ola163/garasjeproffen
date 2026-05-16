"use client";

import { useState, useEffect } from "react";

const FALLBACK_PASSWORD = "Jærdagen2026";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800 select-all">
          {value}
        </span>
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-2 text-xs text-gray-500 hover:bg-gray-100 transition-colors"
        >
          {copied ? "✓" : "Kopier"}
        </button>
      </div>
    </div>
  );
}

export default function MessePasswordEditor() {
  const [hasCustom, setHasCustom] = useState<boolean | null>(null);
  const [customPassword, setCustomPassword] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/messe-password")
      .then((r) => r.json())
      .then((d) => { setHasCustom(d.hasCustomPassword ?? false); setCustomPassword(d.customPassword ?? null); })
      .catch(() => setHasCustom(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password !== confirm) { setMsg({ type: "error", text: "Passordene stemmer ikke overens." }); return; }
    if (password.length < 8) { setMsg({ type: "error", text: "Passord må være minst 8 tegn." }); return; }
    setSaving(true);
    const res = await fetch("/api/admin/messe-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setSaving(false);
    if (res.ok) {
      setMsg({ type: "success", text: "Messepassord oppdatert." });
      setCustomPassword(password); setPassword(""); setConfirm(""); setHasCustom(true);
    } else {
      const d = await res.json();
      setMsg({ type: "error", text: d.error ?? "Feil ved lagring." });
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Messebruker innlogging</h2>
      <p className="text-sm text-gray-400 mb-4">Del disse med messebrukeren.</p>

      {/* Current credentials */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3 mb-5">
        <CopyField label="Side" value="garasjeproffen.no/messe" />
        <CopyField label="E-post" value="messe@garasjeproffen.no" />
        <CopyField label="Passord" value={customPassword ?? (hasCustom === false ? FALLBACK_PASSWORD : "…")} />
        {hasCustom === null && (
          <p className="text-xs text-gray-400">Laster…</p>
        )}
      </div>

      {/* Change password */}
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Endre passord</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nytt passord</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minst 8 tegn"
              required
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 pr-16 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
              {showPw ? "Skjul" : "Vis"}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Bekreft passord</label>
          <input
            type={showPw ? "text" : "password"}
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
        <button type="submit" disabled={saving}
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors">
          {saving ? "Lagrer…" : "Oppdater passord"}
        </button>
      </form>
    </div>
  );
}
