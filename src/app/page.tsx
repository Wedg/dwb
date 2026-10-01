"use client";

import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFollowedPlayer, useTournament } from "@/lib/useTournament";
import { BRACKET_ORDER, BRACKET_TITLES, buildView, champion, teamName } from "@/lib/tournament";
import { FollowPlayer } from "@/components/FollowPlayer";
import { BishopIcon, TrophyIcon } from "@/components/icons";

const STEPS = [
  { title: BRACKET_TITLES.MAIN, text: "Everyone starts here: a 16-player knockout." },
  { title: BRACKET_TITLES.LOWER, text: "Lose in Round 1 and you get a second chance here." },
  {
    title: BRACKET_TITLES.DOUBLES,
    text: "Lose a quarterfinal in either bracket and you play doubles, with a partner drawn at random.",
  },
];

export default function HomePage() {
  const [siteUrl, setSiteUrl] = useState("https://dwb-theta.vercel.app"); // fallback
  const { event, players, matches, loading } = useTournament();
  const [followed, follow] = useFollowedPlayer(players);

  useEffect(() => {
    // Prefer the live origin when client-side
    setSiteUrl(process.env.NEXT_PUBLIC_SITE_URL || window.location.origin);
  }, []);

  const nameById = useMemo(() => new Map(players.map((player) => [player.id, player.name])), [players]);
  const nameOf = useCallback((id: string) => nameById.get(id) ?? "Unknown player", [nameById]);
  const view = useMemo(() => {
    const seeds = new Map(players.map((player) => [player.id, player.seed]));
    return buildView(matches, (id) => seeds.get(id));
  }, [matches, players]);
  const champions = BRACKET_ORDER.flatMap((bracket) => {
    const result = champion(bracket, matches);
    return result ? [{ bracket, winner: teamName(result.winner, nameOf) }] : [];
  });

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col gap-8 px-4 py-12 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--surface-glow),_transparent_60%)]"
      />

      <section className="flex flex-col items-center gap-4 text-center sm:gap-5">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] shadow-md">
          <BishopIcon className="h-11 w-11" />
        </span>
        <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--highlight)] px-4 py-1 text-sm font-medium tracking-wide text-[color:var(--accent)] shadow-sm">
          Dinner with the Bishop
        </span>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          {loading ? " " : (event?.name ?? "Tournament Hub")}
        </h1>
        <p className="max-w-xl text-balance text-lg text-[color:var(--muted)]">
          Live brackets and results, on your phone.
        </p>
        <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link
            href="/brackets"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[color:var(--accent)] px-6 text-base font-semibold text-[color:var(--accent-contrast)] shadow transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
          >
            See the brackets <span aria-hidden>→</span>
          </Link>
          <Link
            href="/matches"
            className="inline-flex h-12 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-6 text-base font-semibold text-[color:var(--foreground)] transition hover:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
          >
            All matches
          </Link>
        </div>
      </section>

      <FollowPlayer
        players={players}
        matches={matches}
        view={view}
        nameOf={nameOf}
        followed={followed}
        onFollow={follow}
      />

      {champions.length > 0 && (
        <section className="rounded-3xl border border-[color:var(--accent)] bg-[color:var(--card)] p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <TrophyIcon /> Champions
          </h2>
          <ul className="mt-4 divide-y divide-[color:var(--border)]">
            {champions.map((c) => (
              <li key={c.bracket} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {BRACKET_TITLES[c.bracket]}
                </span>
                <span className="break-words text-base font-semibold text-[color:var(--foreground)]">{c.winner}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold">How the evening works</h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-sm font-semibold text-[color:var(--accent-contrast)]">
                {i + 1}
              </span>
              <p className="text-sm text-[color:var(--muted)]">
                <strong className="font-semibold text-[color:var(--foreground)]">{step.title}.</strong> {step.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col items-center gap-4 rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--accent)]">Share the hub</p>
        <p className="max-w-lg text-sm text-[color:var(--muted)]">
          Show this code at the venue, or share the link in the club chat.
        </p>
        {/* Always dark on light: easiest for phone cameras to read, and it prints cleanly. */}
        <div className="rounded-xl border border-[color:var(--border)] bg-white p-3 shadow-inner">
          <QRCodeCanvas value={siteUrl} size={168} bgColor="#ffffff" fgColor="#111111" includeMargin />
        </div>
        <p className="font-mono text-sm text-[color:var(--muted)]">{siteUrl}</p>
      </section>
    </main>
  );
}
