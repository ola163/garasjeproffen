"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

interface KlarnaOrder {
  order_id: string;
  status: string;
  html_snippet: string;
  merchant_reference1?: string; // ticket_number
  order_amount: number;
}

export default function BetalingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<KlarnaOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const snippetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/klarna/order?id=${orderId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); }
        else { setOrder(data); }
      })
      .catch(() => setError("Kunne ikke laste betalingssiden."))
      .finally(() => setLoading(false));
  }, [orderId]);

  // Re-execute scripts in Klarna HTML snippet
  useEffect(() => {
    if (!snippetRef.current || !order?.html_snippet) return;
    snippetRef.current.innerHTML = order.html_snippet;
    const scripts = snippetRef.current.querySelectorAll("script");
    scripts.forEach((s) => {
      const newScript = document.createElement("script");
      if (s.src) newScript.src = s.src;
      else newScript.text = s.text;
      s.parentNode?.replaceChild(newScript, s);
    });
  }, [order]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-400">Laster betaling…</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Noe gikk galt</h1>
          <p className="mt-2 text-gray-500">{error || "Betalingslenken er ikke gyldig."}</p>
          <a href="/" className="mt-4 inline-block text-orange-500 hover:underline">Tilbake til forsiden</a>
        </div>
      </div>
    );
  }

  if (order.status === "checkout_complete") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Betaling gjennomført!</h1>
          <p className="mt-2 text-gray-500">Takk for din ordre. Vi tar kontakt snart.</p>
          <a href="/" className="mt-6 inline-block text-orange-500 hover:underline">Tilbake til forsiden</a>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="mb-6 text-center">
          <img src="/logo-header.jpg" alt="GarasjeProffen" className="mx-auto h-12 w-auto" />
          {order.merchant_reference1 && (
            <p className="mt-2 text-sm text-gray-500">Tilbud {order.merchant_reference1}</p>
          )}
        </div>
        <div ref={snippetRef} />
      </div>
    </main>
  );
}
