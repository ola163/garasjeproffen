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
  title: "GarasjeProffen.no - Design din egen garasje",
  description: "Bruk vår 3D-konfigurator til å designe din drømmegarasje og få et pristilbud med en gang.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", type: "image/png" },
  },
  openGraph: {
    title: "GarasjeProffen.no - Design din egen garasje",
    description: "Bruk vår 3D-konfigurator til å designe din drømmegarasje og få et pristilbud med en gang.",
    url: "https://www.garasjeproffen.no",
    siteName: "GarasjeProffen.no",
    images: [
      {
        url: "/logo.jpg",
        width: 600,
        height: 600,
        alt: "GarasjeProffen.no",
      },
    ],
    locale: "nb_NO",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "GarasjeProffen.no - Design din egen garasje",
    description: "Bruk vår 3D-konfigurator til å designe din drømmegarasje og få et pristilbud med en gang.",
    images: ["/logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no">
      <body className={`${geistSans.variable} antialiased`}>
        <Header />
        <main>{children}</main>
        <Footer />
        <ChatWidget />
      </body>
    </html>
  );
}
