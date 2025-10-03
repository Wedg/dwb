"use client";

import { useEffect, useMemo, useState } from "react";
import { adminFetch, ensurePin } from "@/lib/adminClient";
import { supabase } from "@/lib/supabaseClient";

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
  DOUBLES: "Anthony Prangley Silence of the Champs",
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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [winner, setWinner] = useState<"A" | "B" | "">("");
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

    matches.forEach((match) => {
      base[match.bracket][match.stage].push(match);
    });

    BRACKET_ORDER.forEach((bracket) => {
      STAGE_ORDER.forEach((stage) => {
        base[bracket][stage].sort((a, b) => {
          const roundDelta = (a.round_num ?? 0) - (b.round_num ?? 0);
          if (roundDelta !== 0) return roundDelta;
          return a.id.localeCompare(b.id);
        });
      });
    });

    return base;
  }, [matches]);

  function openEdit(match: MatchRow) {
    setEditingId(match.id);
    setWinner((match.winner ?? "") as "A" | "B" | "");
  }

  async function onSave() {
    if (!editingId) return;
    if (winner !== "A" && winner !== "B") {
      alert("Pick A or B");
      return;
    }
    if (!ensurePin()) return;
    try {
      await adminFetch("/api/admin/set-winner", { matchId: editingId, winner });
      await refreshMatches(eventId);
      setEditingId(null);
      setWinner("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed";
      alert(message);
    }
  }

  async function onClear(matchId: string) {
    if (!ensurePin()) return;
    try {
      await adminFetch("/api/admin/clear-result", { matchId });
      await refreshMatches(eventId);
      setEditingId(null);
      setWinner("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to clear";
      alert(message);
    }
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
                            const isEditing = editingId === match.id;
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
                                      Winner · {match.winner}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-4 space-y-3">
                                  {["A", "B"].map((side) => {
                                    const label = side === "A" ? playerLabel(match.team_a) : playerLabel(match.team_b);
                                    const isWinner = match.winner === side;
                                    return (
                                      <div
                                        key={side}
                                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--highlight)] px-3 py-3 text-sm"
                                      >
                                        <div className="flex items-center gap-3 text-left">
                                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--accent)] text-xs font-semibold text-[color:var(--accent-contrast)]">
                                            {side}
                                          </span>
                                          <span className="text-pretty font-medium text-[color:var(--foreground)]">
                                            {label}
                                          </span>
                                        </div>
                                        {isWinner && (
                                          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--accent)]">
                                            Winner
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                  <button
                                    type="button"
                                    onClick={() => openEdit(match)}
                                    className="inline-flex items-center justify-center rounded-xl border border-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)] hover:text-[color:var(--accent-contrast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
                                  >
                                    {isEditing ? "Editing" : "Set winner"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onClear(match.id)}
                                    className="inline-flex items-center justify-center rounded-xl border border-red-500 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
                                  >
                                    Clear result
                                  </button>
                                </div>

                                {isEditing && (
                                  <fieldset className="mt-4 grid gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--highlight)] p-4 text-sm">
                                    <legend className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
                                      Choose side
                                    </legend>
                                    {(["A", "B"] as const).map((side) => (
                                      <label key={side} className="flex items-center justify-between gap-3">
                                        <span className="font-medium text-[color:var(--foreground)]">
                                          {match.is_doubles ? `Team ${side}` : side}
                                        </span>
                                        <input
                                          type="radio"
                                          name={`winner-${match.id}`}
                                          value={side}
                                          checked={winner === side}
                                          onChange={() => setWinner(side)}
                                        />
                                      </label>
                                    ))}
                                    <div className="flex flex-wrap items-center gap-3 pt-2">
                                      <button
                                        type="button"
                                        onClick={onSave}
                                        className="inline-flex items-center justify-center rounded-xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-[color:var(--accent-contrast)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
                                      >
                                        Save winner
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingId(null);
                                          setWinner("");
                                        }}
                                        className="inline-flex items-center justify-center rounded-xl border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:bg-[color:var(--highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </fieldset>
                                )}
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
    </main>
  );
}
