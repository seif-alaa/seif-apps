import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "NIVORÉ Timepieces — Defined by Detail.", template: "%s — NIVORÉ" },
  description: "An independent watch atelier in Egypt. Compose your own automatic watch, part by part, or choose a finished NIVORÉ build.",
  openGraph: { siteName: "NIVORÉ Timepieces", type: "website" },
};

export const viewport: Viewport = {
  themeColor: "#e8e2d6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" className={`${inter.variable} ${newsreader.variable}`}>
      <body className="min-h-dvh bg-ivory text-espresso antialiased">{children}</body>
    </html>
  );
}
