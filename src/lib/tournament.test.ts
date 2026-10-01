import { describe, expect, it } from "vitest";
import {
  buildView,
  champion,
  currentRound,
  describeJourney,
  matchState,
  playerJourney,
  sideViews,
  waitingLabels,
  type ViewMatch,
} from "./tournament";

const m = (
  id: string,
  bracket: ViewMatch["bracket"],
  stage: ViewMatch["stage"],
  team_a: string[],
  team_b: string[],
  winner: ViewMatch["winner"] = null,
  feeds_winner_to: string | null = null,
  feeds_loser_to: string | null = null,
): ViewMatch => ({ id, bracket, stage, team_a, team_b, winner, feeds_winner_to, feeds_loser_to });

const seedOf = (id: string) => Number(id.slice(1)); // "P7" -> 7
const nameOf = (id: string) => id;

// Part of a night: R1 slot 0 (1v16) is played, slot 1 (8v9) isn't; slot 2
// (5v12) is played. Doubles have been drawn but not played.
const night = (): ViewMatch[] => [
  m("r1", "MAIN", "R1", ["P1"], ["P16"], "A", "qf1", "lq1"),
  m("r2", "MAIN", "R1", ["P8"], ["P9"], null, "qf1", "lq1"),
  m("r3", "MAIN", "R1", ["P5"], ["P12"], "B", "qf2", "lq2"),
  m("qf1", "MAIN", "QF", ["P1"], [], null, "sf1"),
  m("qf2", "MAIN", "QF", ["P12"], [], null, "sf1"),
  m("lq1", "LOWER", "QF", ["P16"], []),
  m("lq2", "LOWER", "QF", ["P5"], []),
  m("sf1", "MAIN", "SF", [], [], null, "f1"),
  m("f1", "MAIN", "F", [], []),
  m("dsf1", "DOUBLES", "SF", ["P2", "P3"], ["P4", "P6"], null, "df"),
  m("dsf2", "DOUBLES", "SF", ["P7", "P10"], ["P11", "P13"], null, "df"),
  m("df", "DOUBLES", "F", [], []),
];

describe("matchState", () => {
  it("tells decided, ready and waiting apart", () => {
    const [r1, r2, , qf1] = night();
    expect(matchState(r1)).toBe("decided");
    expect(matchState(r2)).toBe("ready");
    expect(matchState(qf1)).toBe("waiting");
  });
});

describe("waitingLabels", () => {
  const all = night();
  const view = buildView(all, seedOf);
  const get = (id: string) => all.find((x) => x.id === id)!;

  it("names the match a winner is coming from", () => {
    expect(waitingLabels(get("qf1"), view, nameOf)).toEqual(["", "Winner of P8 v P9"]);
  });

  it("says Loser for the Pudel König slots", () => {
    expect(waitingLabels(get("lq1"), view, nameOf)).toEqual(["", "Loser of P8 v P9"]);
  });

  it("falls back to numbered matches when the feeder isn't set yet", () => {
    expect(waitingLabels(get("sf1"), view, nameOf)).toEqual(["Winner of Quarterfinal 1", "Winner of Quarterfinal 2"]);
  });

  it("numbers doubles semis instead of listing four names", () => {
    expect(waitingLabels(get("df"), view, nameOf)).toEqual(["Winners of Semifinal 1", "Winners of Semifinal 2"]);
  });

  it("skips feeders whose team has already arrived", () => {
    const later = night().map((x) =>
      x.id === "dsf1" ? { ...x, winner: "A" as const } : x.id === "df" ? { ...x, team_a: ["P2", "P3"] } : x,
    );
    const df = later.find((x) => x.id === "df")!;
    expect(waitingLabels(df, buildView(later, seedOf), nameOf)).toEqual(["", "Winners of Semifinal 2"]);
  });
});

describe("sideViews", () => {
  it("marks winner, loser and the followed player", () => {
    const all = night();
    const [a, b] = sideViews(all[2], buildView(all, seedOf), nameOf, "P5");
    expect(a).toMatchObject({ label: "P5", won: false, lost: true, followed: true, placeholder: false });
    expect(b).toMatchObject({ label: "P12", won: true, lost: false, followed: false });
  });

  it("joins doubles partners", () => {
    const all = night();
    const [a] = sideViews(all.find((x) => x.id === "dsf1")!, buildView(all, seedOf), nameOf);
    expect(a.label).toBe("P2 + P3");
  });
});

