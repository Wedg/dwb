import type { Bracket } from "@/lib/bracket";

/** Each trophy's tint, used for the bracket cards on Brackets and Matches. */
export const BRACKET_THEMES: Record<Bracket, { border: string; glow: string; header: string }> = {
  MAIN: {
    border: "rgba(129, 140, 248, 0.45)",
    glow: "rgba(99, 102, 241, 0.25)",
    header: "linear-gradient(90deg, rgba(129, 140, 248, 0.18), transparent)",
  },
  LOWER: {
    border: "rgba(45, 212, 191, 0.45)",
    glow: "rgba(20, 184, 166, 0.22)",
    header: "linear-gradient(90deg, rgba(45, 212, 191, 0.18), transparent)",
  },
  DOUBLES: {
    border: "rgba(251, 191, 36, 0.55)",
    glow: "rgba(251, 146, 60, 0.26)",
    header: "linear-gradient(90deg, rgba(251, 191, 36, 0.2), transparent)",
  },
};
