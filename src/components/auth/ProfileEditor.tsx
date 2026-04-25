"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Msg = { type: "success" | "error" | "info"; text: string };

export default function ProfileEditor() {
  const [originalName,  setOriginalName]  = useState("");
  const [originalEmail, setOriginalEmail] = useState("");
  const [name,  setName]  = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const n = user.user_metadata?.full_name ?? "";
        const e = user.email ?? "";
        setOriginalName(n);
        setOriginalEmail(e);
        setName(n);
        setEmail(e);
        setHasSession(true);
      }
      setLoading(false);
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setSaving(true);
    setMsg(null);

    const nameChanged  = name.trim() !== originalName;
    const emailChanged = email.trim().toLowerCase() !== originalEmail.toLowerCase();

    if (!nameChanged && !emailChanged) {
      setMsg({ type: "info", text: "Ingen endringer å lagre." });
      setSaving(false);
      return;
    }

    const update: Parameters<typeof supabase.auth.updateUser>[0] = {};
    if (nameChanged)  update.data  = { full_name: name.trim() };
    if (emailChanged) update.email = email.trim();

    const { error } = await supabase.auth.updateUser(update);

    if (error) {
      setMsg({ type: "error", text: error.message });
    } else if (emailChanged) {
      setMsg({
        type: "info",
        text: "En bekreftelseslenke er sendt til den nye e-postadressen. E-posten oppdateres etter at du har bekreftet.",
      });
      if (nameChanged) {
        setOriginalName(name.trim());
      }
    } else {
      setOriginalName(name.trim());
      setMsg({ type: "success", text: "Profilen er oppdatert." });
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <div className="mt-4 space-y-3">
        <div className="h-8 w-3/4 animate-pulse rounded bg-gray-100" />
        <div className="h-8 w-full animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <p className="mt-3 text-sm text-gray-400">
        Logg inn med e-post og passord for å redigere profilinformasjon.
      </p>
    );
  }

  const emailChanged = email.trim().toLowerCase() !== originalEmail.toLowerCase();

  return (
    <form onSubmit={handleSave} className="mt-5 space-y-4">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Navn</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ditt navn"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
      </div>

      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">E-post</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
        />
        {emailChanged && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            Du vil motta en bekreftelseslenke på den nye adressen.
          </p>
        )}
      </div>

      {/* Feedback */}
      {msg && (
        <div className={`rounded-lg px-3 py-2.5 text-sm ${
          msg.type === "success" ? "bg-green-50 text-green-700" :
          msg.type === "error"   ? "bg-red-50 text-red-700" :
                                   "bg-blue-50 text-blue-700"
        }`}>
          {msg.text}
        </div>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 transition-colors"
      >
        {saving ? "Lagrer…" : "Lagre endringer"}
      </button>
    </form>
  );
}
