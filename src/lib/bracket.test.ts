import { describe, expect, it } from "vitest";
import {
  canonicalPairs,
  drawOrder,
  findCanonicalSlot,
  pairLosersIntoDoublesTeams,
  planDoublesSwaps,
  planPlaceTeam,
  planRemoveTeam,
  qfWiringOrder,
  r1SlotToQfIndex,
  resultChangeProblem,
  shuffled,
  type MatchSlots,
  type WiredMatch,
} from "./bracket";

const empty = (): MatchSlots => ({ team_a: [], team_b: [], winner: null });

describe("canonicalPairs", () => {
  it("returns 8 pairs", () => {
    expect(canonicalPairs()).toHaveLength(8);
  });

  it("covers seeds 1..16 exactly once", () => {
    const seen = new Set<number>();
    for (const [a, b] of canonicalPairs()) {
      expect(seen.has(a)).toBe(false);
      expect(seen.has(b)).toBe(false);
      seen.add(a);
      seen.add(b);
    }
    expect(seen.size).toBe(16);
    for (let s = 1; s <= 16; s++) expect(seen.has(s)).toBe(true);
  });
});

describe("findCanonicalSlot", () => {
  it("finds slot 0 for [1,16]", () => {
    expect(findCanonicalSlot(1, 16)).toBe(0);
    expect(findCanonicalSlot(16, 1)).toBe(0);
  });

  it("finds slot 4 for [3,14]", () => {
    expect(findCanonicalSlot(3, 14)).toBe(4);
  });

  it("returns -1 for non-canonical pair", () => {
    expect(findCanonicalSlot(1, 2)).toBe(-1);
  });
});

describe("r1SlotToQfIndex", () => {
  it("maps R1 slots to QF indices", () => {
    expect(r1SlotToQfIndex(0)).toBe(0);
    expect(r1SlotToQfIndex(1)).toBe(0);
    expect(r1SlotToQfIndex(2)).toBe(1);
    expect(r1SlotToQfIndex(3)).toBe(1);
    expect(r1SlotToQfIndex(4)).toBe(2);
    expect(r1SlotToQfIndex(5)).toBe(2);
    expect(r1SlotToQfIndex(6)).toBe(3);
    expect(r1SlotToQfIndex(7)).toBe(3);
  });
});

describe("planPlaceTeam — first placement", () => {
  it("places team into empty A when both slots empty", () => {
    expect(planPlaceTeam(empty(), ["P1"], ["P2"])).toEqual({ team_a: ["P1"] });
  });

  it("places team into empty B when A is occupied by an unrelated team", () => {
    const next: MatchSlots = { team_a: ["X"], team_b: [], winner: null };
    expect(planPlaceTeam(next, ["P1"], ["P2"])).toEqual({ team_b: ["P1"] });
  });

  it("returns null when team is empty", () => {
    expect(planPlaceTeam(empty(), [], ["P2"])).toBeNull();
  });

  it("returns null when next match is decided", () => {
    const next: MatchSlots = { team_a: [], team_b: [], winner: "A" };
    expect(planPlaceTeam(next, ["P1"], ["P2"])).toBeNull();
  });

  it("returns null when team already in A", () => {
    const next: MatchSlots = { team_a: ["P1"], team_b: [], winner: null };
    expect(planPlaceTeam(next, ["P1"], ["P2"])).toBeNull();
  });

  it("returns null when team already in B", () => {
    const next: MatchSlots = { team_a: [], team_b: ["P1"], winner: null };
    expect(planPlaceTeam(next, ["P1"], ["P2"])).toBeNull();
  });

  it("returns null when both slots filled with unrelated teams", () => {
    const next: MatchSlots = { team_a: ["X"], team_b: ["Y"], winner: null };
    expect(planPlaceTeam(next, ["P1"], ["P2"])).toBeNull();
  });
});

describe("planPlaceTeam — re-correction (changed winner)", () => {
  it("replaces opponent in A with new team when winner is corrected", () => {
    // R1 had winner=Alice, loser=Bob. Alice was placed in QF.team_a.
    // TD now changes winner to Bob → place team=[Bob], opponent=[Alice].
    const next: MatchSlots = { team_a: ["Alice"], team_b: [], winner: null };
    const patch = planPlaceTeam(next, ["Bob"], ["Alice"]);
    expect(patch).toEqual({ team_a: ["Bob"] });
  });

  it("replaces opponent in B with new team when winner is corrected", () => {
    const next: MatchSlots = { team_a: ["Other"], team_b: ["Alice"], winner: null };
    const patch = planPlaceTeam(next, ["Bob"], ["Alice"]);
    expect(patch).toEqual({ team_b: ["Bob"] });
  });

  it("does nothing if next match is already decided", () => {
    const next: MatchSlots = { team_a: ["Alice"], team_b: ["X"], winner: "A" };
    expect(planPlaceTeam(next, ["Bob"], ["Alice"])).toBeNull();
  });
});

