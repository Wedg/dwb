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
 * preserving the order given. The doubles draw is random, so build-doubles
 * passes the losers through `shuffled` first.
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

/** A uniformly random reordering of `items` (Fisher–Yates). */
export function shuffled<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Orders a bracket's QFs for wiring R1 into them (R1 slots 0–1 → first QF,
 * 2–3 → second, …). QFs that feed the same SF come out next to each other, so
 * slots 0–3 meet in one semi and 4–7 in the other: the standard draw. Sorting
 * by id alone paired the semis at random.
 */
export function qfWiringOrder(qfs: { id: string; feeds_winner_to: string | null }[]): string[] {
  return [...qfs]
    .sort(
      (x, y) =>
        (x.feeds_winner_to ?? "").localeCompare(y.feeds_winner_to ?? "") || x.id.localeCompare(y.id),
    )
    .map((qf) => qf.id);
}

export type WiredMatch = {
  id: string;
  stage: Stage;
  team_a: Team;
  team_b: Team;
  feeds_winner_to: string | null;
  feeds_loser_to: string | null;
};

/**
 * Sorts matches into draw order for display: R1 by canonical slot, and every
 * later match by the earliest R1 slot that feeds it. Each round then lines up
 * with the round before (1v16 next to 8v9, and their QF first). Matches with
 * nothing feeding them yet (doubles SFs, an unwired skeleton) go last, by id.
 */
export function drawOrder<M extends WiredMatch>(
  matches: M[],
  seedOf: (playerId: string) => number | null | undefined,
): M[] {
  const feeders = new Map<string, M[]>();
  for (const m of matches) {
    for (const next of [m.feeds_winner_to, m.feeds_loser_to]) {
      if (next) feeders.set(next, [...(feeders.get(next) ?? []), m]);
    }
  }

  const memo = new Map<string, number>();
  const position = (m: M): number => {
    const known = memo.get(m.id);
    if (known !== undefined) return known;
    memo.set(m.id, Infinity); // guards against a (corrupt) cycle
    let pos = Infinity;
    if (m.stage === "R1") {
      const sa = seedOf(m.team_a[0] ?? "");
      const sb = seedOf(m.team_b[0] ?? "");
      const slot = sa != null && sb != null ? findCanonicalSlot(sa, sb) : -1;
      if (slot >= 0) pos = slot;
    } else {
      for (const f of feeders.get(m.id) ?? []) pos = Math.min(pos, position(f));
    }
    memo.set(m.id, pos);
    return pos;
  };

  return [...matches].sort((x, y) => position(x) - position(y) || x.id.localeCompare(y.id));
}

/**
 * Why a match's result can't be set to `next` (or cleared, when `next` is
 * null) right now, or null if it can. `downstreamDecided` means a match this
 * one feeds already has a result, so its players can no longer be swapped and
 * changing this result would leave the bracket inconsistent.
 */
export function resultChangeProblem(
  match: MatchSlots,
  next: Side | null,
  downstreamDecided: boolean,
): string | null {
  if (next && (match.team_a.length === 0 || match.team_b.length === 0)) {
    return "Both sides of this match need players before it can have a winner.";
  }
  if (next === match.winner) return null;
  if (downstreamDecided) {
    return "The next match already has a result. Clear that result first, then change this one.";
  }
  return null;
}

const loserOf = (m: MatchSlots): string | undefined =>
  (m.winner === "A" ? m.team_b : m.winner === "B" ? m.team_a : [])[0];

/**
 * Brings an existing doubles draw up to date after QF results were corrected.
 * Each player in the draw who no longer lost a QF is swapped for whoever lost
 * that same QF now, so everyone else keeps their partner and semi.
 *
 * Returns old → new player id swaps (empty when the draw is already current),
 * or null when the draw can't be patched that way and needs redrawing.
 */
export function planDoublesSwaps(qfs: MatchSlots[], drawn: string[]): Map<string, string> | null {
  const losers = qfs.map(loserOf);
  if (losers.some((id) => !id)) return null;
  const current = new Set(losers as string[]);
  const inDraw = new Set(drawn);

  const swaps = new Map<string, string>();
  for (const old of inDraw) {
    if (current.has(old)) continue;
    const qf = qfs.find((m) => m.team_a.includes(old) || m.team_b.includes(old));
    const replacement = qf && loserOf(qf);
    if (!replacement || inDraw.has(replacement)) return null;
    swaps.set(old, replacement);
  }

  const missing = [...current].filter((id) => !inDraw.has(id));
  const covered = new Set(swaps.values());
  return missing.length === covered.size && missing.every((id) => covered.has(id)) ? swaps : null;
}
