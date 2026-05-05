// Pure bracket logic. No Supabase, no I/O, no side effects.
// Used by /api/admin/* routes. Test in bracket.test.ts.

export type Bracket = "MAIN" | "LOWER" | "DOUBLES";
export type Stage = "R1" | "QF" | "SF" | "F";
export type Side = "A" | "B";
export type Team = string[];

/** A match's slot state, as needed by placement/removal logic. */
export type MatchSlots = {
  team_a: Team;
  team_b: Team;
  winner: Side | null;
};

/** Patch of fields to update on a match row. `null` means no change. */
export type SlotPatch = { team_a?: Team; team_b?: Team };

const eq = (x: Team, y: Team) =>
  x.length === y.length && x.every((id, i) => id === y[i]);
const overlap = (x: Team, y: Team) => x.some((id) => y.includes(id));

/**
 * Canonical 16-player single-elimination R1 seed pairs, in the order that
 * R1 slots feed into QFs (slots 0–1 → QF0, 2–3 → QF1, 4–5 → QF2, 6–7 → QF3).
 *
 * INVARIANT: every seed 1..16 appears exactly once.
 */
export function canonicalPairs(): readonly [number, number][] {
  return [
    [1, 16],
    [8, 9],
    [5, 12],
    [4, 13],
    [3, 14],
    [6, 11],
    [7, 10],
    [2, 15],
  ];
}

/** Returns the slot index (0..7) for a R1 pair, or -1 if not canonical. */
export function findCanonicalSlot(seedA: number, seedB: number): number {
  const key = `${Math.min(seedA, seedB)}-${Math.max(seedA, seedB)}`;
  const pairs = canonicalPairs().map(
    ([a, b]) => `${Math.min(a, b)}-${Math.max(a, b)}`,
  );
  return pairs.indexOf(key);
}

/** Maps an R1 slot index (0..7) to the QF index (0..3) it feeds. */
export function r1SlotToQfIndex(slotIndex: number): number {
  return Math.floor(slotIndex / 2);
}

/**
 * Plan the placement of a team into a downstream match, handling the
 * "re-correction" case where a previous (now-stale) team from the same
 * upstream match is sitting in one of the slots.
 *
 * Returns a SlotPatch with the changed fields, or null if no update needed.
 *
 *   - `team` is the team we want to install (the new winner or new loser).
 *   - `opponent` is the OTHER team from the same upstream match. Its presence
 *     in a slot is what tells us "this slot was populated by the upstream
 *     match" — so it (or a previous winner from that match) needs clearing.
 */
export function planPlaceTeam(
  next: MatchSlots,
  team: Team,
  opponent: Team,
): SlotPatch | null {
  if (team.length === 0) return null;
  if (next.winner) return null;

  const a = next.team_a;
  const b = next.team_b;

  const originPlayers = new Set([...team, ...opponent]);
  const aHasOrigin = a.some((id) => originPlayers.has(id));
  const bHasOrigin = b.some((id) => originPlayers.has(id));
  const aHasTeam = overlap(a, team);
  const bHasTeam = overlap(b, team);

  let target: "a" | "b" | null = null;
  if (aHasTeam) target = "a";
  else if (bHasTeam) target = "b";
  else if (aHasOrigin && !bHasOrigin) target = "a";
  else if (bHasOrigin && !aHasOrigin) target = "b";
  else if (aHasOrigin && bHasOrigin) target = "a";

  if (aHasOrigin || bHasOrigin) {
    const patch: SlotPatch = {};
    if (aHasOrigin && (target !== "a" || !eq(a, team))) patch.team_a = [];
    if (bHasOrigin && (target !== "b" || !eq(b, team))) patch.team_b = [];

    const nextA = patch.team_a !== undefined ? [] : a;
    const nextB = patch.team_b !== undefined ? [] : b;

    if (target === "a" && !eq(nextA, team)) patch.team_a = team;
    if (target === "b" && !eq(nextB, team)) patch.team_b = team;

    return Object.keys(patch).length > 0 ? patch : null;
  }

  if (eq(a, team) || eq(b, team)) return null;
  if (overlap(a, team) && a.length < team.length) return { team_a: team };
  if (overlap(b, team) && b.length < team.length) return { team_b: team };
  if (a.length === 0) return { team_a: team };
  if (b.length === 0) return { team_b: team };
  return null;
}

/** Plan the removal of a team from a downstream match (on clear-result). */
export function planRemoveTeam(next: MatchSlots, team: Team): SlotPatch | null {
  if (team.length === 0) return null;
  if (next.winner) return null;
  if (eq(next.team_a, team)) return { team_a: [] };
  if (eq(next.team_b, team)) return { team_b: [] };
  return null;
}

/**
 * Build the 4 doubles teams + the 2 SF matchups from the 8 singles QF losers,
 * preserving the order given. Caller is responsible for passing losers in a
 * stable order (e.g. sorted by `id`) — pairing depends on order.
 *
 * Returns:
 *   teams[i] = [loser[2i], loser[2i+1]]
 *   sfMatchups = [[teams[0], teams[3]], [teams[1], teams[2]]]
 */
export function pairLosersIntoDoublesTeams(losers: string[]): {
  teams: [string, string][];
  sfMatchups: [[string, string], [string, string]][];
} {
  if (losers.length !== 8) {
    throw new Error(`Need exactly 8 QF losers, got ${losers.length}`);
  }
  const teams: [string, string][] = [];
  for (let i = 0; i < 8; i += 2) teams.push([losers[i], losers[i + 1]]);
  return {
    teams,
    sfMatchups: [
      [teams[0], teams[3]],
      [teams[1], teams[2]],
    ],
  };
}