describe("planPlaceTeam — doubles partial fill", () => {
  it("upgrades a single-id slot to the full doubles team", () => {
    // Edge case where a doubles slot was somehow populated with one player only.
    const next: MatchSlots = { team_a: ["P1"], team_b: [], winner: null };
    const patch = planPlaceTeam(next, ["P1", "P2"], ["P3", "P4"]);
    expect(patch).toEqual({ team_a: ["P1", "P2"] });
  });
});

describe("planRemoveTeam", () => {
  it("clears team_a if it equals the team", () => {
    const next: MatchSlots = { team_a: ["P1"], team_b: ["P2"], winner: null };
    expect(planRemoveTeam(next, ["P1"])).toEqual({ team_a: [] });
  });

  it("clears team_b if it equals the team", () => {
    const next: MatchSlots = { team_a: ["P1"], team_b: ["P2"], winner: null };
    expect(planRemoveTeam(next, ["P2"])).toEqual({ team_b: [] });
  });

  it("does nothing if team not present", () => {
    const next: MatchSlots = { team_a: ["P1"], team_b: ["P2"], winner: null };
    expect(planRemoveTeam(next, ["P3"])).toBeNull();
  });

  it("does nothing on a decided match", () => {
    const next: MatchSlots = { team_a: ["P1"], team_b: ["P2"], winner: "A" };
    expect(planRemoveTeam(next, ["P1"])).toBeNull();
  });
});

describe("pairLosersIntoDoublesTeams", () => {
  it("pairs 8 losers into 4 teams and 2 SF matchups (1v4, 2v3)", () => {
    const losers = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"];
    const { teams, sfMatchups } = pairLosersIntoDoublesTeams(losers);
    expect(teams).toEqual([
      ["L1", "L2"],
      ["L3", "L4"],
      ["L5", "L6"],
      ["L7", "L8"],
    ]);
    expect(sfMatchups).toEqual([
      [
        ["L1", "L2"],
        ["L7", "L8"],
      ],
      [
        ["L3", "L4"],
        ["L5", "L6"],
      ],
    ]);
  });

  it("throws if not exactly 8 losers", () => {
    expect(() => pairLosersIntoDoublesTeams(["a", "b", "c"])).toThrow();
  });
});

