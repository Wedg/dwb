// Pure roster + seeding logic. No Supabase, no I/O, no side effects.
// Used by /api/admin/players/* routes and the Players page. Test in
// seeding.test.ts.
//
// Seed changes come back as a list of { id, seed } that the routes write in
// ONE upsert. Seeds are unique per event and Postgres only tolerates the
// momentary duplicate in a swap when both rows change in the same statement
// (see players_event_seed_key in db/schema.sql) — never write them one by one.

import { shuffled } from "./bracket";

export const MAX_PLAYERS = 16;

export type SeededPlayer = { id: string; name: string; seed: number };
export type SeedChange = { id: string; seed: number };

/** A problem with the request itself (bad input, roster full, …). */
export class RosterError extends Error {}

export const ROSTER_LOCKED_MESSAGE =
  "The bracket has been built from these seeds, so the roster is locked. " +
  "To swap in a substitute, rename the player. To re-seed, reset the matches on the Control page first.";

const isSeed = (n: unknown): n is number =>
  Number.isInteger(n) && (n as number) >= 1 && (n as number) <= MAX_PLAYERS;

const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Splits pasted text into player names: one per line, trimmed, blank lines
 * dropped. Leading list markers ("1.", "2)", "-", "•") are stripped so a
 * numbered sign-up list can be pasted as-is.
 */
export function parseNames(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").trim())
    .filter(Boolean);
}

/** The lowest `count` seeds in 1..16 that aren't in `taken`. */
export function freeSeeds(taken: Iterable<number>, count = MAX_PLAYERS): number[] {
  const used = new Set(taken);
  const free: number[] = [];
  for (let s = 1; s <= MAX_PLAYERS && free.length < count; s++) {
    if (!used.has(s)) free.push(s);
  }
  return free;
}

/**
 * Validates a name for `players`, ignoring the player `exceptId` (when
 * renaming). Returns the trimmed name.
 */
export function checkName(
  players: { id?: string; name: string }[],
  name: string,
  exceptId?: string,
): string {
  const trimmed = name.trim();
  if (!trimmed) throw new RosterError("Name required");
  const clash = players.find(
    (p) => (exceptId === undefined || p.id !== exceptId) && nameKey(p.name) === nameKey(trimmed),
  );
  if (clash) throw new RosterError(`${clash.name} is already on the roster`);
  return trimmed;
}

/**
 * Plans the rows to insert for new players. An entry may ask for a specific
 * seed; the rest take the lowest free seeds, in the order given — so a list
 * typed in seed order comes out seeded 1, 2, 3, ….
 */
export function planAddPlayers(
  existing: { name: string; seed: number }[],
  entries: { name: string; seed?: number }[],
): { name: string; seed: number }[] {
  if (entries.length === 0) throw new RosterError("Name required");

  const room = MAX_PLAYERS - existing.length;
  if (entries.length > room) {
    throw new RosterError(
      room === 0
        ? `Already have ${MAX_PLAYERS} players`
        : `Only ${room} spot${room === 1 ? "" : "s"} left; tried to add ${entries.length}`,
    );
  }

  const seen = new Set<string>();
  const names = entries.map((entry) => {
    const name = checkName(existing, entry.name);
    if (seen.has(nameKey(name))) throw new RosterError(`${name} is listed twice`);
    seen.add(nameKey(name));
    return name;
  });

  const taken = new Set(existing.map((p) => p.seed));
  for (const { seed } of entries) {
    if (seed == null) continue;
    if (!isSeed(seed)) throw new RosterError(`Seed must be an integer 1..${MAX_PLAYERS}`);
    if (taken.has(seed)) throw new RosterError(`Seed ${seed} already taken`);
    taken.add(seed);
  }

  const auto = freeSeeds(taken);
  let next = 0;
  return entries.map((entry, i) => ({ name: names[i], seed: entry.seed ?? auto[next++] }));
}

/**
 * Plans moving one player to `seed`. Whoever holds that seed swaps into the
 * player's old one; if nobody does, the player simply moves.
 */
export function planSetSeed(players: SeededPlayer[], id: string, seed: number): SeedChange[] {
  if (!isSeed(seed)) throw new RosterError(`Seed must be an integer 1..${MAX_PLAYERS}`);
  const player = players.find((p) => p.id === id);
  if (!player) throw new RosterError("Player not found");
  if (player.seed === seed) return [];

  const holder = players.find((p) => p.seed === seed);
  return holder ? [{ id, seed }, { id: holder.id, seed: player.seed }] : [{ id, seed }];
}

/**
 * Deals the roster's current seeds out to its players in a uniformly random
 * order (Fisher–Yates). Returns only the players whose seed changed.
 */
export function planShuffle(
  players: SeededPlayer[],
  random: () => number = Math.random,
): SeedChange[] {
  const seeds = shuffled(players.map((p) => p.seed), random);
  return players.flatMap((p, i) => (seeds[i] === p.seed ? [] : [{ id: p.id, seed: seeds[i] }]));
}

/**
 * Turns a database error from a seed write into something actionable. The
 * old players_event_seed_idx index (pre-deferrable schema) rejects every swap.
 */
export function explainSeedWriteError(message: string): string {
  if (message.includes("players_event_seed_idx")) {
    return "The database still has the old seed index, which blocks seed swaps. " +
      "Re-run db/schema.sql in the Supabase SQL editor (it's safe to re-run), then try again.";
  }
  return message;
}
