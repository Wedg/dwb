import { describe, expect, it } from "vitest";
import {
  checkName,
  explainSeedWriteError,
  freeSeeds,
  parseNames,
  planAddPlayers,
  planSetSeed,
  planShuffle,
  RosterError,
  type SeededPlayer,
} from "./seeding";

const roster = (...seeds: number[]): SeededPlayer[] =>
  seeds.map((seed) => ({ id: `p${seed}`, name: `Player ${seed}`, seed }));

/** Applies changes the way the single upsert does, then returns seeds by id. */
const apply = (players: SeededPlayer[], changes: { id: string; seed: number }[]) => {
  const next = new Map(players.map((p) => [p.id, p.seed]));
  for (const c of changes) next.set(c.id, c.seed);
  return next;
};

/** Small deterministic PRNG so shuffle tests don't flake. */
const mulberry32 = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("parseNames", () => {
  it("splits on newlines, trims, and drops blank lines", () => {
    expect(parseNames("  Alice \n\nBob\r\n   \nCarol Smith\n")).toEqual(["Alice", "Bob", "Carol Smith"]);
  });

  it("strips list numbering and bullets", () => {
    expect(parseNames("1. Alice\n2) Bob\n- Carol\n• Dan\n10.Eve")).toEqual(["Alice", "Bob", "Carol", "Dan", "Eve"]);
  });

  it("keeps initials and digits inside names", () => {
    expect(parseNames("J. Smith\nKarpov 2")).toEqual(["J. Smith", "Karpov 2"]);
  });
});

describe("freeSeeds", () => {
  it("returns the lowest unused seeds", () => {
    expect(freeSeeds([1, 2, 4], 3)).toEqual([3, 5, 6]);
  });

  it("returns every seed when none are taken", () => {
    expect(freeSeeds([])).toHaveLength(16);
  });

  it("returns nothing when the roster is full", () => {
    expect(freeSeeds(roster(...Array.from({ length: 16 }, (_, i) => i + 1)).map((p) => p.seed))).toEqual([]);
  });
});

describe("checkName", () => {
  it("rejects blanks", () => {
    expect(() => checkName([], "   ")).toThrow(RosterError);
  });

  it("rejects a name already on the roster, ignoring case and spacing", () => {
    expect(() => checkName([{ name: "Magnus Carlsen" }], " magnus  carlsen")).toThrow(/already on the roster/);
  });

  it("lets a player keep their own name when renaming", () => {
    expect(checkName([{ id: "a", name: "Alice" }], "alice ", "a")).toBe("alice");
  });
});

describe("planAddPlayers", () => {
  it("gives names the lowest free seeds in list order", () => {
    const existing = [{ name: "Alice", seed: 1 }, { name: "Bob", seed: 3 }];
    expect(planAddPlayers(existing, [{ name: "Carol" }, { name: "Dan" }])).toEqual([
      { name: "Carol", seed: 2 },
      { name: "Dan", seed: 4 },
    ]);
  });

  it("fills a full roster of 16 from scratch", () => {
    const rows = planAddPlayers([], Array.from({ length: 16 }, (_, i) => ({ name: `P${i}` })));
    expect(rows.map((r) => r.seed)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1));
  });

  it("honours an explicit seed and works around it", () => {
    expect(planAddPlayers([], [{ name: "Alice" }, { name: "Bob", seed: 1 }])).toEqual([
      { name: "Alice", seed: 2 },
      { name: "Bob", seed: 1 },
    ]);
  });

  it("rejects a taken or out-of-range explicit seed", () => {
    expect(() => planAddPlayers([{ name: "Alice", seed: 5 }], [{ name: "Bob", seed: 5 }])).toThrow(/Seed 5 already taken/);
    expect(() => planAddPlayers([], [{ name: "Bob", seed: 17 }])).toThrow(/1\.\.16/);
  });

  it("rejects more names than there are spots", () => {
    const existing = Array.from({ length: 15 }, (_, i) => ({ name: `P${i}`, seed: i + 1 }));
    expect(() => planAddPlayers(existing, [{ name: "X" }, { name: "Y" }])).toThrow(/Only 1 spot left/);
    expect(() => planAddPlayers([...existing, { name: "P15", seed: 16 }], [{ name: "X" }])).toThrow(/Already have 16/);
  });

  it("rejects duplicates against the roster and within the batch", () => {
    expect(() => planAddPlayers([{ name: "Alice", seed: 1 }], [{ name: "alice" }])).toThrow(/already on the roster/);
    expect(() => planAddPlayers([], [{ name: "Bob" }, { name: "Bob" }])).toThrow(/listed twice/);
  });

  it("rejects an empty batch", () => {
    expect(() => planAddPlayers([], [])).toThrow(RosterError);
  });
});

describe("planSetSeed", () => {
  it("swaps with whoever holds the target seed", () => {
    expect(planSetSeed(roster(1, 2, 3), "p3", 2)).toEqual([
      { id: "p3", seed: 2 },
      { id: "p2", seed: 3 },
    ]);
  });

  it("moves into a free seed without touching anyone else", () => {
    expect(planSetSeed(roster(1, 2), "p2", 9)).toEqual([{ id: "p2", seed: 9 }]);
  });

  it("is a no-op when the seed doesn't change", () => {
    expect(planSetSeed(roster(1, 2), "p1", 1)).toEqual([]);
  });

  it("rejects unknown players and invalid seeds", () => {
    expect(() => planSetSeed(roster(1), "nope", 2)).toThrow(/not found/);
    expect(() => planSetSeed(roster(1), "p1", 0)).toThrow(RosterError);
    expect(() => planSetSeed(roster(1), "p1", 2.5)).toThrow(RosterError);
  });
});

describe("planShuffle", () => {
  const full = roster(...Array.from({ length: 16 }, (_, i) => i + 1));

  it("produces a permutation of the existing seeds", () => {
    const after = apply(full, planShuffle(full, mulberry32(1)));
    expect([...after.values()].sort((a, b) => a - b)).toEqual(full.map((p) => p.seed));
  });

  it("only returns players whose seed changed", () => {
    for (const change of planShuffle(full, mulberry32(2))) {
      expect(full.find((p) => p.id === change.id)!.seed).not.toBe(change.seed);
    }
  });

  it("keeps gaps in the seed list where they are", () => {
    const partial = roster(1, 2, 5, 9);
    const after = apply(partial, planShuffle(partial, mulberry32(3)));
    expect([...after.values()].sort((a, b) => a - b)).toEqual([1, 2, 5, 9]);
  });

  it("handles empty and single-player rosters", () => {
    expect(planShuffle([])).toEqual([]);
    expect(planShuffle(roster(4))).toEqual([]);
  });

  it("is uniform: every player is equally likely to land on every seed", () => {
    const four = roster(1, 2, 3, 4);
    const random = mulberry32(42);
    const runs = 24_000;
    const counts = new Map<string, number>();
    for (let i = 0; i < runs; i++) {
      for (const [id, seed] of apply(four, planShuffle(four, random))) {
        counts.set(`${id}@${seed}`, (counts.get(`${id}@${seed}`) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(16);
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(runs / 4 * 0.95);
      expect(n).toBeLessThan(runs / 4 * 1.05);
    }
  });
});

describe("explainSeedWriteError", () => {
  it("points at schema.sql when the old unique index is still in place", () => {
    expect(
      explainSeedWriteError('duplicate key value violates unique constraint "players_event_seed_idx"'),
    ).toMatch(/Re-run db\/schema\.sql/);
  });

  it("passes other errors through", () => {
    expect(explainSeedWriteError("boom")).toBe("boom");
  });
});
