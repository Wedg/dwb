import Link from "next/link";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'Dinner with the Bishop',
  description: 'Tournament hub',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.className} bg-[var(--background)] text-[var(--foreground)] antialiased`}
      >
        <div className="flex min-h-screen flex-col">
          <header className="border-b border-[color:var(--border)] bg-[color:var(--background)]/90 backdrop-blur">
            <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 text-sm font-medium sm:px-6 lg:px-8">
              <Link
                href="/"
                className="rounded-full border border-transparent px-3 py-1 text-[color:var(--foreground)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
              >
                DwB Home
              </Link>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Link
                  href="/control"
                  className="rounded-full px-3 py-1 text-[color:var(--muted)] transition hover:bg-[color:var(--highlight)] hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
                >
                  TD Control
                </Link>
                <Link
                  href="/players"
                  className="rounded-full px-3 py-1 text-[color:var(--muted)] transition hover:bg-[color:var(--highlight)] hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
                >
                  Players
                </Link>
                <Link
                  href="/matches"
                  className="rounded-full px-3 py-1 text-[color:var(--muted)] transition hover:bg-[color:var(--highlight)] hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
                >
                  Matches
                </Link>
                <Link
                  href="/brackets"
                  className="rounded-full px-3 py-1 text-[color:var(--muted)] transition hover:bg-[color:var(--highlight)] hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
                >
                  Brackets
                </Link>
              </div>
            </nav>
          </header>
          <div className="flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}

// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en">
//       <body
//         className={`${geistSans.variable} ${geistMono.variable} antialiased`}
//       >
//         {children}
//       </body>
//     </html>
//   );
// }
