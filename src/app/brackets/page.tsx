"use client";

import { useCallback, useMemo, useState } from "react";
import type { Bracket, Stage } from "@/lib/bracket";
import { useFollowedPlayer, useTournament } from "@/lib/useTournament";
import {
  BRACKET_BLURB,
  BRACKET_ORDER,
  BRACKET_SHORT,
  BRACKET_TITLES,
  STAGE_LABEL,
  STAGE_ORDER,
  STAGE_SINGULAR,
  buildView,
  champion,
  currentRound,
  matchState,
  sideViews,
  teamName,
  type ViewMatch,
} from "@/lib/tournament";
import { BRACKET_THEMES } from "@/components/bracketTheme";
import { ChampionBanner } from "@/components/ChampionBanner";
import { FollowPlayer } from "@/components/FollowPlayer";
import { LastUpdated } from "@/components/LastUpdated";
import { MatchCard } from "@/components/MatchCard";
import { TrophyIcon } from "@/components/icons";

/** Round buttons on phones; short enough for all four to fit on one line. */
const ROUND_BUTTON: Record<Stage, string> = { R1: "Round 1", QF: "Quarters", SF: "Semis", F: "Final" };

const NOT_DRAWN: Record<Bracket, string> = {
  MAIN: "The draw hasn't been made yet. Check back soon.",
  LOWER: "The Pudel König fills up as Round 1 is played.",
  DOUBLES: "The doubles are drawn once all eight quarterfinals are finished.",
};

export default function BracketsPage() {
  const { event, players, matches, loading, error, stale, updatedAt, refresh } = useTournament();
  const [followed, follow] = useFollowedPlayer(players);
  const [tab, setTab] = useState<Bracket>("MAIN");
  // Rounds picked by hand on a phone. Until then, show the round being played.
  const [picked, setPicked] = useState<Partial<Record<Bracket, Stage>>>({});

  const nameById = useMemo(() => new Map(players.map((player) => [player.id, player.name])), [players]);
  const nameOf = useCallback((id: string) => nameById.get(id) ?? "Unknown player", [nameById]);
  const view = useMemo(() => {
    const seeds = new Map(players.map((player) => [player.id, player.seed]));
    return buildView(matches, (id) => seeds.get(id));
  }, [matches, players]);

  const rounds = STAGE_ORDER.map((stage) => ({
    stage,
    matches: view.ordered.filter((match) => match.bracket === tab && match.stage === stage),
  })).filter((r) => r.matches.length > 0);
  const pickedRound = picked[tab];
  const round =
    pickedRound && rounds.some((r) => r.stage === pickedRound)
      ? pickedRound
      : (currentRound(tab, matches) ?? rounds[0]?.stage);
  const champ = champion(tab, matches);
  const theme = BRACKET_THEMES[tab];

  const heading = (m: ViewMatch) =>
    m.stage === "F" ? "Final" : `${m.stage === "R1" ? "Match" : STAGE_SINGULAR[m.stage]} ${view.number.get(m.id)}`;
  const card = (m: ViewMatch) => (
    <MatchCard
      key={m.id}
      sides={sideViews(m, view, nameOf, followed)}
      ready={matchState(m) === "ready"}
      heading={heading(m)}
    />
  );

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--surface-glow),_transparent_65%)]"
      />

      <header className="flex flex-col gap-3 text-center sm:gap-4">
        {event?.name && (
          <span className="self-center rounded-full border border-[color:var(--border)] bg-[color:var(--highlight)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
            {event.name}
          </span>
        )}
        <h1 className="text-balance text-3xl font-semibold sm:text-4xl">Brackets</h1>
        <p className="text-pretty text-sm text-[color:var(--muted)] sm:text-base">
          Follow every round as it&apos;s played.
        </p>
        <LastUpdated updatedAt={updatedAt} stale={stale} onRefresh={refresh} />
      </header>

      {loading && (
        <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center text-sm text-[color:var(--muted)] shadow-sm sm:p-8">
          Loading the brackets…
        </section>
      )}

      {!loading && error && (
        <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center text-sm text-[color:var(--muted)] shadow-sm sm:p-8">
          {error}
        </section>
      )}

      {!loading && !error && (
        <>
          <FollowPlayer
            players={players}
            matches={matches}
            view={view}
            nameOf={nameOf}
            followed={followed}
            onFollow={follow}
          />

          <nav aria-label="Trophies" className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
            {BRACKET_ORDER.map((bracket) => (
              <button
                key={bracket}
                type="button"
                onClick={() => setTab(bracket)}
                aria-pressed={tab === bracket}
                className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-2 text-sm font-semibold transition sm:px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] ${
                  tab === bracket
                    ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-contrast)] shadow"
                    : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:border-[color:var(--accent)]"
                }`}
              >
                {/* Finished trophies get a cup; phones skip it to keep the tabs on one line. */}
                {champion(bracket, matches) && <TrophyIcon className="hidden h-4 w-4 shrink-0 sm:block" />}
                <span>{BRACKET_SHORT[bracket]}</span>
              </button>
            ))}
          </nav>

          <section
            style={{
              borderColor: theme.border,
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 18px 38px -24px " + theme.glow,
            }}
            className="rounded-3xl border bg-[color:var(--card)]"
          >
            <header
              style={{ background: theme.header }}
              className="rounded-t-3xl border-b border-[color:var(--border)] px-5 py-5 sm:px-6"
            >
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">{BRACKET_TITLES[tab]}</h2>
              <p className="text-sm text-[color:var(--muted)]">{BRACKET_BLURB[tab]}</p>
            </header>

            <div className="flex flex-col gap-5 p-4 sm:p-6">
              {champ && (
                <ChampionBanner
                  winner={teamName(champ.winner, nameOf)}
                  runnerUp={teamName(champ.runnerUp, nameOf)}
                  pair={tab === "DOUBLES"}
                />
              )}

              {rounds.length === 0 ? (
                <p className="py-6 text-center text-sm text-[color:var(--muted)]">{NOT_DRAWN[tab]}</p>
              ) : (
                <>
                  {/* Phones: one round at a time. */}
                  <div className="md:hidden">
                    <div role="tablist" aria-label="Rounds" className="flex gap-1.5 overflow-x-auto pb-1">
                      {rounds.map((r) => (
                        <button
                          key={r.stage}
                          type="button"
                          role="tab"
                          aria-selected={r.stage === round}
                          onClick={() => setPicked((prev) => ({ ...prev, [tab]: r.stage }))}
                          className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] ${
                            r.stage === round
                              ? "border-[color:var(--accent)] bg-[color:var(--highlight)] text-[color:var(--foreground)]"
                              : "border-[color:var(--border)] text-[color:var(--muted)]"
                          }`}
                        >
                          {ROUND_BUTTON[r.stage]}
                        </button>
                      ))}
                    </div>
                    <div className="mt-4 space-y-3">
                      {rounds.find((r) => r.stage === round)?.matches.map(card)}
                    </div>
                  </div>

                  {/* Wider screens: the whole tree, each match level with the two feeding it. */}
                  <div className="hidden overflow-x-auto md:block">
                    <div className="grid grid-flow-col auto-cols-[minmax(200px,1fr)] gap-5">
                      {rounds.map((column) => (
                        <div key={column.stage} className="flex flex-col gap-3">
                          <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--muted)]">
                            {STAGE_LABEL[column.stage]}
                          </h3>
                          <div className="flex flex-1 flex-col justify-around gap-3">{column.matches.map(card)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
