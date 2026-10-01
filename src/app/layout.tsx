import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { SiteFooter, SiteNav } from "@/components/SiteChrome";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Absolute URLs for the link-preview image. Same fallback as the home page QR
// code; a malformed NEXT_PUBLIC_SITE_URL (say, missing https://) must not break the build.
const FALLBACK_URL = "https://dwb-theta.vercel.app";
function siteUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || FALLBACK_URL);
  } catch {
    return new URL(FALLBACK_URL);
  }
}

// The icons are files in this folder (icon.svg, favicon.ico, apple-icon.png);
// Next adds their tags. The link-preview image is public/og-image.png.
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "Dinner with the Bishop", template: "%s · Dinner with the Bishop" },
  description: "Live brackets and results for the Dinner with the Bishop chess tournament.",
  applicationName: "Dinner with the Bishop",
  appleWebApp: { title: "DwB" },
  openGraph: {
    type: "website",
    siteName: "Dinner with the Bishop",
    title: "Dinner with the Bishop",
    description: "Live brackets and results, on your phone.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Dinner with the Bishop: live brackets and results, on your phone",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[var(--background)] font-sans text-[var(--foreground)] antialiased">
        <div className="flex min-h-screen flex-col">
          <SiteNav />
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
