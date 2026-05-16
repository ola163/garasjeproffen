import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 – Siden finnes ikke | GarasjeProffen.no",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <h1>404 – Siden finnes ikke</h1>
      <p>Vi fant ikke siden du lette etter.</p>
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", marginTop: "16px" }}>
        <Link href="/garasje" style={{ background: "#e2520a", color: "#fff", padding: "10px 20px", borderRadius: "8px", textDecoration: "none", fontWeight: 600 }}>Design garasje</Link>
        <Link href="/">Gå til forsiden</Link>
      </div>
    </div>
  );
}