describe("currentRound", () => {
  it("is the earliest round with a match ready to play", () => {
    expect(currentRound("MAIN", night())).toBe("R1");
    expect(currentRound("DOUBLES", night())).toBe("SF");
  });

  it("moves on when a round is finished", () => {
    const later = night().map((x) => (x.id === "r2" ? { ...x, winner: "A" as const } : x.id === "qf1" ? { ...x, team_b: ["P8"] } : x));
    expect(currentRound("MAIN", later)).toBe("QF");
  });

  it("lands on the final once everything is played, and is null with no matches", () => {
    const done = [m("sf", "LOWER", "SF", ["P1"], ["P2"], "A", "f"), m("f", "LOWER", "F", ["P1"], ["P3"], "B")];
    expect(currentRound("LOWER", done)).toBe("F");
    expect(currentRound("LOWER", [])).toBeNull();
  });
});

describe("champion", () => {
  it("is null until the final has a result", () => {
    expect(champion("MAIN", night())).toBeNull();
  });

  it("returns the winner and runner-up", () => {
    const done = [m("f", "DOUBLES", "F", ["P2", "P3"], ["P7", "P10"], "B")];
    expect(champion("DOUBLES", done)).toEqual({ winner: ["P7", "P10"], runnerUp: ["P2", "P3"] });
  });
});

describe("playerJourney", () => {
  it("knows nothing before the draw", () => {
    expect(playerJourney("P1", [])).toEqual({ kind: "not-drawn" });
  });

  it("finds the unfinished match, ready or waiting", () => {
    expect(playerJourney("P8", night())).toMatchObject({ kind: "playing", side: "A", match: { id: "r2" } });
    expect(playerJourney("P1", night())).toMatchObject({ kind: "playing", side: "A", match: { id: "qf1" } });
    expect(playerJourney("P16", night())).toMatchObject({ kind: "playing", match: { id: "lq1" } });
    expect(playerJourney("P3", night())).toMatchObject({ kind: "playing", side: "A", match: { id: "dsf1" } });
  });

  it("sends quarterfinal losers to the doubles", () => {
    const qfLost = [m("q", "LOWER", "QF", ["P5"], ["P9"], "B", "s"), m("r", "MAIN", "R1", ["P5"], ["P12"], "B")];
    expect(playerJourney("P5", qfLost)).toEqual({ kind: "doubles-pending" });
  });

  it("crowns final winners and knows when someone is out", () => {
    const done = [
      m("s", "MAIN", "SF", ["P1"], ["P4"], "A", "f"),
      m("f", "MAIN", "F", ["P1"], ["P2"], "A"),
    ];
    expect(playerJourney("P1", done)).toMatchObject({ kind: "champion", match: { id: "f" } });
    expect(playerJourney("P2", done)).toMatchObject({ kind: "out", match: { id: "f" } });
    expect(playerJourney("P4", done)).toMatchObject({ kind: "out", match: { id: "s" } });
  });

  it("says through when the next match isn't set up yet", () => {
    expect(playerJourney("P1", [m("q", "MAIN", "QF", ["P1"], ["P8"], "A")])).toMatchObject({ kind: "through" });
  });
});

describe("describeJourney", () => {
  const say = (id: string, all: ViewMatch[]) => describeJourney(id, playerJourney(id, all), buildView(all, seedOf), nameOf);

  it("names the opponent when both are known", () => {
    expect(say("P8", night())).toEqual({ headline: "Up next: Round 1 v P9", detail: "DwB Spring Champs" });
  });

  it("says who they're waiting for", () => {
    expect(say("P1", night())).toEqual({ headline: "Next: Quarterfinal", detail: "v winner of P8 v P9 · DwB Spring Champs" });
  });

  it("mentions the doubles partner", () => {
    expect(say("P3", night())).toEqual({
      headline: "Up next: Semifinal v P4 + P6",
      detail: "With P2 · Anthony Prangley Twin Bishops and Bar Bill",
    });
  });

  it("celebrates champions and thanks the rest", () => {
    const done = [m("s", "LOWER", "SF", ["P1"], ["P4"], "A", "f"), m("f", "LOWER", "F", ["P1"], ["P2"], "B")];
    expect(say("P2", done)).toEqual({ headline: "Won the Pudel König!", detail: "Beat P1 in the final.", trophy: true });
    expect(say("P1", done)).toEqual({ headline: "Runner-up", detail: "Pudel König" });
    expect(say("P4", done)).toEqual({ headline: "Out in the semifinal", detail: "Pudel König · thanks for playing!" });
  });

  it("covers the doubles wait and the empty draw", () => {
    expect(say("P5", [m("q", "MAIN", "QF", ["P5"], ["P9"], "B")]).headline).toBe("Into the doubles");
    expect(say("P5", []).headline).toBe("The draw hasn't been made yet");
  });
});