// This is the test that would have caught the user's "couldn't move from R1 to next round"
// symptom from last year. It walks the full R1 → QF → SF → F path for the MAIN bracket.
describe("end-to-end singles propagation", () => {
  it("R1 winners reach the correct QFs based on canonical slot mapping", () => {
    // 16 players P1..P16, seeded 1..16 (P1 is seed 1, P16 is seed 16).
    const seedTo = (s: number) => `P${s}`;

    // Build the 8 R1 matches as { slotIndex, winnerSeed, loserSeed }
    const r1Results = canonicalPairs().map(([sa, sb], slotIndex) => ({
      slotIndex,
      // arbitrary: lower seed always wins
      winnerSeed: Math.min(sa, sb),
      loserSeed: Math.max(sa, sb),
    }));

    // Empty MAIN QFs (4 of them).
    const mainQfs: MatchSlots[] = Array.from({ length: 4 }, () => empty());
    const lowerQfs: MatchSlots[] = Array.from({ length: 4 }, () => empty());

    // Apply each R1 result: winner → main QF, loser → lower QF.
    for (const r of r1Results) {
      const qfIdx = r1SlotToQfIndex(r.slotIndex);
      const winnerTeam = [seedTo(r.winnerSeed)];
      const loserTeam = [seedTo(r.loserSeed)];

      const winPatch = planPlaceTeam(mainQfs[qfIdx], winnerTeam, loserTeam);
      if (winPatch?.team_a) mainQfs[qfIdx].team_a = winPatch.team_a;
      if (winPatch?.team_b) mainQfs[qfIdx].team_b = winPatch.team_b;

      const losePatch = planPlaceTeam(lowerQfs[qfIdx], loserTeam, winnerTeam);
      if (losePatch?.team_a) lowerQfs[qfIdx].team_a = losePatch.team_a;
      if (losePatch?.team_b) lowerQfs[qfIdx].team_b = losePatch.team_b;
    }

    // Each main QF should have exactly two players, both of which are winners.
    for (const qf of mainQfs) {
      expect(qf.team_a).toHaveLength(1);
      expect(qf.team_b).toHaveLength(1);
    }

    // QF0 = winners of R1 slots 0,1 = winners of [1,16] and [8,9] = P1 and P8
    expect(mainQfs[0]).toMatchObject({ team_a: ["P1"], team_b: ["P8"] });
    // QF1 = winners of R1 slots 2,3 = [5,12] and [4,13] = P5 and P4
    expect(mainQfs[1]).toMatchObject({ team_a: ["P5"], team_b: ["P4"] });
    // QF2 = winners of R1 slots 4,5 = [3,14] and [6,11] = P3 and P6
    expect(mainQfs[2]).toMatchObject({ team_a: ["P3"], team_b: ["P6"] });
    // QF3 = winners of R1 slots 6,7 = [7,10] and [2,15] = P7 and P2
    expect(mainQfs[3]).toMatchObject({ team_a: ["P7"], team_b: ["P2"] });

    // Lower QFs have the losers
    expect(lowerQfs[0]).toMatchObject({ team_a: ["P16"], team_b: ["P9"] });
    expect(lowerQfs[3]).toMatchObject({ team_a: ["P10"], team_b: ["P15"] });
  });

  it("changing an R1 winner correctly replaces the team in the QF", () => {
    // R1 slot 0 = [1,16]. P1 wins, gets placed in main QF0.team_a.
    let mainQf0: MatchSlots = empty();
    let lowerQf0: MatchSlots = empty();

    // Initial winner: P1
    let p = planPlaceTeam(mainQf0, ["P1"], ["P16"]);
    if (p) mainQf0 = { ...mainQf0, ...p };
    p = planPlaceTeam(lowerQf0, ["P16"], ["P1"]);
    if (p) lowerQf0 = { ...lowerQf0, ...p };
    expect(mainQf0.team_a).toEqual(["P1"]);
    expect(lowerQf0.team_a).toEqual(["P16"]);

    // R1 slot 1 = [8,9]. P8 wins, gets placed in main QF0.team_b.
    p = planPlaceTeam(mainQf0, ["P8"], ["P9"]);
    if (p) mainQf0 = { ...mainQf0, ...p };
    expect(mainQf0).toMatchObject({ team_a: ["P1"], team_b: ["P8"] });

    // TD now corrects R1 slot 0: P16 actually won, not P1.
    // Should clear P1 from main QF0 and install P16 in its place,
    // and clear P16 from lower QF0 and install P1.
    p = planPlaceTeam(mainQf0, ["P16"], ["P1"]);
    if (p) mainQf0 = { ...mainQf0, ...p };
    expect(mainQf0).toMatchObject({ team_a: ["P16"], team_b: ["P8"] });

    p = planPlaceTeam(lowerQf0, ["P1"], ["P16"]);
    if (p) lowerQf0 = { ...lowerQf0, ...p };
    expect(lowerQf0.team_a).toEqual(["P1"]);
  });
});

