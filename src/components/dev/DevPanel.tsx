"use client";

import { useState, useEffect } from "react";

const PRESETS = [
  { label: "christian@garasjeproffen.no", type: "admin" as const },
  { label: "ola@garasjeproffen.no",       type: "admin" as const },
  { label: "test@example.com",            type: "user"  as const },
];

export default function DevPanel() {
  const [visible, setVisible] = useState(false);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [customEmail, setCustomEmail] = useState("");

  useEffect(() => {
    setVisible(
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );
  }, []);

  if (!visible) return null;

  async function login(type: "admin" | "user" | "logout", email?: string) {
    setLoading(true);
    await fetch("/api/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, email }),
    });
    setLoading(false);
    window.location.reload();
  }

  return (
    <div className="fixed top-4 left-4 z-[9999]">
      {open ? (
        <div className="w-64 rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between bg-gray-900 px-4 py-2.5">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-400">Dev Login</span>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white text-lg leading-none">×</button>
          </div>

          <div className="p-3 space-y-1.5">
            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Admin</p>
            {PRESETS.filter(p => p.type === "admin").map(p => (
              <button key={p.label} disabled={loading}
                onClick={() => login("admin", p.label)}
                className="w-full rounded-lg bg-gray-900 px-3 py-2 text-left text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
                {p.label}
              </button>
            ))}

            <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Vanlig bruker</p>
            {PRESETS.filter(p => p.type === "user").map(p => (
              <button key={p.label} disabled={loading}
                onClick={() => login("user", p.label)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                {p.label}
              </button>
            ))}

            {/* Custom email */}
            <p className="px-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Egendefinert</p>
            <div className="flex gap-1.5">
              <input
                type="email"
                value={customEmail}
                onChange={e => setCustomEmail(e.target.value)}
                placeholder="epost@example.com"
                className="flex-1 min-w-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-orange-400"
              />
              <button disabled={loading || !customEmail}
                onClick={() => login("user", customEmail)}
                className="shrink-0 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                Inn
              </button>
            </div>

            <div className="border-t border-gray-100 pt-1.5">
              <button disabled={loading}
                onClick={() => login("logout")}
                className="w-full rounded-lg border border-red-100 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors">
                Logg ut
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-gray-900 px-3 py-1.5 text-xs font-bold text-orange-400 shadow-lg hover:bg-gray-700 transition-colors"
        >
          DEV
        </button>
      )}
    </div>
  );
}
