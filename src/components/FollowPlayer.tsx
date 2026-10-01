"use client";

import { useMemo } from "react";
import type { TournamentPlayer } from "@/lib/useTournament";
import {
  describeJourney,
  playerJourney,
  type NameOf,
  type TournamentView,
  type ViewMatch,
} from "@/lib/tournament";
import { StarIcon, TrophyIcon } from "@/components/icons";

const selectClassName =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] shadow-sm focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] sm:w-56";

/**
 * "Follow a player": pick a name once (remembered on this phone) to see where
 * they stand and have their matches starred on the Brackets and Matches pages.
 */
export function FollowPlayer({
  players,
  matches,
  view,
  nameOf,
  followed,
  onFollow,
}: {
  players: TournamentPlayer[];
  matches: ViewMatch[];
  view: TournamentView;
  nameOf: NameOf;
  followed: string | null;
  onFollow: (id: string | null) => void;
}) {
  const sorted = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players]);
  if (!players.length) return null;

  const picker = (
    <select
      aria-label={followed ? "Follow someone else" : "Follow a player"}
      value={followed ?? ""}
      onChange={(event) => onFollow(event.target.value || null)}
      className={selectClassName}
    >
      <option value="">{followed ? "Stop following" : "Pick a name…"}</option>
      {sorted.map((player) => (
        <option key={player.id} value={player.id}>
          {player.name}
        </option>
      ))}
    </select>
  );

  if (!followed) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-[color:var(--foreground)]">Playing tonight?</p>
          <p className="text-sm text-[color:var(--muted)]">
            Pick your name to follow your matches. This phone remembers it.
          </p>
        </div>
        {picker}
      </section>
    );
  }

  const status = describeJourney(followed, playerJourney(followed, matches), view, nameOf);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[color:var(--accent)] bg-[color:var(--card)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)]">
          {status.trophy ? <TrophyIcon /> : <StarIcon className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <p className="break-words text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Following {nameOf(followed)}
          </p>
          <p className="break-words font-semibold text-[color:var(--foreground)]">{status.headline}</p>
          <p className="break-words text-sm text-[color:var(--muted)]">{status.detail}</p>
        </div>
      </div>
      {picker}
    </section>
  );
}
