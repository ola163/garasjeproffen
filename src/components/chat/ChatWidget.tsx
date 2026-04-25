"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────
type Lang = "bokmal" | "jaersk";
interface AiMessage { role: "user" | "assistant"; content: string; }
interface GpPayload {
  service?: "søknadshjelp" | "materialpakke" | "prefab";
  buildingType?: "garasje" | "carport" | "uthus";
  widthMm?: number;
  lengthMm?: number;
  roofType?: "saltak" | "flattak";
}

// ── Constants ─────────────────────────────────────────────────────────────────
const IDLE_COMMENTS = [
  "Trenger du hjelp med garasje?",
  "Har du sett konfiguratoren vår?",
  "Klikk på meg, eg veit alt om garasje!",
  "Me levere i heile Rogaland!",
  "Lurer du på noko om carport?",
  "Dæ æ møje garasjar å velge mellom!",
  "Spør meg, eg bite ikkje 🙂",
  "Du, ska eg komma bort og hjelpa deg i gang?",
  "Dette ska me få te, men du må begynna snart!",
  "Eg he trua på deg – men nå må du setta i gang 😄",
  "Du e ikkje redde for å bli sist ferdige vel?",
  "Dette går fort – me heise det på plass",
  "Du, den søknaden… den tar me",
  "Du sleppe alt det papirgreiene",
  "Du spare deg for jysla møje arbeid her",
  "Ikkje driv og dil – me fikse det",
];
const DRAG_COMMENTS = [
  "Au! Ikkje flytt meg!",
  "Hei, eg bur helst i ro du!",
  "Au au – forsiktig no!",
  "Klikk på meg heller, eg hjelper deg!",
  "No flytta du meg igjen...",
];
const DISMISS_COMMENTS = [
  "Me drøses! 👋",
  "Ha det bra! Eg e i menyen om du treng meg 🙂",
  "Me drøses – ring om du lurer på noko du!",
];
const WELCOME: Record<Lang, string> = {
  bokmal: "Hei! Jeg er GarasjeDrøsaren, assistenten til GarasjeProffen. Hva ønsker du å bygge – garasje, carport, eller noe annet?",
  jaersk: "Hei! Eg er GarasjeDrøsaren hjå GarasjeProffen. Kva vil du byggje – garasje, carport, eller noko anna?",
};

const BTN_W = 68;
const BTN_H = Math.round(BTN_W * (1183 / 1329));
const DRAG_THRESHOLD = 5;
const STORAGE_KEY = "gd-dismissed";
const PANEL_W_DESKTOP = 360;

function buildUrl(p: GpPayload): string {
  if (p.service === "søknadshjelp") {
    const q = new URLSearchParams();
    if (p.buildingType) q.set("buildingType", p.buildingType);
    return `/soknadshjelp?${q}`;
  }
  const route = p.buildingType === "carport" ? "/carport" : "/garasje";
  const q = new URLSearchParams({ package: p.service === "prefab" ? "prefab" : "materialpakke" });
  if (p.widthMm)  q.set("width",    String(p.widthMm));
  if (p.lengthMm) q.set("length",   String(p.lengthMm));
  if (p.roofType) q.set("roofType", p.roofType);
  return `${route}?${q}`;
}

function makeSessionId() { return crypto.randomUUID(); }

