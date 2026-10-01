// Pure display helpers for the public pages (Home, Brackets, Matches).
// No Supabase, no I/O, no side effects. Test in tournament.test.ts.

import { drawOrder, type Bracket, type Side, type Stage, type Team } from "./bracket";

export type ViewMatch = {
  id: string;
  bracket: Bracket;
  stage: Stage;
  team_a: Team;
  team_b: Team;
  winner: Side | null;
  feeds_winner_to: string | null;
  feeds_loser_to: string | null;
};

export type NameOf = (playerId: string) => string;

export const BRACKET_ORDER: Bracket[] = ["MAIN", "LOWER", "DOUBLES"];
export const STAGE_ORDER: Stage[] = ["R1", "QF", "SF", "F"];

export const BRACKET_TITLES: Record<Bracket, string> = {
  MAIN: "DwB Spring Champs",
  LOWER: "Pudel König",
  DOUBLES: "Anthony Prangley Twin Bishops and Bar Bill",
};

/** Short names for tabs and other tight spots. */
export const BRACKET_SHORT: Record<Bracket, string> = {
  MAIN: "Spring Champs",
  LOWER: "Pudel König",
  DOUBLES: "Twin Bishops",
};

export const BRACKET_BLURB: Record<Bracket, string> = {
  MAIN: "The main draw for all 16 players. Round 1 losers drop into the Pudel König.",
  LOWER: "A second chance for the eight Round 1 losers.",
  DOUBLES: "Doubles for the eight quarterfinal losers, with partners drawn at random.",
};

export const STAGE_LABEL: Record<Stage, string> = {
  R1: "Round 1",
  QF: "Quarterfinals",
  SF: "Semifinals",
  F: "Final",
};

export const STAGE_SINGULAR: Record<Stage, string> = {
  R1: "Round 1",
  QF: "Quarterfinal",
  SF: "Semifinal",
  F: "Final",
};

const STAGE_RANK: Record<Stage, number> = { R1: 0, QF: 1, SF: 2, F: 3 };

/** decided: has a result. ready: both sides known, no result yet. waiting: a side is still TBD. */
export type MatchState = "decided" | "ready" | "waiting";

export function matchState(m: ViewMatch): MatchState {
  if (m.winner) return "decided";
  return m.team_a.length > 0 && m.team_b.length > 0 ? "ready" : "waiting";
}

export const teamName = (team: Team, nameOf: NameOf) => team.map(nameOf).join(" + ");

export const sideTeam = (m: ViewMatch, side: Side): Team => (side === "A" ? m.team_a : m.team_b);
export const otherSide = (side: Side): Side => (side === "A" ? "B" : "A");

export type TournamentView = {
  /** Every match in draw order (see drawOrder). */
  ordered: ViewMatch[];
  /** 1-based number of each match within its bracket and stage, in draw order. */
  number: Map<string, number>;
  /** The matches that feed each match, in draw order. */
  feeders: Map<string, ViewMatch[]>;
};

