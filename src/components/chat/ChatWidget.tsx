"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

type Lang = "bokmal" | "jaersk";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Record<Lang, string> = {
  bokmal: "Hei! Jeg er GarasjeDrøsaren, din assistent hos GarasjeProffen. Kan jeg hjelpe deg med å finne riktig garasje, carport eller bod?",
  jaersk: "Jysla jilt du stakk innom! Ikkje stress – me tar det steg for steg og finne ei god løysing saman. Kva kan eg hjelpe deg med?",
};

function makeSessionId() {
  return crypto.randomUUID();
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionId = useRef<string>(makeSessionId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && lang) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, lang, messages]);

  function selectLang(l: Lang) {
    setLang(l);
    setMessages([{ role: "assistant", content: WELCOME[l] }]);
  }

  async function logConversation(msgs: Message[], currentLang: Lang) {
    try {
      await fetch("/api/chat/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, messages: msgs, lang: currentLang }),
      });
    } catch {
      // silent — logging must never break the chat
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || !lang) return;

    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const assistantMessage: Message = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMessage]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages, lang }),
      });

      if (!res.ok || !res.body) throw new Error();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages([...newMessages, { role: "assistant", content: full }]);
      }

      const finalMessages = [...newMessages, { role: "assistant" as const, content: full }];
      await logConversation(finalMessages, lang);
    } catch {
      const fallback = lang === "jaersk"
        ? "Oi, noko gjekk gale. Ring oss på +47 476 17 563!"
        : "Beklager, noe gikk galt. Ring oss på +47 476 17 563.";
      const errMessages = [...newMessages, { role: "assistant" as const, content: fallback }];
      setMessages(errMessages);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating button with tooltip */}
      <div className="fixed bottom-6 right-6 z-50 group/fab">
        <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover/fab:opacity-100 transition-opacity duration-200 whitespace-nowrap rounded-lg bg-gray-900/90 px-3 py-1.5 text-sm font-medium text-white shadow-lg">
          GarasjeDrøsaren
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Åpne chat"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg hover:bg-orange-600 transition-colors overflow-hidden"
        >
          {open ? (
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <Image src="/GarajseDrøsaren.png" alt="GarajseDrøsaren" fill className="object-cover" />
          )}
        </button>
      </div>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex flex-col w-[min(520px,95vw)] max-h-[80vh] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
          {/* Hero image */}
          <div className="relative w-full h-64 shrink-0 bg-orange-50">
            <Image src="/GarajseDrøsaren.png" alt="GarajseDrøsaren" fill className="object-contain" />
            <button
              onClick={() => setOpen(false)}
              aria-label="Lukk chat"
              className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 bg-orange-500 px-4 py-3 shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-white">GarasjeDrøsaren</p>
              <p className="text-sm text-orange-100">GarasjeProffen-assistenten</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => selectLang("bokmal")}
                className={`rounded px-2.5 py-1 text-sm font-medium transition-colors ${lang === "bokmal" ? "bg-white text-orange-600" : "text-white/70 hover:text-white"}`}
              >
                Bokmål
              </button>
              <button
                onClick={() => selectLang("jaersk")}
                className={`rounded px-2.5 py-1 text-sm font-medium transition-colors ${lang === "jaersk" ? "bg-white text-orange-600" : "text-white/70 hover:text-white"}`}
              >
                Jærsk
              </button>
            </div>
          </div>

          {/* Language picker or messages */}
          {!lang ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-5 p-10 bg-gray-50">
              <p className="text-base text-gray-600 text-center">Vel språk / Velg språk</p>
              <div className="flex gap-4">
                <button
                  onClick={() => selectLang("bokmal")}
                  className="rounded-xl border-2 border-orange-200 bg-white px-6 py-3.5 text-base font-semibold text-gray-800 hover:border-orange-500 hover:bg-orange-50 transition-colors"
                >
                  Bokmål
                </button>
                <button
                  onClick={() => selectLang("jaersk")}
                  className="rounded-xl border-2 border-orange-200 bg-white px-6 py-3.5 text-base font-semibold text-gray-800 hover:border-orange-500 hover:bg-orange-50 transition-colors"
                >
                  Jærsk 🧢
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="relative h-8 w-8 shrink-0 rounded-full overflow-hidden mt-1">
                        <Image src="/GarajseDrøsaren.png" alt="" fill className="object-cover" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-base leading-relaxed whitespace-pre-wrap ${
                        m.role === "user"
                          ? "bg-orange-500 text-white rounded-br-sm"
                          : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                      }`}
                    >
                      {m.content}
                      {loading && i === messages.length - 1 && m.role === "assistant" && m.content === "" && (
                        <span className="inline-flex gap-1 py-1">
                          <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" />
                          <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.15s]" />
                          <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.3s]" />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="border-t border-gray-100 bg-white p-4 flex gap-3 items-end shrink-0">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={lang === "jaersk" ? "Skriv noko…" : "Skriv en melding…"}
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-base focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400 max-h-36 overflow-y-auto"
                />
                <button
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
