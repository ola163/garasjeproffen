"use client";

import { useState, FormEvent } from "react";

const BRAND = "#e2520a";

export default function InteressePage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value.trim(),
      email: (form.elements.namedItem("email") as HTMLInputElement).value.trim(),
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value.trim(),
      size: (form.elements.namedItem("size") as HTMLInputElement).value.trim(),
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value.trim(),
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Noe gikk galt. Prøv igjen.");
      }

      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.");
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero */}
      <div
        className="py-16 px-6 text-white text-center"
        style={{ backgroundColor: BRAND }}
      >
        <h1 className="text-3xl sm:text-4xl font-bold mb-3">
          Interessert i garasje fra GarasjeProffen?
        </h1>
        <p className="text-lg sm:text-xl opacity-90 max-w-xl mx-auto">
          Fyll ut skjemaet nedenfor, så tar vi kontakt med deg for en uforpliktende prat.
        </p>
      </div>

      {/* Form */}
      <div className="flex-1 flex items-start justify-center py-12 px-6">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-md p-8">
          {status === "success" ? (
            <div className="text-center py-8">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 text-white text-3xl"
                style={{ backgroundColor: BRAND }}
              >
                ✓
              </div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Takk! Vi tar kontakt snart.
              </h2>
              <p className="text-gray-500">
                Vi har mottatt din henvendelse og vil svare deg så fort som mulig.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-800 mb-1">
                Send inn interesse
              </h2>

              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Navn <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Ola Nordmann"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                  style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  E-post <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="ola@eksempel.no"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                  style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                />
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Telefon <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="98 76 54 32"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                  style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                />
              </div>

              {/* Size */}
              <div>
                <label
                  htmlFor="size"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Ønsket størrelse{" "}
                  <span className="text-gray-400 font-normal">(valgfritt)</span>
                </label>
                <input
                  id="size"
                  name="size"
                  type="text"
                  placeholder="f.eks. 6×6 m, dobbel garasje"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition"
                  style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                />
              </div>

              {/* Message */}
              <div>
                <label
                  htmlFor="message"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Melding{" "}
                  <span className="text-gray-400 font-normal">(valgfritt)</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  placeholder="Fortell oss gjerne mer om ditt behov..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent transition resize-none"
                  style={{ "--tw-ring-color": BRAND } as React.CSSProperties}
                />
              </div>

              {/* Error */}
              {status === "error" && (
                <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                  {errorMsg}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-3 px-6 rounded-lg font-semibold text-white transition-opacity disabled:opacity-60 cursor-pointer"
                style={{ backgroundColor: BRAND }}
              >
                {status === "loading" ? "Sender…" : "Send interesse"}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Vi deler aldri dine opplysninger med tredjeparter.
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Footer strip */}
      <footer className="py-6 text-center text-gray-400 text-sm">
        © {new Date().getFullYear()} GarasjeProffen.no
      </footer>
    </div>
  );
}
