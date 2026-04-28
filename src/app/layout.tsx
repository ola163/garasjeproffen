import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import ChatWidget from "@/components/chat/ChatWidget";
import DevPanel from "@/components/dev/DevPanel";
import VisitorTracker from "@/components/VisitorTracker";
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
  description: "GarasjeProffen leverer skreddersydde garasjer, carporter, materialpakker og prefabrikkerte løsninger. Vi hjelper også med byggesøknad.",
  metadataBase: new URL("https://www.garasjeproffen.no"),
  alternates: { canonical: "https://www.garasjeproffen.no" },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    other: [
      { rel: "manifest", url: "/site.webmanifest" },
    ],
  },
  openGraph: {
    title: "Garasje og carport på Jæren | GarasjeProffen AS",
    description: "GarasjeProffen leverer skreddersydde garasjer, carporter, materialpakker og prefabrikkerte løsninger. Vi hjelper også med byggesøknad.",
    url: "https://www.garasjeproffen.no",
    siteName: "GarasjeProffen AS",
    images: [{ url: "/logo.jpg", width: 600, height: 600, alt: "GarasjeProffen AS" }],
    locale: "nb_NO",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Garasje og carport på Jæren | GarasjeProffen AS",
    description: "GarasjeProffen leverer skreddersydde garasjer, carporter, materialpakker og prefabrikkerte løsninger. Vi hjelper også med byggesøknad.",
    images: ["/logo.jpg"],
  },
  other: {
    "geo.region": "NO-11",
    "geo.placename": "Bryne, Rogaland",
    "geo.position": "58.7298;5.4964",
    "ICBM": "58.7298, 5.4964",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = [
    {
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
      hasOfferCatalog: {
        "@type": "OfferCatalog",
        name: "Garasje- og carporttjenester",
        itemListElement: [
          { "@type": "Offer", itemOffered: { "@type": "Service", name: "Prefabrikkert garasje" } },
          { "@type": "Offer", itemOffered: { "@type": "Service", name: "Materialpakke garasje" } },
          { "@type": "Offer", itemOffered: { "@type": "Service", name: "Carport" } },
          { "@type": "Offer", itemOffered: { "@type": "Service", name: "Søknadshjelp" } },
        ],
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "GarasjeProffen AS",
      url: "https://www.garasjeproffen.no",
      description: "Design din egen garasje eller carport med GarasjeProffen AS. Materialpakker, prefabrikkerte løsninger og søknadshjelp på Jæren og i Rogaland.",
      inLanguage: "nb-NO",
      publisher: {
        "@type": "Organization",
        name: "GarasjeProffen AS",
        url: "https://www.garasjeproffen.no",
        logo: {
          "@type": "ImageObject",
          url: "https://www.garasjeproffen.no/logo.jpg",
        },
      },
    },
  ];

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
        <DevPanel />
        <VisitorTracker />
      </body>
    </html>
  );
}
