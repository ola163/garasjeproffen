"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ChatLog {
  id: string;
  session_id: string;
  user_email: string | null;
  lang: string;
  messages: { role: string; content: string }[];
  created_at: string;
  updated_at: string;
}

interface TopQuestion {
  question: string;
  count: number;
}

type Tab = "innlogget" | "anonym" | "toppsporsmaal";

export default function ChatLoggPage() {
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [topQuestions, setTopQuestions] = useState<TopQuestion[]>([]);
  const [tab, setTab] = useState<Tab>("innlogget");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const res = await fetch("/api/chat/logs");
    const allLogs: ChatLog[] = res.ok ? await res.json() : [];
    setLogs(allLogs);

    // Compute top questions from anonymous sessions
    const freq: Record<string, number> = {};
    allLogs
      .filter((l) => !l.user_email)
      .forEach((l) => {
        l.messages
          .filter((m) => m.role === "user")
          .forEach((m) => {
            const q = m.content.trim().toLowerCase();
            freq[q] = (freq[q] ?? 0) + 1;
          });
      });
    const sorted = Object.entries(freq)
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
    setTopQuestions(sorted);
    setLoading(false);
  }

  const innlogget = logs.filter((l) => l.user_email);
  const anonym = logs.filter((l) => !l.user_email);

  const current = tab === "innlogget" ? innlogget : tab === "anonym" ? anonym : [];

  function formatTime(ts: string) {
    return new Date(ts).toLocaleString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function preview(messages: { role: string; content: string }[]) {
    const first = messages.find((m) => m.role === "user");
    return first ? first.content.slice(0, 80) + (first.content.length > 80 ? "…" : "") : "—";
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin" className="text-sm text-orange-600 hover:text-orange-800">← Admin</Link>
          <h1 className="text-2xl font-bold text-gray-900">Chat-logg</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl bg-white border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{innlogget.length}</p>
            <p className="text-sm text-gray-500 mt-1">Innloggede samtaler</p>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-700">{anonym.length}</p>
            <p className="text-sm text-gray-500 mt-1">Anonyme samtaler</p>
          </div>
          <div className="rounded-xl bg-white border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{topQuestions.length}</p>
            <p className="text-sm text-gray-500 mt-1">Unike spørsmål</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg border border-gray-200 bg-white p-0.5 mb-4 w-fit">
          {(["innlogget", "anonym", "toppsporsmaal"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                tab === t ? "bg-orange-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "innlogget" ? "Innlogget" : t === "anonym" ? "Anonym" : "Topp-spørsmål"}
            </button>
          ))}
        </div>

        {loading && <p className="text-sm text-gray-400 py-8 text-center">Laster…</p>}

        {/* Top questions */}
        {!loading && tab === "toppsporsmaal" && (
          <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
            {topQuestions.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">Ingen anonyme spørsmål enda.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">#</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Spørsmål</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">Antall</th>
                  </tr>
                </thead>
                <tbody>
                  {topQuestions.map((q, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-3 text-gray-700">{q.question}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center justify-center rounded-full bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 text-xs min-w-[28px]">
                          {q.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Log list */}
        {!loading && (tab === "innlogget" || tab === "anonym") && (
          <div className="rounded-xl bg-white border border-gray-200 overflow-hidden">
            {current.length === 0 ? (
              <p className="text-sm text-gray-400 p-6 text-center">Ingen samtaler her enda.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {current.map((log) => (
                  <li key={log.id}>
                    <button
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {log.user_email ? (
                              <span className="text-xs font-medium text-orange-600 bg-orange-50 rounded px-1.5 py-0.5">{log.user_email}</span>
                            ) : (
                              <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">Anonym</span>
                            )}
                            <span className="text-xs text-gray-400">{log.lang === "jaersk" ? "🧢 Jærsk" : "Bokmål"}</span>
                            <span className="text-xs text-gray-400">{log.messages.filter(m => m.role === "user").length} spørsmål</span>
                          </div>
                          <p className="text-sm text-gray-700 truncate">{preview(log.messages)}</p>
                        </div>
                        <div className="text-xs text-gray-400 shrink-0">{formatTime(log.updated_at)}</div>
                      </div>
                    </button>

                    {expanded === log.id && (
                      <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-3 max-h-96 overflow-y-auto">
                        {log.messages.map((m, i) => (
                          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                              m.role === "user"
                                ? "bg-orange-500 text-white"
                                : "bg-white text-gray-700 border border-gray-200"
                            }`}>
                              {m.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
