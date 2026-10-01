import { TrophyIcon } from "@/components/icons";

/** Shown at the top of a bracket once its final has a result. */
export function ChampionBanner({
  winner,
  runnerUp,
  pair,
}: {
  winner: string;
  runnerUp: string;
  /** Doubles: "Champions". */
  pair?: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[color:var(--accent)] bg-[color:var(--highlight)] p-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)]">
        <TrophyIcon className="h-7 w-7" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[color:var(--muted)]">
          {pair ? "Champions" : "Champion"}
        </p>
        <p className="break-words text-lg font-semibold text-[color:var(--foreground)]">{winner}</p>
        <p className="break-words text-xs text-[color:var(--muted)]">Beat {runnerUp} in the final</p>
      </div>
    </div>
  );
}
