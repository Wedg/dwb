"use client";

import { useEffect, useMemo, useState } from "react";
import { adminFetch, ensurePin } from "@/lib/adminClient";
import { supabase } from "@/lib/supabaseClient";
import { drawOrder } from "@/lib/bracket";
import { Toast, type ToastMessage } from "@/components/Toast";

type Bracket = "MAIN" | "LOWER" | "DOUBLES";
type Stage = "R1" | "QF" | "SF" | "F";

type MatchRow = {
  id: string;
  event_id: string;
  bracket: Bracket;
  stage: Stage;
  round_num: number;
  team_a: string[];
  team_b: string[];
  winner: "A" | "B" | null;
  feeds_winner_to: string | null;
  feeds_loser_to: string | null;
  is_doubles: boolean;
};

type Player = { id: string; name: string; seed: number | null };

const BRACKET_TITLES: Record<Bracket, string> = {
  MAIN: "DwB Spring Champs",
  LOWER: "Pudel König",
  DOUBLES: "Anthony Prangley Twin Bishops and Bar Bill",
};

const BRACKET_THEMES: Record<
  Bracket,
  { border: string; glow: string; header: string; label: string }
> = {
  MAIN: {
    border: "rgba(129, 140, 248, 0.45)",
    glow: "rgba(99, 102, 241, 0.25)",
    header: "linear-gradient(90deg, rgba(129, 140, 248, 0.18), transparent)",
    label: "text-violet-500",
  },
  LOWER: {
    border: "rgba(45, 212, 191, 0.45)",
    glow: "rgba(20, 184, 166, 0.22)",
    header: "linear-gradient(90deg, rgba(45, 212, 191, 0.18), transparent)",
    label: "text-teal-500",
  },
  DOUBLES: {
    border: "rgba(251, 191, 36, 0.55)",
    glow: "rgba(251, 146, 60, 0.26)",
    header: "linear-gradient(90deg, rgba(251, 191, 36, 0.2), transparent)",
    label: "text-amber-500",
  },
};

const STAGE_LABEL: Record<Stage, string> = {
  R1: "Round 1",
  QF: "Quarterfinals",
  SF: "Semifinals",
  F: "Final",
};

const STAGE_ORDER: Stage[] = ["R1", "QF", "SF", "F"];
const BRACKET_ORDER: Bracket[] = ["MAIN", "LOWER", "DOUBLES"];

async function getLatestEventId(): Promise<string | null> {
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) {
    console.error("events load error:", error);
    return null;
  }
  return data?.id ?? null;
}

