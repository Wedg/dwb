"use client";

import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [siteUrl, setSiteUrl] = useState("https://dwb-theta.vercel.app"); // fallback
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Prefer the live origin when client-side
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (typeof window !== "undefined") {
      setSiteUrl(envUrl || window.location.origin);
    } else if (envUrl) {
      setSiteUrl(envUrl);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setIsDarkMode(event.matches);
    };

    setIsDarkMode(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col gap-12 px-6 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--surface-glow),_transparent_60%)]"
      />

      <section className="flex flex-col items-center gap-4 text-center sm:gap-6">
        <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--highlight)] px-4 py-1 text-sm font-medium tracking-wide text-[color:var(--accent)] shadow-sm">
          Dinner with the Bishop
        </span>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          Tournament Hub
        </h1>
        <p className="max-w-2xl text-balance text-lg text-[color:var(--muted)]">
          Welcome! Follow live brackets, browse match results, or manage player
          logistics if you are the tournament director.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/brackets"
          className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
        >
          <h2 className="text-xl font-semibold text-[color:var(--foreground)]">
            Brackets (public)
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            View live brackets for Main, Lower, and Doubles events.
          </p>
          <span className="mt-4 inline-flex items-center justify-center text-sm font-medium text-[color:var(--accent)]">
            Explore brackets
            <span aria-hidden className="ml-2 transition-transform group-hover:translate-x-1">
              →
            </span>
          </span>
        </Link>

        <Link
          href="/matches"
          className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
        >
          <h2 className="text-xl font-semibold text-[color:var(--foreground)]">
            Matches (public)
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Browse all matches, final scores, and tables in one view.
          </p>
          <span className="mt-4 inline-flex items-center justify-center text-sm font-medium text-[color:var(--accent)]">
            Dive into results
            <span aria-hidden className="ml-2 transition-transform group-hover:translate-x-1">
              →
            </span>
          </span>
        </Link>

        <Link
          href="/players"
          className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
        >
          <h2 className="text-xl font-semibold text-[color:var(--foreground)]">
            Players (admin)
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Manage the player list, seeding details, and quick updates.
          </p>
          <span className="mt-4 inline-flex items-center justify-center text-sm font-medium text-[color:var(--accent)]">
            Open roster tools
            <span aria-hidden className="ml-2 transition-transform group-hover:translate-x-1">
              →
            </span>
          </span>
        </Link>

        <Link
          href="/control"
          className="group rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[color:var(--accent)] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
        >
          <h2 className="text-xl font-semibold text-[color:var(--foreground)]">
            TD Control (admin)
          </h2>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Run brackets, post results, and reset rounds with a PIN.
          </p>
          <span className="mt-4 inline-flex items-center justify-center text-sm font-medium text-[color:var(--accent)]">
            Launch control desk
            <span aria-hidden className="ml-2 transition-transform group-hover:translate-x-1">
              →
            </span>
          </span>
        </Link>
      </section>

      <section className="flex flex-col items-center gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--accent)]">
          Share the hub
        </p>
        <p className="max-w-lg text-sm text-[color:var(--muted)]">
          Post the code at the venue or share with players to give everyone the
          live tournament dashboard.
        </p>
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--highlight)] p-4 shadow-inner">
          <QRCodeCanvas
            value={siteUrl}
            size={168}
            bgColor={isDarkMode ? "#111214" : "#ffffff"}
            fgColor={isDarkMode ? "#f4f4f5" : "#1f2937"}
            includeMargin
          />
        </div>
        <p className="font-mono text-sm text-[color:var(--muted)]">{siteUrl}</p>
      </section>
    </main>
  );
}
