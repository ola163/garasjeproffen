"use client";

import { useState } from "react";

const BRAND = "#e2520a";

interface Lead {
  id: string;
  date: string;
  name: string;
  email: string;
  phone: string;
  size: string;
  message: string;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(leads: Lead[]) {
  const headers = ["Dato", "Navn", "E-post", "Telefon", "Størrelse", "Melding"];
  const rows = leads.map((l) => [
    formatDate(l.date),
    l.name,
    l.email,
    l.phone,
    l.size,
    l.message,
  ]);

  const csvContent =
    [headers, ...rows]
      .map((row) => row.map(escapeCsvField).join(","))
      .join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminLeadsPage() {
  const [secret, setSecret] = useState("");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function fetchLeads() {
    if (!secret.trim()) {
      setErrorMsg("Skriv inn hemmeligheten.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setLeads(null);

    try {
      const res = await fetch(`/api/leads?secret=${encodeURIComponent(secret)}`);

      if (res.status === 401) {
        throw new Error("Feil hemmelighet. Tilgang nektet.");
      }
      if (!res.ok) {
        throw new Error("Klarte ikke hente leads. Prøv igjen.");
      }

      const data: Lead[] = await res.json();
      setLeads(data);
      setStatus("idle");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Noe gikk galt.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="px-6 py-5 text-white flex items-center gap-3"
        style={{ backgroundColor: BRAND }}
      >
        <h1 className="text-xl font-bold">GarasjeProffen — Admin: Leads</h1>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Auth panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-3">
            Autentisering
          </h2>
          <div className="flex gap-3 flex-wrap">
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLeads()}
              placeholder="Skriv inn hemmeligheten (LEADS_SECRET)"
              className="flex-1 min-w-48 border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
              style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
            />
            <button
              onClick={fetchLeads}
              disabled={status === "loading"}
              className="px-6 py-2.5 rounded-lg font-semibold text-white transition-opacity disabled:opacity-60 cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: BRAND }}
            >
              {status === "loading" ? "Laster…" : "Hent leads"}
            </button>
          </div>

          {status === "error" && (
            <p className="mt-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Results */}
        {leads !== null && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-gray-600 text-sm">
                {leads.length === 0
                  ? "Ingen leads registrert ennå."
                  : `${leads.length} lead${leads.length !== 1 ? "s" : ""} funnet`}
              </p>
              {leads.length > 0 && (
                <button
                  onClick={() => downloadCsv(leads)}
                  className="px-5 py-2 rounded-lg font-semibold text-white text-sm cursor-pointer transition-opacity hover:opacity-90"
                  style={{ backgroundColor: BRAND }}
                >
                  Last ned CSV
                </button>
              )}
            </div>

            {leads.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs">
                    <tr>
                      {["Dato", "Navn", "E-post", "Telefon", "Størrelse", "Melding"].map(
                        (col) => (
                          <th
                            key={col}
                            className="px-4 py-3 font-semibold whitespace-nowrap"
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {leads.map((lead) => (
                      <tr
                        key={lead.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                          {formatDate(lead.date)}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                          {lead.name}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <a
                            href={`mailto:${lead.email}`}
                            className="hover:underline"
                            style={{ color: BRAND }}
                          >
                            {lead.email}
                          </a>
                        </td>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                          {lead.phone}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {lead.size || <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                          {lead.message || <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