export default function MatchesPage() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ToastMessage | null>(null);
  const [collapsed, setCollapsed] = useState<Record<Bracket, boolean>>({
    MAIN: false,
    LOWER: false,
    DOUBLES: false,
  });

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach((player) => map.set(player.id, player.name));
    return map;
  }, [players]);

  const seedById = useMemo(
    () => new Map(players.map((player) => [player.id, player.seed])),
    [players]
  );

  async function refreshMatches(currentEventId: string | null) {
    if (!currentEventId) return;
    const { data, error } = await supabase
      .from("matches")
      .select(
        "id,event_id,bracket,stage,round_num,team_a,team_b,winner,feeds_winner_to,feeds_loser_to,is_doubles"
      )
      .eq("event_id", currentEventId)
      .order("round_num", { ascending: true });
    if (error) {
      throw error;
    }
    setMatches(data ?? []);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const latestEventId = await getLatestEventId();
      if (!latestEventId) {
        setErr("No event found. Create one in Supabase (table: events).");
        setLoading(false);
        return;
      }
      setEventId(latestEventId);

      const [playersResponse, matchesResponse] = await Promise.all([
        supabase.from("players").select("id,name,seed").eq("event_id", latestEventId),
        supabase
          .from("matches")
          .select(
            "id,event_id,bracket,stage,round_num,team_a,team_b,winner,feeds_winner_to,feeds_loser_to,is_doubles"
          )
          .eq("event_id", latestEventId)
          .order("round_num", { ascending: true }),
      ]);

      if (playersResponse.error) {
        console.error(playersResponse.error);
        setErr(playersResponse.error.message ?? "Failed to load players");
        setLoading(false);
        return;
      }
      if (matchesResponse.error) {
        console.error(matchesResponse.error);
        setErr(matchesResponse.error.message ?? "Failed to load matches");
        setLoading(false);
        return;
      }

      setPlayers(playersResponse.data ?? []);
      setMatches(matchesResponse.data ?? []);
      setLoading(false);
    })();
  }, []);

  function playerLabel(ids: string[]) {
    if (!ids || ids.length === 0) return "(TBD)";
    if (ids.length === 1) return nameById.get(ids[0]) ?? ids[0];
    return ids.map((id) => nameById.get(id) ?? id).join(" + ");
  }

  const grouped = useMemo(() => {
    const base = BRACKET_ORDER.reduce(
      (acc, bracket) => ({
        ...acc,
        [bracket]: STAGE_ORDER.reduce(
          (stageMap, stage) => ({
            ...stageMap,
            [stage]: [] as MatchRow[],
          }),
          {} as Record<Stage, MatchRow[]>
        ),
      }),
      {} as Record<Bracket, Record<Stage, MatchRow[]>>
    );

    // Draw order: each round lines up with the matches that feed it.
    drawOrder(matches, (id) => seedById.get(id)).forEach((match) => {
      base[match.bracket][match.stage].push(match);
    });

    return base;
  }, [matches, seedById]);

  async function run(action: () => Promise<string>) {
    if (busy || !ensurePin()) return;
    setBusy(true);
    try {
      setMsg({ text: await action() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed";
      setMsg({ text: `Error: ${message}`, error: true });
    } finally {
      await refreshMatches(eventId).catch(() => {});
      setBusy(false);
    }
  }

  function pickWinner(match: MatchRow, side: "A" | "B") {
    const name = playerLabel(side === "A" ? match.team_a : match.team_b);
    const other = playerLabel(side === "A" ? match.team_b : match.team_a);
    const question = match.winner
      ? `Change the result: ${name} beat ${other}?`
      : `${name} beat ${other}?`;
    if (!confirm(question)) return;
    void run(async () => {
      await adminFetch("/api/admin/set-winner", { matchId: match.id, winner: side });
      return `${name} wins.`;
    });
  }

  function clearResult(match: MatchRow) {
    const label = `${playerLabel(match.team_a)} v ${playerLabel(match.team_b)}`;
    if (!confirm(`Clear the result of ${label}?`)) return;
    void run(async () => {
      await adminFetch("/api/admin/clear-result", { matchId: match.id });
      return `Cleared ${label}.`;
    });
  }

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--surface-glow),_transparent_65%)]"
      />

      <header className="flex flex-col gap-3 text-center sm:gap-4">
        <span className="self-center rounded-full border border-[color:var(--border)] bg-[color:var(--highlight)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
          Match desk
        </span>
        <h1 className="text-balance text-3xl font-semibold sm:text-4xl">Matches</h1>
        <p className="text-pretty text-sm text-[color:var(--muted)] sm:text-base">
          Update live scores and winners. Mobile-friendly cards keep each round easy to manage from the courtside.
        </p>
      </header>

      {loading && (
        <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center text-sm text-[color:var(--muted)] shadow-sm sm:p-8">
          Loading the latest event…
        </section>
      )}

      {!loading && err && (
        <section className="rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm font-medium text-red-500 shadow-sm sm:p-8">
          {err}
        </section>
      )}

      {!loading && !err && (
        <div className="flex flex-col gap-10">
          {BRACKET_ORDER.map((bracket) => {
            const rounds = grouped[bracket];
            const hasMatches = STAGE_ORDER.some((stage) => rounds[stage].length > 0);
            const theme = BRACKET_THEMES[bracket];
            const isCollapsed = collapsed[bracket];

            return (
              <section
                key={bracket}
                style={{
                  borderColor: theme.border,
                  boxShadow:
                    "0 1px 2px rgba(15, 23, 42, 0.04), 0 18px 38px -24px " + theme.glow,
                }}
                className="group rounded-3xl border bg-[color:var(--card)] transition"
              >
                <header
                  style={{ background: theme.header }}
                  className="flex flex-col gap-3 rounded-t-3xl border-b border-[color:var(--border)] px-6 py-6 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h2 className="text-lg font-semibold text-[color:var(--foreground)]">
                      {BRACKET_TITLES[bracket]}
                    </h2>
                    <p className="text-sm text-[color:var(--muted)]">
                      {bracket === "DOUBLES"
                        ? "Teams pair up from the singles bracket for a final showdown."
                        : "Singles bracket seeded from the Players roster."}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end">
                    <span
                      className={`text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)] ${theme.label}`}
                    >
                      {hasMatches ? "Live rounds" : "No matches"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsed((prev) => ({
                          ...prev,
                          [bracket]: !prev[bracket],
                        }))
                      }
                      aria-expanded={!isCollapsed}
                      className="inline-flex items-center justify-center self-start rounded-full border border-transparent bg-[color:var(--background)]/60 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)] transition hover:bg-[color:var(--background)]/80 hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
                    >
                      {isCollapsed ? "Expand" : "Collapse"}
                    </button>
                  </div>
                </header>

                {isCollapsed ? (
                  <p className="px-6 py-8 text-sm text-[color:var(--muted)]">
                    Bracket hidden. Expand to review matches.
                  </p>
                ) : hasMatches ? (
                  <div className="grid gap-6 px-6 py-6 sm:px-8">
                    {STAGE_ORDER.filter((stage) => rounds[stage].length > 0).map((stage) => (
                      <div key={stage} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[color:var(--muted)]">
                            {STAGE_LABEL[stage]}
                          </h3>
                          <span className="text-xs text-[color:var(--muted)]">
                            {rounds[stage].length} match{rounds[stage].length === 1 ? "" : "es"}
                          </span>
                        </div>
                        <div className="grid gap-4">
                          {rounds[stage].map((match) => {
                            const ready = match.team_a.length > 0 && match.team_b.length > 0;
                            return (
                              <article
                                key={match.id}
                                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/80 p-5 shadow-inner backdrop-blur transition hover:border-[color:var(--accent)]"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
                                      {STAGE_LABEL[match.stage]} · {BRACKET_TITLES[match.bracket]}
                                    </p>
                                    <p className="font-mono text-xs text-[color:var(--muted)]">
                                      {match.id.slice(0, 8)}
                                    </p>
                                  </div>
                                  {match.winner && (
                                    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--highlight)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--accent)]">
                                      Played
                                    </span>
                                  )}
                                </div>

                                <div className="mt-4 space-y-3">
                                  {(["A", "B"] as const).map((side) => {
                                    const label = side === "A" ? playerLabel(match.team_a) : playerLabel(match.team_b);
                                    const isWinner = match.winner === side;
                                    const isLoser = !!match.winner && !isWinner;
                                    return (
                                      <button
                                        key={side}
                                        type="button"
                                        onClick={() => pickWinner(match, side)}
                                        disabled={busy || !ready || isWinner}
                                        className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border bg-[color:var(--highlight)] px-3 py-3 text-left text-sm transition enabled:cursor-pointer enabled:hover:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-default ${
                                          isWinner ? "border-[color:var(--accent)]" : "border-[color:var(--border)]"
                                        } ${isLoser ? "opacity-60" : ""}`}
                                      >
                                        <span className="flex items-center gap-3">
                                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-xs font-semibold text-[color:var(--accent-contrast)]">
                                            {side}
                                          </span>
                                          <span className="text-pretty font-medium text-[color:var(--foreground)]">
                                            {label}
                                          </span>
                                        </span>
                                        {isWinner && (
                                          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--accent)]">
                                            Winner
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>

                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                  <p className="text-xs text-[color:var(--muted)]">
                                    {!ready
                                      ? "Waiting for players."
                                      : match.winner
                                        ? "Tap the other name to change the result."
                                        : "Tap the winner's name."}
                                  </p>
                                  {match.winner && (
                                    <button
                                      type="button"
                                      onClick={() => clearResult(match)}
                                      disabled={busy}
                                      className="inline-flex items-center justify-center rounded-xl border border-red-500 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Clear result
                                    </button>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="px-6 py-10 text-center text-sm text-[color:var(--muted)] sm:px-8">
                    No matches yet. Build brackets from the TD Control page.
                  </p>
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
