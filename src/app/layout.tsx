import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ChatWidget from "@/components/chat/ChatWidget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Garasje og carport på Jæren | GarasjeProffen AS",
    template: "%s | GarasjeProffen AS",
  },
  description: "Design din egen garasje eller carport med GarasjeProffen AS. Vi leverer materialpakker, prefabrikkerte løsninger og hjelp med byggesøknad – fra Bryne til hele Norge.",
  metadataBase: new URL("https://www.garasjeproffen.no"),
  alternates: { canonical: "https://www.garasjeproffen.no" },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", type: "image/png" },
  },
  openGraph: {
    title: "Garasje og carport på Jæren | GarasjeProffen AS",
    description: "Design din egen garasje eller carport med GarasjeProffen AS. Vi leverer materialpakker, prefabrikkerte løsninger og hjelp med byggesøknad – fra Bryne til hele Norge.",
    url: "https://www.garasjeproffen.no",
    siteName: "GarasjeProffen AS",
    images: [{ url: "/logo.jpg", width: 600, height: 600, alt: "GarasjeProffen AS" }],
    locale: "nb_NO",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Garasje og carport på Jæren | GarasjeProffen AS",
    description: "Design din egen garasje eller carport med GarasjeProffen AS. Materialpakke, prefab og byggesøknad.",
    images: ["/logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    name: "GarasjeProffen AS",
    url: "https://www.garasjeproffen.no",
    email: "post@garasjeproffen.no",
    telephone: "+4747617563",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Tjødnavegen 8b",
      postalCode: "4342",
      addressLocality: "Bryne",
      addressCountry: "NO",
    },
    areaServed: ["Bryne", "Jæren", "Sandnes", "Stavanger", "Rogaland", "Norge"],
    description: "GarasjeProffen AS leverer garasjer, carporter, materialpakker, prefabrikkerte løsninger og hjelp med byggesøknad på Jæren og i Rogaland.",
    priceRange: "$$",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "08:00",
      closes: "16:00",
    },
  };

  return (
    <html lang="nb-NO">
      <body className={`${geistSans.variable} antialiased`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Header />
        <main>{children}</main>
        <Footer />
        <ChatWidget />
      </body>
    </html>
  );
}
