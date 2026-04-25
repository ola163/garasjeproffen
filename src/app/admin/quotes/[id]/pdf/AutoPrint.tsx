"use client";
import { useEffect } from "react";

export default function AutoPrint({ backHref }: { backHref: string }) {
  useEffect(() => { window.print(); }, []);
  return (
    <div className="no-print" style={{ marginBottom: 20 }}>
      <button
        onClick={() => window.print()}
        style={{ background: "#e2520a", color: "white", border: "none", borderRadius: 6, padding: "9px 20px", fontSize: 13, cursor: "pointer", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8 }}
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
        </svg>
        Skriv ut / Last ned PDF
      </button>
      <a href={backHref} style={{ marginLeft: 16, fontSize: 12, color: "#888", textDecoration: "underline" }}>
        ← Tilbake til tilbud
      </a>
    </div>
  );
}
