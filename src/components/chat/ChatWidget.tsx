"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";

type Lang = "bokmal" | "jaersk";
type BtnMode = "idle" | "pickup"; // idle = click opens chat, pickup = click moves

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME: Record<Lang, string> = {
  bokmal: "Hei! Jeg er GarasjeDrøsaren, din assistent hos GarasjeProffen. Kan jeg hjelpe deg med å finne riktig garasje, carport eller bod?",
  jaersk: "Jysla jilt du stakk innom! Ikkje stress – me tar det steg for steg og finne ei god løysing saman. Kva kan eg hjelpe deg med?",
};

const IDLE_COMMENTS = [
  "Trenger du hjelp med garasje?",
  "Har du sett konfiguratoren vår?",
  "Klikk på meg, eg veit alt om garasje!",
  "Me levere i heile Rogaland!",
  "Lurer du på noko om carport?",
  "Dæ æ møje garasjar å velge mellom!",
  "Spør meg, eg bite ikkje 🙂",
];

const DRAG_COMMENTS = [
  "Au! Flytte du på meg?",
  "Eg bur helst i ro, men ok...",
  "Spør meg om garasje heller!",
  "Ikkje vær redd, eg bite ikkje!",
  "Dra meg dit du vil – men klikk på meg au!",
];

const BTN_W = 68;
const BTN_H = Math.round(BTN_W * (1183 / 1329));

