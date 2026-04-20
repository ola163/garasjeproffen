"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

type Lang = "bokmal" | "jaersk";
interface Message { role: "user" | "assistant"; content: string; }

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
  "Au! Ikkje flytt meg!",
  "Hei, eg bur helst i ro du!",
  "Au au – forsiktig no!",
  "Klikk på meg heller, eg hjelper deg!",
  "No flytta du meg igjen...",
];

const BTN_W = 68;
const BTN_H = Math.round(BTN_W * (1183 / 1329));
const DRAG_THRESHOLD = 5;
const STORAGE_KEY = "gd-dismissed";

function makeSessionId() { return crypto.randomUUID(); }

export default function ChatWidget() {
  const [dismissed, setDismissed] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<Lang | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionId = useRef<string>(makeSessionId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pathname = usePathname();
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [animating, setAnimating] = useState(false);
  const [comment, setComment] = useState<string | null>(null);
  const commentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleIdx = useRef(0);
  const dragIdx = useRef(0);
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  const dragStart = useRef<{ mx: number; my: number; left: number; top: number } | null>(null);
  const didDrag = useRef(false);
  const justDragged = useRef(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    function onV() { setDismissed(localStorage.getItem(STORAGE_KEY) === "1"); }
    window.addEventListener("gd-visibility", onV);
    return () => window.removeEventListener("gd-visibility", onV);
  }, []);

  function dismiss() {
    setOpen(false);
    setComment(null);
    setDismissing(true);
    setAnimating(true);
    setPos((p) => p ? { left: p.left, top: -BTN_H - 20 } : p);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "1");
      setDismissed(true);
      setDismissing(false);
      setAnimating(false);
      window.dispatchEvent(new Event("gd-visibility"));
    }, 1400);
  }

  function showComment(text: string, ms = 4000) {
    if (commentTimer.current) clearTimeout(commentTimer.current);
    setComment(text);
    commentTimer.current = setTimeout(() => setComment(null), ms);
  }

  const CONFIGURATOR_PATHS = ["/configurator", "/garasje", "/carport"];
  const isConfigurator = CONFIGURATOR_PATHS.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPos({ left: window.innerWidth - BTN_W - 24, top: window.innerHeight - BTN_H - 24 });
    }
  }, []);

  // Slow animated slide to bottom-left on configurator pages
  useEffect(() => {
    if (!isConfigurator) return;
    showComment("Eg ska gå vekk så eg ikkje står i vegen! 👋", 5000);
    setAnimating(true);
    setPos({ left: 24, top: window.innerHeight - BTN_H - 24 });
    const t = setTimeout(() => setAnimating(false), 1800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigurator]);

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

  // All drag handlers on the button so setPointerCapture doesn't break click
  function onBtnPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!pos) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { mx: e.clientX, my: e.clientY, left: pos.left, top: pos.top };
    didDrag.current = false;
  }

  function onBtnPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      didDrag.current = true;
      setPos({
        left: Math.max(8, Math.min(window.innerWidth - BTN_W - 8, dragStart.current.left + dx)),
        top:  Math.max(8, Math.min(window.innerHeight - BTN_H - 8, dragStart.current.top + dy)),
      });
    }
  }

  function onBtnPointerUp() {
    if (!dragStart.current) return;
    const wasDrag = didDrag.current;
    dragStart.current = null;
    didDrag.current = false;
    if (wasDrag) {
      justDragged.current = true;
      showComment(DRAG_COMMENTS[dragIdx.current % DRAG_COMMENTS.length], 4000);
      dragIdx.current++;
    }
  }

  function onBtnPointerCancel() {
    dragStart.current = null;
    didDrag.current = false;
  }

  function handleBtnClick() {
    if (justDragged.current) { justDragged.current = false; return; }
    setComment(null);
    setOpen((v) => !v);
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
    } catch (err) { console.error("Chat log error:", err); }
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
      const fallback = lang === "jaersk" ? "Oi, noko gjekk gale. Ring oss på +47 476 17 563!" : "Beklager, noe gikk galt. Ring oss på +47 476 17 563.";
      setMessages([...newMessages, { role: "assistant", content: fallback }]);
    } finally { setLoading(false); }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  if (dismissed || !pos) return null;

  // Bubble appears to the right when button is on the left half of screen
  const onLeftSide = pos.left < (typeof window !== "undefined" ? window.innerWidth / 2 : 400);

  const panelW = Math.min(520, typeof window !== "undefined" ? window.innerWidth * 0.95 : 520);
  const panelLeft = pos.left - panelW - 12 > 8 ? pos.left - panelW - 12 : pos.left + BTN_W + 12;
  const panelTop = Math.max(8, Math.min(pos.top, (typeof window !== "undefined" ? window.innerHeight : 800) - 600));

  return (
    <>
      {/* Draggable wrapper */}
      <div
        style={{
          position: "fixed",
          left: pos.left,
          top: pos.top,
          zIndex: 50,
          width: BTN_W,
          touchAction: "none",
          transition: (animating || dismissing) ? "left 1.6s ease-in-out, top 1.2s ease" : "none",
        }}
        className="select-none"
      >
        {/* Speech bubble — flips side based on position */}
        {comment && !open && (
          <div
            className="absolute bottom-full mb-2 pointer-events-none animate-[fadeInUp_0.3s_ease_both]"
            style={{
              [onLeftSide ? "left" : "right"]: 0,
              minWidth: 160,
              maxWidth: 230,
            }}
          >
            <div className="rounded-2xl bg-white px-3 py-2 shadow-lg border border-gray-100 text-sm text-gray-700 leading-snug"
              style={{ borderRadius: onLeftSide ? "1rem 1rem 1rem 0.25rem" : "1rem 1rem 0.25rem 1rem" }}>
              {comment}
            </div>
          </div>
        )}

        <div className="group/btn relative">
          <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-200 whitespace-nowrap rounded-lg bg-gray-900/90 px-2.5 py-1 text-xs font-medium text-white shadow-lg">
            GarasjeDrøsaren
          </span>

          {/* Dismiss X */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            aria-label="Skjul GarasjeDrøsaren"
            className="absolute -top-2 -right-2 z-10 hidden group-hover/btn:flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white hover:bg-red-500 transition-colors shadow"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Main button — drag + click handlers here */}
          <button
            onClick={handleBtnClick}
            onPointerDown={onBtnPointerDown}
            onPointerMove={onBtnPointerMove}
            onPointerUp={onBtnPointerUp}
            onPointerCancel={onBtnPointerCancel}
            aria-label="GarasjeDrøsaren"
            className="relative overflow-hidden rounded-2xl rounded-br-sm bg-orange-500 hover:bg-orange-600 shadow-lg transition-colors cursor-pointer"
            style={{ width: BTN_W, height: BTN_H, touchAction: "none" }}
          >
            {open ? (
              <div className="flex h-full w-full items-center justify-center">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : (
              <Image src="/GarajseDrøsaren.png" alt="GarajseDrøsaren" fill className="object-cover" />
            )}
          </button>
        </div>
      </div>

      {/* Chat panel */}
      {open && (
        <div style={{ position: "fixed", left: panelLeft, top: panelTop, zIndex: 50, width: panelW }} className="flex flex-col max-h-[80vh] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
          <div className="relative w-full h-64 shrink-0 bg-orange-50">
            <Image src="/GarajseDrøsaren.png" alt="GarajseDrøsaren" fill className="object-contain" />
            <button onClick={() => setOpen(false)} aria-label="Lukk chat" className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
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
                    {m.role === "assistant" && <div className="relative h-8 w-8 shrink-0 rounded-full overflow-hidden mt-1"><Image src="/GarajseDrøsaren.png" alt="" fill className="object-cover" /></div>}
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
                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey} placeholder={lang === "jaersk" ? "Skriv noko…" : "Skriv en melding…"} rows={2} className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-base focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400 max-h-36 overflow-y-auto" />
                <button onClick={send} disabled={loading || !input.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
