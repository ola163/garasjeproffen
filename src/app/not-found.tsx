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
      <Link href="/">Gå til forsiden</Link>
    </div>
  );
}