describe("shuffled", () => {
  it("returns a permutation and leaves the input alone", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffled(input);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("qfWiringOrder", () => {
  it("puts QFs that feed the same SF next to each other", () => {
    // Ids sort as a, b, c, d but a+c feed SF "s2" and b+d feed SF "s1":
    // sorting by id alone would pair the wrong QFs in each semi.
    const order = qfWiringOrder([
      { id: "a", feeds_winner_to: "s2" },
      { id: "b", feeds_winner_to: "s1" },
      { id: "c", feeds_winner_to: "s2" },
      { id: "d", feeds_winner_to: "s1" },
    ]);
    expect(order).toEqual(["b", "d", "a", "c"]);
  });

  it("wires R1 slots 0-3 into one semi and 4-7 into the other", () => {
    const sfOf = new Map([["q1", "sfX"], ["q2", "sfY"], ["q3", "sfX"], ["q4", "sfY"]]);
    const order = qfWiringOrder([...sfOf].map(([id, sf]) => ({ id, feeds_winner_to: sf })));
    const semiOfSlot = (slot: number) => sfOf.get(order[r1SlotToQfIndex(slot)]);
    for (const slot of [1, 2, 3]) expect(semiOfSlot(slot)).toBe(semiOfSlot(0));
    for (const slot of [5, 6, 7]) expect(semiOfSlot(slot)).toBe(semiOfSlot(4));
    expect(semiOfSlot(0)).not.toBe(semiOfSlot(4));
  });
});

describe("drawOrder", () => {
  // A fully wired MAIN + LOWER bracket with ids deliberately out of order.
  const seedOf = (id: string) => Number(id.slice(1)); // "P7" -> 7
  const m = (id: string, stage: WiredMatch["stage"], a: string[], b: string[], win: string | null, lose: string | null = null): WiredMatch => ({
    id, stage, team_a: a, team_b: b, feeds_winner_to: win, feeds_loser_to: lose,
  });
  const matches: WiredMatch[] = [
    m("f", "F", [], [], null),
    m("sf-z", "SF", [], [], "f"),
    m("sf-a", "SF", [], [], "f"),
    m("qf-1", "QF", [], [], "sf-z"),
    m("qf-2", "QF", [], [], "sf-a"),
    m("qf-3", "QF", [], [], "sf-z"),
    m("qf-4", "QF", [], [], "sf-a"),
    m("r1-h", "R1", ["P2"], ["P15"], "qf-4", "lqf"),
    m("r1-a", "R1", ["P7"], ["P10"], "qf-4", "lqf"),
    m("r1-g", "R1", ["P1"], ["P16"], "qf-1", "lqf"),
    m("r1-b", "R1", ["P9"], ["P8"], "qf-1", "lqf"),
    m("r1-c", "R1", ["P5"], ["P12"], "qf-3"),
    m("r1-d", "R1", ["P4"], ["P13"], "qf-3"),
    m("r1-e", "R1", ["P3"], ["P14"], "qf-2"),
    m("r1-f", "R1", ["P6"], ["P11"], "qf-2"),
    m("lqf", "QF", [], [], null),
  ];
  const ids = (stage: WiredMatch["stage"]) =>
    drawOrder(matches, seedOf).filter((x) => x.stage === stage).map((x) => x.id);

  it("orders R1 by canonical slot", () => {
    expect(ids("R1")).toEqual(["r1-g", "r1-b", "r1-c", "r1-d", "r1-e", "r1-f", "r1-a", "r1-h"]);
  });

  it("orders later rounds by the earliest slot feeding them", () => {
    // lqf (a Pudel König QF) is fed by the same R1 slots as qf-1, so it ties
    // with it; the pages show each bracket separately, so ties only meet by id.
    expect(ids("QF")).toEqual(["lqf", "qf-1", "qf-3", "qf-2", "qf-4"]);
    expect(ids("SF")).toEqual(["sf-z", "sf-a"]);
  });

  it("puts unfed matches last, by id", () => {
    const loose = [m("y", "SF", [], [], "f"), m("x", "SF", [], [], "f"), m("f", "F", [], [], null)];
    expect(drawOrder(loose, seedOf).map((x) => x.id)).toEqual(["f", "x", "y"]);
  });
});

describe("resultChangeProblem", () => {
  const played: MatchSlots = { team_a: ["P1"], team_b: ["P2"], winner: null };

  it("allows a first result", () => {
    expect(resultChangeProblem(played, "A", false)).toBeNull();
  });

  it("refuses a winner while a side is still TBD", () => {
    expect(resultChangeProblem({ ...played, team_b: [] }, "A", false)).toMatch(/need players/);
  });

  it("allows correcting a result until the next match is decided", () => {
    const decided: MatchSlots = { ...played, winner: "A" };
    expect(resultChangeProblem(decided, "B", false)).toBeNull();
    expect(resultChangeProblem(decided, null, false)).toBeNull();
    expect(resultChangeProblem(decided, "B", true)).toMatch(/Clear that result first/);
    expect(resultChangeProblem(decided, null, true)).toMatch(/Clear that result first/);
  });

  it("treats re-saving the same result as fine", () => {
    expect(resultChangeProblem({ ...played, winner: "A" }, "A", true)).toBeNull();
    expect(resultChangeProblem(played, null, true)).toBeNull();
  });
});

describe("planDoublesSwaps", () => {
  // Eight QFs: QF i is "Wi" vs "Li", and A (Wi) won.
  const qfs = (): MatchSlots[] =>
    Array.from({ length: 8 }, (_, i) => ({ team_a: [`W${i}`], team_b: [`L${i}`], winner: "A" as const }));
  const drawn = ["L3", "L0", "L6", "L1", "L2", "L7", "L4", "L5"];

  it("is empty when the draw matches the QF losers", () => {
    expect(planDoublesSwaps(qfs(), drawn)).toEqual(new Map());
  });

  it("swaps in whoever now lost a corrected QF", () => {
    const corrected = qfs();
    corrected[6] = { ...corrected[6], winner: "B" }; // L6 actually won, W6 lost
    corrected[1] = { ...corrected[1], winner: "B" };
    expect(planDoublesSwaps(corrected, drawn)).toEqual(new Map([["L6", "W6"], ["L1", "W1"]]));
  });

  it("gives up when a drawn player isn't in any QF any more", () => {
    const changed = qfs();
    changed[2] = { team_a: ["W2"], team_b: ["NEW"], winner: "A" }; // R1 correction moved players
    expect(planDoublesSwaps(changed, drawn)).toBeNull();
  });

  it("gives up when a QF has no result", () => {
    const open = qfs();
    open[0] = { ...open[0], winner: null };
    expect(planDoublesSwaps(open, drawn)).toBeNull();
  });
});
