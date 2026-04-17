"use client";

import { useState, useEffect } from "react";
import { supabase, type SavedConfig } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface CurrentConfig {
  packageType: string;
  roofType: string;
  length: number;
  width: number;
  doorWidth: number;
  doorHeight: number;
  addedElements: { side: string; category: string; placement: string }[];
}

interface AuthPanelProps {
  currentConfig: CurrentConfig;
  onLoadConfig: (config: CurrentConfig) => void;
}

type View = "closed" | "login" | "register" | "saved";

export default function AuthPanel({ currentConfig, onLoadConfig }: AuthPanelProps) {
  const [view, setView] = useState<View>("closed");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([]);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Check session on mount
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
      if (session?.user) loadSavedConfigs();
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadSavedConfigs() {
    if (!supabase) return;
    const { data } = await supabase
      .from("saved_configs")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setSavedConfigs(data as SavedConfig[]);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setView("saved");
    loadSavedConfigs();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true); setError("");
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) { setError("Feil e-post eller passord."); return; }
    setView("saved");
    loadSavedConfigs();
  }

  async function handleLogout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setSavedConfigs([]);
    setView("closed");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !user) return;
    setSaving(true); setSaveSuccess(false);
    const { error: err } = await supabase.from("saved_configs").insert({
      name: saveName || "Mitt garasjedesign",
      config: currentConfig,
      user_id: user.id,
    });
    setSaving(false);
    if (!err) {
      setSaveSuccess(true);
      setSaveName("");
      setTimeout(() => setSaveSuccess(false), 3000);
      loadSavedConfigs();
    }
  }

  async function handleDelete(id: string) {
    if (!supabase) return;
    await supabase.from("saved_configs").delete().eq("id", id);
    setSavedConfigs((prev) => prev.filter((c) => c.id !== id));
  }

  if (!supabase) return null;

  const CATEGORY_LABELS: Record<string, string> = {
    door: "Dør 90×210", window1: "Vindu 100×50", window2: "Vindu 100×60", window3: "Vindu 100×100",
  };
  const SIDE_LABELS: Record<string, string> = {
    front: "Front", back: "Bak", left: "Venstre", right: "Høyre",
  };

  // ── Logged in ──
  if (user) {
    return (
      <div className="mt-6 border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Mine design</p>
          <button onClick={handleLogout} className="text-xs text-gray-400 hover:text-gray-600">
            Logg ut
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3 truncate">{user.email}</p>

        {/* Save current */}
        <form onSubmit={handleSave} className="flex gap-2 mb-4">
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Navn på design..."
            className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            type="submit"
            disabled={saving}
            className="shrink-0 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {saving ? "…" : "Lagre"}
          </button>
        </form>
        {saveSuccess && (
          <p className="text-xs text-green-600 mb-3">Design lagret!</p>
        )}

        {/* Saved list */}
        {savedConfigs.length === 0 ? (
          <p className="text-xs text-gray-400">Ingen lagrede design ennå.</p>
        ) : (
          <ul className="space-y-2">
            {savedConfigs.map((sc) => (
              <li key={sc.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{sc.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {sc.config.width / 1000} × {sc.config.length / 1000} m
                      {sc.config.addedElements?.length > 0 && (
                        <span> · {sc.config.addedElements.length} tillegg</span>
                      )}
                    </p>
                    {sc.config.addedElements?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {sc.config.addedElements.map((el) =>
                          `${CATEGORY_LABELS[el.category] ?? el.category} (${SIDE_LABELS[el.side] ?? el.side})`
                        ).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { onLoadConfig(sc.config); }}
                      className="rounded px-2 py-1 text-xs font-medium text-orange-600 hover:bg-orange-50 border border-orange-200"
                    >
                      Last inn
                    </button>
                    <button
                      onClick={() => handleDelete(sc.id)}
                      className="rounded px-2 py-1 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ── Logged out ──
  return (
    <div className="mt-6 border-t border-gray-100 pt-5">
      {view === "closed" && (
        <button
          onClick={() => setView("login")}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 hover:border-orange-400 hover:text-orange-500 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Logg inn for å lagre design
        </button>
      )}

      {(view === "login" || view === "register") && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
              <button
                onClick={() => { setView("login"); setError(""); }}
                className={`rounded-md px-3 py-1 font-medium transition-all ${view === "login" ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-700"}`}
              >
                Logg inn
              </button>
              <button
                onClick={() => { setView("register"); setError(""); }}
                className={`rounded-md px-3 py-1 font-medium transition-all ${view === "register" ? "bg-orange-500 text-white" : "text-gray-500 hover:text-gray-700"}`}
              >
                Registrer
              </button>
            </div>
            <button onClick={() => setView("closed")} className="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          <form onSubmit={view === "login" ? handleLogin : handleRegister} className="space-y-2">
            <input
              type="email"
              required
              placeholder="E-post"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <input
              type="password"
              required
              placeholder="Passord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-orange-500 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? "…" : view === "login" ? "Logg inn" : "Opprett konto"}
            </button>
          </form>
          {view === "register" && (
            <p className="mt-2 text-xs text-gray-400">
              Du vil motta en bekreftelseslenke på e-post.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
