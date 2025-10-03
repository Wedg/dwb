"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
};

type Player = { id: string; name: string };

const BRACKET_TITLES: Record<Bracket, string> = {
  MAIN: "DwB Spring Champs",
  LOWER: "Pudel König",
  DOUBLES: "Anthony Prangley Silence of the Champs",
};

const STAGE_ORDER: Stage[] = ["R1", "QF", "SF", "F"];
const STAGE_LABEL: Record<Stage, string> = {
  R1: "Round 1",
  QF: "Quarterfinals",
  SF: "Semifinals",
  F: "Final",
};

async function getLatestEventId(): Promise<string | null> {
  const { data, error } = await supabase
    .from("events")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data?.id ?? null;
}

export default function BracketsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Bracket>("MAIN");

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    players.forEach((player) => map.set(player.id, player.name));
    return map;
  }, [players]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);

      const eventId = await getLatestEventId();
      if (!eventId) {
        setErr("No event found.");
        setLoading(false);
        return;
      }

      const [playersResponse, matchesResponse] = await Promise.all([
        supabase.from("players").select("id,name").eq("event_id", eventId),
        supabase
          .from("matches")
          .select("id,event_id,bracket,stage,round_num,team_a,team_b,winner")
          .eq("event_id", eventId),
      ]);

      if (playersResponse.error) {
        setErr(playersResponse.error.message);
        setLoading(false);
        return;
      }
      if (matchesResponse.error) {
        setErr(matchesResponse.error.message);
        setLoading(false);
        return;
      }

      setPlayers(playersResponse.data ?? []);
      setMatches(matchesResponse.data ?? []);
      setLoading(false);
    })();
  }, []);

  function labelTeam(ids: string[]) {
    if (!ids || ids.length === 0) return "—";
    if (ids.length === 1) return nameById.get(ids[0]) ?? ids[0];
    return ids.map((id) => nameById.get(id) ?? id).join(" + ");
  }

  const rounds = useMemo(() => {
    const rows = matches.filter((match) => match.bracket === tab);
    const stageMap = new Map<Stage, MatchRow[]>();
    STAGE_ORDER.forEach((stage) => stageMap.set(stage, []));
    rows.forEach((match) => stageMap.get(match.stage)!.push(match));

    STAGE_ORDER.forEach((stage) => {
      const arr = stageMap.get(stage)!;
      arr.sort((a, b) => {
        const roundDelta = (a.round_num ?? 0) - (b.round_num ?? 0);
        if (roundDelta !== 0) return roundDelta;
        return a.id.localeCompare(b.id);
      });
    });

    return STAGE_ORDER.map((stage) => ({ stage, matches: stageMap.get(stage)! })).filter(
      (group) => group.matches.length > 0
    );
  }, [matches, tab]);

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--surface-glow),_transparent_65%)]"
      />

      <header className="flex flex-col gap-3 text-center sm:gap-4">
        <span className="self-center rounded-full border border-[color:var(--border)] bg-[color:var(--highlight)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
          Public view
        </span>
        <h1 className="text-balance text-3xl font-semibold sm:text-4xl">Brackets</h1>
        <p className="text-pretty text-sm text-[color:var(--muted)] sm:text-base">
          Follow every round in real time. Tap a bracket to browse matches, then jump to Matches to update winners.
        </p>
      </header>

      <nav className="flex flex-wrap items-center justify-center gap-3">
        {(["MAIN", "LOWER", "DOUBLES"] as Bracket[]).map((bracket) => (
          <button
            key={bracket}
            type="button"
            onClick={() => setTab(bracket)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] ${
              tab === bracket
                ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-contrast)] shadow"
                : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:border-[color:var(--accent)]"
            }`}
          >
            <span>{BRACKET_TITLES[bracket]}</span>
          </button>
        ))}
      </nav>

      {loading && (
        <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center text-sm text-[color:var(--muted)] shadow-sm sm:p-8">
          Loading latest brackets…
        </section>
      )}

      {!loading && err && (
        <section className="rounded-3xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm font-medium text-red-500 shadow-sm sm:p-8">
          {err}
        </section>
      )}

      {!loading && !err && (
        <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-0 shadow-sm">
          <header className="flex flex-col gap-2 border-b border-[color:var(--border)] px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">{BRACKET_TITLES[tab]}</h2>
              <p className="text-sm text-[color:var(--muted)]">
                {tab === "DOUBLES"
                  ? "Pairings created from singles results."
                  : "Seeded singles bracket straight from the Players roster."}
              </p>
            </div>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
              {rounds.length > 0 ? "Live view" : "Coming soon"}
            </span>
          </header>

          {rounds.length > 0 ? (
            <div className="overflow-x-auto px-4 pb-6 pt-4 sm:px-6 lg:px-8">
              <div className="grid grid-flow-col auto-cols-[minmax(220px,1fr)] gap-6">
                {rounds.map((column) => (
                  <div key={column.stage} className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[color:var(--muted)]">
                      {STAGE_LABEL[column.stage]}
                    </h3>
                    <div className="grid gap-3">
                      {column.matches.map((match) => (
                        <article
                          key={match.id}
                          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]/90 p-4 shadow-inner backdrop-blur"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-mono text-xs text-[color:var(--muted)]">{match.id.slice(0, 8)}</p>
                            {match.winner && (
                              <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--highlight)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-[color:var(--accent)]">
                                Winner · {match.winner}
                              </span>
                            )}
                          </div>
                          <div className="mt-3 space-y-2">
                            <div className={`rounded-xl border px-3 py-3 text-sm font-medium ${
                              match.winner === "A"
                                ? "border-[color:var(--accent)] text-[color:var(--foreground)]"
                                : "border-[color:var(--border)] text-[color:var(--foreground)]"
                            }`}>
                              <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
                                Team A
                              </span>
                              <span className="text-pretty">{labelTeam(match.team_a)}</span>
                            </div>
                            <div className={`rounded-xl border px-3 py-3 text-sm font-medium ${
                              match.winner === "B"
                                ? "border-[color:var(--accent)] text-[color:var(--foreground)]"
                                : "border-[color:var(--border)] text-[color:var(--foreground)]"
                            }`}>
                              <span className="block text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
                                Team B
                              </span>
                              <span className="text-pretty">{labelTeam(match.team_b)}</span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="px-6 py-10 text-center text-sm text-[color:var(--muted)]">
              No matches have been generated yet.
            </p>
          )}
        </section>
      )}

      <p className="text-center text-sm text-[color:var(--muted)]">
        Use the <Link href="/matches" className="underline">Matches</Link> page to set winners; updates appear instantly here.
      </p>
    </main>
  );
}
