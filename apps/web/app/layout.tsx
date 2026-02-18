import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Orbyt — Your Family's AI Butler",
    template: "%s | Orbyt",
  },
  description:
    "Everything your family needs, in one place. The all-in-one family management platform for modern households.",
  keywords: ["family management", "household", "calendar", "tasks", "finances", "family CRM"],
  authors: [{ name: "Orbyt" }],
  creator: "Orbyt",
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Orbyt — Your Family's AI Butler",
    description: "Everything your family needs, in one place.",
    siteName: "Orbyt",
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1929",
  width: "device-width",
  initialScale: 1,
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} font-body`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