export function buildView(
  matches: ViewMatch[],
  seedOf: (playerId: string) => number | null | undefined,
): TournamentView {
  const ordered = drawOrder(matches, seedOf);
  const number = new Map<string, number>();
  const counts = new Map<string, number>();
  const feeders = new Map<string, ViewMatch[]>();
  for (const m of ordered) {
    const key = `${m.bracket}/${m.stage}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    number.set(m.id, counts.get(key)!);
    for (const next of [m.feeds_winner_to, m.feeds_loser_to]) {
      if (next) feeders.set(next, [...(feeders.get(next) ?? []), m]);
    }
  }
  return { ordered, number, feeders };
}

/**
 * What each empty side of a match is waiting for, e.g. "Winner of Tom v
 * Grant" or, for doubles, "Winners of Semifinal 1". Sides that already have
 * players get "". Feeders whose team has already arrived are skipped, so the
 * remaining ones fill the empty sides in draw order.
 */
export function waitingLabels(m: ViewMatch, view: TournamentView, nameOf: NameOf): [string, string] {
  const placed = new Set([...m.team_a, ...m.team_b]);
  const pending = (view.feeders.get(m.id) ?? []).filter(
    (f) => ![...f.team_a, ...f.team_b].some((id) => placed.has(id)),
  );
  const labels = pending.map((f) => {
    const doubles = f.team_a.length > 1 || f.team_b.length > 1 || f.bracket === "DOUBLES";
    const outcome = (f.feeds_winner_to === m.id ? "Winner" : "Loser") + (doubles ? "s" : "");
    const known = f.team_a.length > 0 && f.team_b.length > 0;
    return known && !doubles
      ? `${outcome} of ${teamName(f.team_a, nameOf)} v ${teamName(f.team_b, nameOf)}`
      : `${outcome} of ${STAGE_SINGULAR[f.stage]} ${view.number.get(f.id) ?? ""}`.trim();
  });
  let next = 0;
  const label = (team: Team) => (team.length ? "" : labels[next++] ?? "To be decided");
  const a = label(m.team_a);
  const b = label(m.team_b);
  return [a, b];
}

export type SideView = {
  side: Side;
  label: string;
  placeholder: boolean;
  won: boolean;
  lost: boolean;
  followed: boolean;
};

/** Everything a match card needs to draw its two sides. */
export function sideViews(
  m: ViewMatch,
  view: TournamentView,
  nameOf: NameOf,
  followedId?: string | null,
): [SideView, SideView] {
  const waiting = waitingLabels(m, view, nameOf);
  const make = (side: Side, i: number): SideView => {
    const team = sideTeam(m, side);
    return {
      side,
      label: team.length ? teamName(team, nameOf) : waiting[i],
      placeholder: team.length === 0,
      won: m.winner === side,
      lost: !!m.winner && m.winner !== side,
      followed: !!followedId && team.includes(followedId),
    };
  };
  return [make("A", 0), make("B", 1)];
}

/**
 * The round to show first for a bracket: the earliest round with a match
 * ready to play; once nothing is ready, the furthest round with a result
 * (the final, at the end of the night).
 */
export function currentRound(bracket: Bracket, matches: ViewMatch[]): Stage | null {
  const inBracket = matches.filter((m) => m.bracket === bracket);
  const stages = STAGE_ORDER.filter((s) => inBracket.some((m) => m.stage === s));
  if (!stages.length) return null;
  const ready = stages.find((s) => inBracket.some((m) => m.stage === s && matchState(m) === "ready"));
  if (ready) return ready;
  const played = [...stages].reverse().find((s) => inBracket.some((m) => m.stage === s && m.winner));
  return played ?? stages[0];
}

/** The winner and runner-up of a bracket, once its final has a result. */
export function champion(bracket: Bracket, matches: ViewMatch[]): { winner: Team; runnerUp: Team } | null {
  const final = matches.find((m) => m.bracket === bracket && m.stage === "F");
  if (!final?.winner) return null;
  return { winner: sideTeam(final, final.winner), runnerUp: sideTeam(final, otherSide(final.winner)) };
}

/**
 * Where a player stands, for "follow a player":
 *   not-drawn       no matches yet (the draw hasn't been made)
 *   playing         in a match without a result (ready, or waiting for an opponent)
 *   champion        won a final
 *   doubles-pending lost a quarterfinal; the doubles haven't been drawn yet
 *   through         won their last match but the next one isn't set up
 *   out             lost their last match
 * A player is only ever in one unfinished match: Round 1 losers move to the
 * Pudel König and quarterfinal losers to the doubles, never both at once.
 */
export type Journey =
  | { kind: "not-drawn" }
  | { kind: "doubles-pending" }
  | { kind: "playing" | "champion" | "through" | "out"; match: ViewMatch; side: Side };

export function playerJourney(playerId: string, matches: ViewMatch[]): Journey {
  const mine = matches.flatMap((m) =>
    m.team_a.includes(playerId)
      ? [{ match: m, side: "A" as Side }]
      : m.team_b.includes(playerId)
        ? [{ match: m, side: "B" as Side }]
        : [],
  );
  if (!mine.length) return { kind: "not-drawn" };

  const open = mine.find((x) => !x.match.winner);
  if (open) return { kind: "playing", ...open };

  const last = mine.reduce((a, b) => (STAGE_RANK[b.match.stage] > STAGE_RANK[a.match.stage] ? b : a));
  if (last.match.winner === last.side) {
    return { kind: last.match.stage === "F" ? "champion" : "through", ...last };
  }
  if (last.match.stage === "QF" && last.match.bracket !== "DOUBLES") return { kind: "doubles-pending" };
  return { kind: "out", ...last };
}

/** "Round 1" or "the quarterfinal", to read naturally mid-sentence. */
const theStage = (stage: Stage) => (stage === "R1" ? "Round 1" : `the ${STAGE_SINGULAR[stage].toLowerCase()}`);

/**
 * The follow card's text for a player. Written about the player by name
 * elsewhere on the card, so no "you": the phone may belong to a friend or
 * parent following them.
 */
export function describeJourney(
  playerId: string,
  journey: Journey,
  view: TournamentView,
  nameOf: NameOf,
): { headline: string; detail: string; trophy?: boolean } {
  if (journey.kind === "not-drawn") {
    return { headline: "The draw hasn't been made yet", detail: "Check back once the bracket is up." };
  }
  if (journey.kind === "doubles-pending") {
    return {
      headline: "Into the doubles",
      detail: "Partners are drawn at random once all eight quarterfinals are finished.",
    };
  }

  const { match, side } = journey;
  const where = BRACKET_TITLES[match.bracket];
  const partner = sideTeam(match, side).filter((id) => id !== playerId);
  const withPartner = partner.length ? `With ${teamName(partner, nameOf)} · ` : "";
  const stage = STAGE_SINGULAR[match.stage];

  switch (journey.kind) {
    case "playing": {
      const opponents = sideTeam(match, otherSide(side));
      if (opponents.length) {
        return { headline: `Up next: ${stage} v ${teamName(opponents, nameOf)}`, detail: `${withPartner}${where}` };
      }
      const waiting = waitingLabels(match, view, nameOf)[side === "A" ? 1 : 0];
      const against = waiting && waiting !== "To be decided" ? `v ${waiting[0].toLowerCase()}${waiting.slice(1)} · ` : "";
      return { headline: `Next: ${stage}`, detail: `${withPartner}${against}${where}` };
    }
    case "champion": {
      const runnerUp = teamName(sideTeam(match, otherSide(side)), nameOf);
      return {
        headline: `Won the ${where}!`,
        detail: partner.length ? `With ${teamName(partner, nameOf)}. Beat ${runnerUp} in the final.` : `Beat ${runnerUp} in the final.`,
        trophy: true,
      };
    }
    case "through":
      return { headline: `Won ${theStage(match.stage)}`, detail: `${withPartner}${where} · next round to come` };
    case "out":
      return match.stage === "F"
        ? { headline: "Runner-up", detail: `${withPartner}${where}` }
        : { headline: `Out in ${theStage(match.stage)}`, detail: `${withPartner}${where} · thanks for playing!` };
  }
}
