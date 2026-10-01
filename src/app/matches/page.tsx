"use client";

import { useCallback, useMemo, useState } from "react";
import type { Bracket, Side } from "@/lib/bracket";
import { adminFetch, ensurePin, useAdminMode } from "@/lib/adminClient";
import { useFollowedPlayer, useTournament } from "@/lib/useTournament";
import {
  BRACKET_ORDER,
  BRACKET_TITLES,
  STAGE_LABEL,
  STAGE_ORDER,
  STAGE_SINGULAR,
  buildView,
  matchState,
  sideTeam,
  sideViews,
  teamName,
  type ViewMatch,
} from "@/lib/tournament";
import { BRACKET_THEMES } from "@/components/bracketTheme";
import { LastUpdated } from "@/components/LastUpdated";
import { MatchCard } from "@/components/MatchCard";
import { Toast, type ToastMessage } from "@/components/Toast";

export default function MatchesPage() {
  const { event, players, matches, loading, error, stale, updatedAt, refresh } = useTournament();
  const { isAdmin } = useAdminMode();
  const [followed] = useFollowedPlayer(players);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ToastMessage | null>(null);
  const [collapsed, setCollapsed] = useState<Record<Bracket, boolean>>({
    MAIN: false,
    LOWER: false,
    DOUBLES: false,
  });

  const nameById = useMemo(() => new Map(players.map((player) => [player.id, player.name])), [players]);
  const nameOf = useCallback((id: string) => nameById.get(id) ?? "Unknown player", [nameById]);
  const view = useMemo(() => {
    const seeds = new Map(players.map((player) => [player.id, player.seed]));
    return buildView(matches, (id) => seeds.get(id));
  }, [matches, players]);

  async function run(action: () => Promise<string>) {
    if (busy || !ensurePin()) return;
    setBusy(true);
    try {
      setMsg({ text: await action() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed";
      setMsg({ text: `Error: ${message}`, error: true });
    } finally {
      await refresh();
      setBusy(false);
    }
  }

  function pickWinner(match: ViewMatch, side: Side) {
    const name = teamName(sideTeam(match, side), nameOf);
    const other = teamName(sideTeam(match, side === "A" ? "B" : "A"), nameOf);
    const question = match.winner ? `Change the result: ${name} beat ${other}?` : `${name} beat ${other}?`;
    if (!confirm(question)) return;
    void run(async () => {
      await adminFetch("/api/admin/set-winner", { matchId: match.id, winner: side });
      return `${name} wins.`;
    });
  }

  function clearResult(match: ViewMatch) {
    const label = `${teamName(match.team_a, nameOf)} v ${teamName(match.team_b, nameOf)}`;
    if (!confirm(`Clear the result of ${label}?`)) return;
    void run(async () => {
      await adminFetch("/api/admin/clear-result", { matchId: match.id });
      return `Cleared ${label}.`;
    });
  }

  const heading = (m: ViewMatch) =>
    m.stage === "F" ? "Final" : `${m.stage === "R1" ? "Match" : STAGE_SINGULAR[m.stage]} ${view.number.get(m.id)}`;

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
        <h1 className="text-balance text-3xl font-semibold sm:text-4xl">Matches</h1>
        <p className="text-pretty text-sm text-[color:var(--muted)] sm:text-base">
          {isAdmin
            ? "TD mode: tap the winner's name to record a result. Players move on automatically."
            : "Every match, round by round."}
        </p>
        <LastUpdated updatedAt={updatedAt} stale={stale} onRefresh={refresh} />
      </header>

      {loading && (
        <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center text-sm text-[color:var(--muted)] shadow-sm sm:p-8">
          Loading the matches…
        </section>
      )}

      {!loading && error && (
        <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center text-sm text-[color:var(--muted)] shadow-sm sm:p-8">
          {error}
        </section>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-8">
          {BRACKET_ORDER.map((bracket) => {
            const rounds = STAGE_ORDER.map((stage) => ({
              stage,
              matches: view.ordered.filter((m) => m.bracket === bracket && m.stage === stage),
            })).filter((r) => r.matches.length > 0);
            const theme = BRACKET_THEMES[bracket];
            const isCollapsed = collapsed[bracket];

            return (
              <section
                key={bracket}
                style={{
                  borderColor: theme.border,
                  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 18px 38px -24px " + theme.glow,
                }}
                className="rounded-3xl border bg-[color:var(--card)]"
              >
                <header
                  style={{ background: theme.header }}
                  className="flex items-center justify-between gap-3 rounded-t-3xl border-b border-[color:var(--border)] px-5 py-4 sm:px-6"
                >
                  <h2 className="text-lg font-semibold text-[color:var(--foreground)]">{BRACKET_TITLES[bracket]}</h2>
                  <button
                    type="button"
                    onClick={() => setCollapsed((prev) => ({ ...prev, [bracket]: !prev[bracket] }))}
                    aria-expanded={!isCollapsed}
                    className="shrink-0 rounded-full bg-[color:var(--background)]/60 px-3 py-1 text-xs font-semibold text-[color:var(--muted)] transition hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
                  >
                    {isCollapsed ? "Show" : "Hide"}
                  </button>
                </header>

                {isCollapsed ? null : rounds.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-[color:var(--muted)]">No matches yet.</p>
                ) : (
                  <div className="flex flex-col gap-6 p-4 sm:p-6">
                    {rounds.map(({ stage, matches: inRound }) => (
                      <div key={stage} className="space-y-3">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--muted)]">
                          {STAGE_LABEL[stage]}
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {inRound.map((match) => (
                            <MatchCard
                              key={match.id}
                              sides={sideViews(match, view, nameOf, followed)}
                              ready={matchState(match) === "ready"}
                              heading={heading(match)}
                              onPick={isAdmin ? (side) => pickWinner(match, side) : undefined}
                              busy={busy}
                              footer={
                                isAdmin && match.winner ? (
                                  <div className="mt-2 flex items-center justify-between gap-3 px-1.5">
                                    <span className="text-xs text-[color:var(--muted)]">Tap the other name to change it.</span>
                                    <button
                                      type="button"
                                      onClick={() => clearResult(match)}
                                      disabled={busy}
                                      className="shrink-0 rounded-lg border border-red-500 px-2.5 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60"
                                    >
                                      Clear result
                                    </button>
                                  </div>
                                ) : null
                              }
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <Toast msg={msg} onClose={setMsg} />
    </main>
  );
}