// ── Main component ────────────────────────────────────────────────────────────
export default function ChatWidget() {
  const [dismissed,  setDismissed]  = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [open,       setOpen]       = useState(false);
  const [animating,  setAnimating]  = useState(false);
  const [comment,    setComment]    = useState<string | null>(null);
  const [pos,        setPos]        = useState<{ left: number; top: number } | null>(null);

  const [lang,     setLang]     = useState<Lang>("jaersk");
  const [messages, setMessages] = useState<AiMessage[]>([{ role: "assistant", content: WELCOME.jaersk }]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [ctaData,  setCtaData]  = useState<GpPayload | null>(null);

  const pathname   = usePathname();
  const router     = useRouter();
  const sessionId  = useRef(makeSessionId());
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);
  const commentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleIdx      = useRef(0);
  const dragIdx      = useRef(0);
  const dismissIdx   = useRef(0);
  const openRef      = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);

  const dragStart    = useRef<{ mx: number; my: number; left: number; top: number } | null>(null);
  const didDrag      = useRef(false);
  const justDragged  = useRef(false);

  // Init position & listen for visibility events
  useEffect(() => {
    if (typeof window !== "undefined") {
      setPos({ left: window.innerWidth - BTN_W - 24, top: window.innerHeight - BTN_H - 24 });
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    }
    function onV() {
      const isDismissed = localStorage.getItem(STORAGE_KEY) === "1";
      setDismissed(isDismissed);
      setDismissing(false);
      setAnimating(false);
      if (!isDismissed) setPos({ left: window.innerWidth - BTN_W - 24, top: window.innerHeight - BTN_H - 24 });
    }
    function onOpen() {
      setDismissed(false); setDismissing(false); setAnimating(false);
      setPos({ left: window.innerWidth - BTN_W - 24, top: window.innerHeight - BTN_H - 24 });
      setOpen(true);
    }
    window.addEventListener("gd-visibility", onV);
    window.addEventListener("gd-open", onOpen);
    return () => { window.removeEventListener("gd-visibility", onV); window.removeEventListener("gd-open", onOpen); };
  }, []);

  // Slide to bottom-left on configurator pages (desktop)
  const CONFIGURATOR_PATHS = ["/configurator", "/garasje", "/carport"];
  const isConfigurator = CONFIGURATOR_PATHS.some((p) => pathname?.startsWith(p));
  useEffect(() => {
    if (!isConfigurator || window.innerWidth < 640) return;
    setAnimating(true);
    setPos({ left: 24, top: window.innerHeight - BTN_H - 24 });
    const t = setTimeout(() => setAnimating(false), 2000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigurator]);

  // Idle comments
  useEffect(() => {
    function scheduleNext(delay: number) {
      idleTimer.current = setTimeout(() => {
        if (!openRef.current) {
          setComment(IDLE_COMMENTS[idleIdx.current % IDLE_COMMENTS.length]);
          if (commentTimer.current) clearTimeout(commentTimer.current);
          commentTimer.current = setTimeout(() => setComment(null), 5000);
          idleIdx.current++;
        }
        scheduleNext(12000 + Math.random() * 18000);
      }, delay);
    }
    scheduleNext(8000);
    return () => { if (idleTimer.current) clearTimeout(idleTimer.current); };
  }, []);

  function showComment(text: string, ms = 4000) {
    if (commentTimer.current) clearTimeout(commentTimer.current);
    setComment(text);
    commentTimer.current = setTimeout(() => setComment(null), ms);
  }

  function dismiss() {
    setOpen(false);
    showComment(DISMISS_COMMENTS[dismissIdx.current % DISMISS_COMMENTS.length], 4000);
    dismissIdx.current++;
    setTimeout(() => {
      setDismissing(true); setAnimating(true);
      setPos((p) => p ? { left: p.left, top: -BTN_H - 20 } : p);
      setTimeout(() => {
        if (commentTimer.current) clearTimeout(commentTimer.current);
        setComment(null);
        localStorage.setItem(STORAGE_KEY, "1");
        setDismissed(true); setDismissing(false); setAnimating(false);
        window.dispatchEvent(new Event("gd-visibility"));
      }, 2500);
    }, 1000);
  }

  // Drag handlers
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
    dragStart.current = null; didDrag.current = false;
    if (wasDrag) {
      justDragged.current = true;
      showComment(DRAG_COMMENTS[dragIdx.current % DRAG_COMMENTS.length], 4000);
      dragIdx.current++;
    }
  }
  function onBtnPointerCancel() { dragStart.current = null; didDrag.current = false; }
  function handleBtnClick() {
    if (justDragged.current) { justDragged.current = false; return; }
    setComment(null);
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  function selectLang(l: Lang) {
    setLang(l);
    setMessages([{ role: "assistant", content: WELCOME[l] }]);
    setCtaData(null);
  }

  async function logConversation(msgs: AiMessage[]) {
    try {
      await fetch("/api/chat/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current, messages: msgs, lang }),
      });
    } catch { /* silent */ }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages: AiMessage[] = [...messages, { role: "user", content: text }];
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
        // Strip partial [[GP:...]] marker from live display
        const displayLive = full.replace(/\[\[GP:[\s\S]*$/, "").trim() || full;
        setMessages([...newMessages, { role: "assistant", content: displayLive }]);
      }
      // After stream: parse marker and set final display text
      const markerMatch = full.match(/\[\[GP:([\s\S]*?)\]\]/);
      let displayFinal = full;
      if (markerMatch) {
        try { setCtaData(JSON.parse(markerMatch[1])); } catch { /* ignore */ }
        displayFinal = full.replace(/\[\[GP:[\s\S]*?\]\]/, "").trim();
      }
      setMessages([...newMessages, { role: "assistant", content: displayFinal }]);
      await logConversation([...newMessages, { role: "assistant", content: displayFinal }]);
    } catch {
      const fallback = lang === "jaersk"
        ? "Oi, noko gjekk gale. Ring oss på +47 476 17 563!"
        : "Beklager, noe gikk galt. Ring oss på +47 476 17 563.";
      setMessages([...newMessages, { role: "assistant", content: fallback }]);
    } finally { setLoading(false); }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const isMobileScreen = typeof window !== "undefined" && window.innerWidth < 640;
  const hiddenOnPath = pathname?.startsWith("/admin") ||
    (isMobileScreen && (isConfigurator || pathname?.startsWith("/min-side")));

  if (dismissed || hiddenOnPath || !pos) return null;

  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const isMobile = ww < 640;
  const PANEL_W = isMobile ? ww : PANEL_W_DESKTOP;
  const PANEL_H_MAX = isMobile ? wh : Math.min(560, wh - 32);

  let panelLeft: number;
  if (isMobile) {
    panelLeft = 0;
  } else {
    const spaceLeft  = pos.left - 12 - 8;
    const spaceRight = ww - (pos.left + BTN_W + 12) - 8;
    if (spaceLeft >= PANEL_W) {
      panelLeft = pos.left - PANEL_W - 12;
    } else if (spaceRight >= PANEL_W) {
      panelLeft = pos.left + BTN_W + 12;
    } else {
      panelLeft = Math.max(8, Math.min(ww - PANEL_W - 8, pos.left - PANEL_W / 2));
    }
  }
  const panelTop  = isMobile ? 0 : Math.max(8, Math.min(pos.top, wh - PANEL_H_MAX - 8));
  const onLeftSide = pos.left < ww / 2;

  return (
    <>
      {/* Draggable button */}
      <div
        style={{
          position: "fixed", left: pos.left, top: pos.top, zIndex: 50, width: BTN_W,
          touchAction: "none",
          transition: (animating || dismissing) ? "left 1.6s ease-in-out, top 2.5s ease-out" : "none",
        }}
        className="select-none"
      >
        {/* Speech bubble */}
        {comment && !open && (
          <div className="absolute bottom-full mb-2 pointer-events-none animate-[fadeInUp_0.3s_ease_both]"
            style={{ [onLeftSide ? "left" : "right"]: 0, minWidth: 160, maxWidth: 230 }}>
            <div className="rounded-2xl bg-white px-3 py-2 shadow-lg border border-gray-100 text-sm text-gray-700 leading-snug"
              style={{ borderRadius: onLeftSide ? "1rem 1rem 1rem 0.25rem" : "1rem 1rem 0.25rem 1rem" }}>
              {comment}
            </div>
          </div>
        )}

        <div className="group/btn relative">
          <span className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover/btn:opacity-100 transition-opacity whitespace-nowrap rounded-lg bg-gray-900/90 px-2.5 py-1 text-xs font-medium text-white shadow-lg">
            GarasjeDrøsaren
          </span>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); dismiss(); }}
            aria-label="Skjul GarasjeDrøsaren"
            className="absolute -top-2 -right-2 z-10 hidden group-hover/btn:flex h-5 w-5 items-center justify-center rounded-full bg-gray-700 text-white hover:bg-red-500 transition-colors shadow">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button onClick={handleBtnClick} onPointerDown={onBtnPointerDown} onPointerMove={onBtnPointerMove}
            onPointerUp={onBtnPointerUp} onPointerCancel={onBtnPointerCancel}
            aria-label="GarasjeDrøsaren"
            className="relative overflow-hidden rounded-2xl rounded-br-sm bg-orange-500 hover:bg-orange-600 shadow-lg transition-colors cursor-pointer"
            style={{ width: BTN_W, height: BTN_H, touchAction: "none" }}>
            {open ? (
              <div className="flex h-full w-full items-center justify-center">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            ) : (
              <Image src="/GarajseDrøsaren.png" alt="GarasjeDrøsaren" fill className="object-cover" />
            )}
          </button>
        </div>
      </div>

      {/* Chat panel */}
      {open && (
        <div
          style={{ position: "fixed", left: panelLeft, top: panelTop, zIndex: 50, width: PANEL_W, maxHeight: PANEL_H_MAX }}
          className="flex flex-col rounded-none sm:rounded-2xl border-0 sm:border border-gray-200 bg-white shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-2 bg-orange-500 px-4 py-3 shrink-0">
            <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-orange-400">
              <Image src="/GarajseDrøsaren.png" alt="" fill className="object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">GarasjeDrøsaren</p>
              <p className="text-xs text-orange-100">GarasjeProffen-assistenten</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => selectLang("bokmal")}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${lang === "bokmal" ? "bg-white text-orange-600" : "text-white/70 hover:text-white"}`}>
                Bokmål
              </button>
              <button onClick={() => selectLang("jaersk")}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${lang === "jaersk" ? "bg-white text-orange-600" : "text-white/70 hover:text-white"}`}>
                Jærsk
              </button>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Lukk"
              className="ml-1 shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* AI disclaimer */}
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
            <p className="text-[11px] leading-snug text-amber-800">
              <span className="font-semibold">Kunstig intelligens.</span>{" "}
              Ikke skriv inn sensitive opplysninger. AI-svar er veiledende og må kontrolleres.
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="relative h-7 w-7 shrink-0 rounded-full overflow-hidden mt-1">
                    <Image src="/GarajseDrøsaren.png" alt="" fill className="object-cover" />
                  </div>
                )}
                <div className={`max-w-[85%] ${m.role === "user" ? "" : "flex flex-col gap-2"}`}>
                  <div className={`rounded-2xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-orange-500 text-white rounded-br-sm"
                      : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
                  }`}>
                    {m.content}
                    {loading && i === messages.length - 1 && m.role === "assistant" && m.content === "" && (
                      <span className="inline-flex gap-1 py-1">
                        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" />
                        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.15s]" />
                        <span className="h-2 w-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.3s]" />
                      </span>
                    )}
                  </div>
                  {/* CTA button — shown after the last assistant message that has a GP payload */}
                  {ctaData && !loading && i === messages.length - 1 && m.role === "assistant" && (
                    <button
                      onClick={() => { router.push(buildUrl(ctaData)); setOpen(false); }}
                      className="w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors shadow-sm"
                    >
                      {ctaData.service === "søknadshjelp" ? "Gå til søknadshjelp →" : "Åpne konfiguratoren →"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 bg-white p-3 flex gap-2 items-end shrink-0">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={lang === "jaersk" ? "Skriv noko…" : "Skriv en melding…"}
              rows={2}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400 max-h-32 overflow-y-auto"
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