function makeSessionId() { return crypto.randomUUID(); }

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionId = useRef<string>(makeSessionId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Position
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [btnMode, setBtnMode] = useState<BtnMode>("idle");
  const [hasMoved, setHasMoved] = useState(false);
  const dragData = useRef<{ startMx: number; startMy: number; startLeft: number; startTop: number } | null>(null);

  // Comments
  const [comment, setComment] = useState<string | null>(null);
  const commentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleIdx = useRef(0);
  const dragIdx = useRef(0);
  const hasSpokenOnMove = useRef(false);
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  function showComment(text: string, ms = 4000) {
    if (commentTimer.current) clearTimeout(commentTimer.current);
    setComment(text);
    commentTimer.current = setTimeout(() => setComment(null), ms);
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPos({ left: window.innerWidth - BTN_W - 24, top: window.innerHeight - BTN_H - 24 });
    }
  }, []);

  // Idle comments (once on mount)
  useEffect(() => {
    function scheduleNext(delay: number) {
      idleTimer.current = setTimeout(() => {
        if (!openRef.current) {
          showComment(IDLE_COMMENTS[idleIdx.current % IDLE_COMMENTS.length], 5000);
          idleIdx.current++;
        }
        scheduleNext(12000 + Math.random() * 18000);
      }, delay);
    }
    scheduleNext(8000);
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drag tracking (only active in pickup mode)
  useEffect(() => {
    if (btnMode !== "pickup") return;

    function onMove(e: MouseEvent | TouchEvent) {
      if (!dragData.current) return;
      if ("touches" in e) e.preventDefault();
      const client = "touches" in e ? e.touches[0] : e;
      const dx = client.clientX - dragData.current.startMx;
      const dy = client.clientY - dragData.current.startMy;
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        if (!hasMoved) {
          setHasMoved(true);
          // Speak immediately when first moved
          if (!hasSpokenOnMove.current) {
            hasSpokenOnMove.current = true;
            showComment(DRAG_COMMENTS[dragIdx.current % DRAG_COMMENTS.length], 4000);
            dragIdx.current++;
          }
        }
        setPos({
          left: Math.max(8, Math.min(window.innerWidth - BTN_W - 8, dragData.current.startLeft + dx)),
          top:  Math.max(8, Math.min(window.innerHeight - BTN_H - 8, dragData.current.startTop + dy)),
        });
      }
    }

    function onUp() {
      // drag ended
      dragData.current = null;
      hasSpokenOnMove.current = false;
      // After placing: exit pickup mode
      if (hasMoved) {
        setHasMoved(false);
        setBtnMode("idle");
      }
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };
  }, [btnMode, hasMoved]);

  function onPointerDown(e: React.MouseEvent | React.TouchEvent) {
    if (btnMode !== "pickup" || !pos) return;
    const client = "touches" in e ? e.touches[0] : e;
    dragData.current = { startMx: client.clientX, startMy: client.clientY, startLeft: pos.left, startTop: pos.top };
    // drag started
    setHasMoved(false);
  }

  function handleBtnClick() {
    if (btnMode === "idle") {
      // First click: enter pickup mode
      setBtnMode("pickup");
      setComment("Dra meg dit du vil, eller klikk igjen for å opne chatten!");
      if (commentTimer.current) clearTimeout(commentTimer.current);
      commentTimer.current = setTimeout(() => setComment(null), 4000);
    } else if (btnMode === "pickup" && !hasMoved) {
      // Second click without moving: open chat
      setBtnMode("idle");
      setComment(null);
      setOpen((v) => !v);
    }
  }

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
      const res = await fetch("/api/chat/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, messages: msgs, lang: currentLang }),
      });
      if (!res.ok) console.error("Chat log failed:", await res.text());
    } catch (err) {
      console.error("Chat log error:", err);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || !lang) return;
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setMessages([...newMessages, { role: "assistant", content: "" }]);
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
      await logConversation([...newMessages, { role: "assistant", content: full }], lang);
    } catch {
      const fallback = lang === "jaersk"
        ? "Oi, noko gjekk gale. Ring oss på +47 476 17 563!"
        : "Beklager, noe gikk galt. Ring oss på +47 476 17 563.";
      setMessages([...newMessages, { role: "assistant", content: fallback }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  if (!pos) return null;

  const panelW = Math.min(520, typeof window !== "undefined" ? window.innerWidth * 0.95 : 520);
  const panelLeft = pos.left - panelW - 12 > 8 ? pos.left - panelW - 12 : pos.left + BTN_W + 12;
  const panelTop = Math.max(8, Math.min(pos.top, (typeof window !== "undefined" ? window.innerHeight : 800) - 600));

  const isPickup = btnMode === "pickup";

  return (
    <>
      {/* Draggable button */}
      <div
        style={{ position: "fixed", left: pos.left, top: pos.top, zIndex: 50, width: BTN_W }}
        className="select-none"
        onMouseDown={onPointerDown}
        onTouchStart={onPointerDown}
      >
        {/* Speech bubble */}
        {comment && !open && (
          <div className="absolute bottom-full mb-2 right-0 pointer-events-none animate-[fadeInUp_0.3s_ease_both]" style={{ minWidth: 160, maxWidth: 230 }}>
            <div className="rounded-2xl rounded-br-sm bg-white px-3 py-2 shadow-lg border border-gray-100 text-sm text-gray-700 leading-snug">
              {comment}
            </div>
          </div>
        )}

        {/* Tooltip */}
        <div className="group/btn relative">
          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 whitespace-nowrap rounded-lg bg-gray-900/90 px-2.5 py-1 text-xs font-medium text-white shadow-lg">
            {isPickup ? "Dra for å flytte – klikk for å åpne" : "GarasjeDrøsaren"}
          </span>

          <button
            onClick={handleBtnClick}
            aria-label="GarasjeDrøsaren"
            className={`relative overflow-hidden transition-all shadow-lg ${
              isPickup
                ? "rounded-2xl rounded-br-sm ring-4 ring-orange-400 ring-offset-2 cursor-grab bg-orange-400 scale-110"
                : "rounded-2xl rounded-br-sm bg-orange-500 hover:bg-orange-600 cursor-pointer"
            }`}
            style={{ width: BTN_W, height: BTN_H }}
          >
            {open && !isPickup ? (
              <div className="flex h-full w-full items-center justify-center">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : (
              <Image src="/GarajseDrøsaren.png" alt="GarajseDrøsaren" fill className="object-cover" />
            )}
          </button>

          {/* Pickup mode indicator dot */}
          {isPickup && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-orange-400 ring-2 ring-white animate-pulse" />
          )}
        </div>
      </div>

      {/* Chat panel */}
      {open && (
        <div
          style={{ position: "fixed", left: panelLeft, top: panelTop, zIndex: 50, width: panelW }}
          className="flex flex-col max-h-[80vh] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden"
        >
          <div className="relative w-full h-64 shrink-0 bg-orange-50">
            <Image src="/GarajseDrøsaren.png" alt="GarajseDrøsaren" fill className="object-contain" />
            <button onClick={() => setOpen(false)} aria-label="Lukk chat" className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-3 bg-orange-500 px-4 py-3 shrink-0">
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-white">GarasjeDrøsaren</p>
              <p className="text-sm text-orange-100">GarasjeProffen-assistenten</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => selectLang("bokmal")} className={`rounded px-2.5 py-1 text-sm font-medium transition-colors ${lang === "bokmal" ? "bg-white text-orange-600" : "text-white/70 hover:text-white"}`}>Bokmål</button>
              <button onClick={() => selectLang("jaersk")} className={`rounded px-2.5 py-1 text-sm font-medium transition-colors ${lang === "jaersk" ? "bg-white text-orange-600" : "text-white/70 hover:text-white"}`}>Jærsk</button>
            </div>
          </div>

          {!lang ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-5 p-10 bg-gray-50">
              <p className="text-base text-gray-600 text-center">Vel språk / Velg språk</p>
              <div className="flex gap-4">
                <button onClick={() => selectLang("bokmal")} className="rounded-xl border-2 border-orange-200 bg-white px-6 py-3.5 text-base font-semibold text-gray-800 hover:border-orange-500 hover:bg-orange-50 transition-colors">Bokmål</button>
                <button onClick={() => selectLang("jaersk")} className="rounded-xl border-2 border-orange-200 bg-white px-6 py-3.5 text-base font-semibold text-gray-800 hover:border-orange-500 hover:bg-orange-50 transition-colors">Jærsk 🧢</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="relative h-8 w-8 shrink-0 rounded-full overflow-hidden mt-1">
                        <Image src="/GarajseDrøsaren.png" alt="" fill className="object-cover" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-base leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-orange-500 text-white rounded-br-sm" : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"}`}>
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
                <button onClick={send} disabled={loading || !input.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors">
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
