// Pure helpers for tournaments (rows in `events`). No I/O.
// The current tournament is always the newest event; older ones are kept as
// history until deleted from TD Control.

export const MAX_EVENT_NAME = 80;

/** Tidies a tournament name, or explains why it can't be used. */
export function parseEventName(name: unknown): { name: string } | { error: string } {
  const tidy = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!tidy) return { error: "Tournament name required" };
  if (tidy.length > MAX_EVENT_NAME) return { error: `Keep the name under ${MAX_EVENT_NAME} characters` };
  return { name: tidy };
}

/**
 * A starting name for the next tournament: the current name with an older
 * year bumped to `year` ("Spring Champs 2026" → "Spring Champs 2027").
 */
export function suggestEventName(current: string | null | undefined, year: number): string {
  if (!current) return `Spring Champs ${year}`;
  return current.replace(/\b(20\d\d)\b/, (found) => (Number(found) < year ? String(year) : found));
}
