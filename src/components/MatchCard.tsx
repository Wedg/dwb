import type { ReactNode } from "react";
import type { Side } from "@/lib/bracket";
import type { SideView } from "@/lib/tournament";
import { CheckIcon, StarIcon } from "@/components/icons";

type Props = {
  sides: [SideView, SideView];
  /** Both players known and no result yet. */
  ready: boolean;
  /** Small label above the players, e.g. "Quarterfinal 2". */
  heading?: string;
  /** TD mode: the sides become buttons that record the winner. */
  onPick?: (side: Side) => void;
  busy?: boolean;
  footer?: ReactNode;
};

/**
 * One match: the winner in bold with a tick, the loser greyed out, empty
 * sides saying who they're waiting for, and the followed player starred.
 */
export function MatchCard({ sides, ready, heading, onPick, busy, footer }: Props) {
  const followed = sides.some((s) => s.followed);
  const pickable = !sides[0].placeholder && !sides[1].placeholder;

  return (
    <article
      className={`rounded-2xl border bg-[color:var(--card)] p-2.5 shadow-sm ${
        followed ? "border-[color:var(--accent)] ring-1 ring-[color:var(--accent)]" : "border-[color:var(--border)]"
      }`}
    >
      {(heading || ready) && (
        <div className="flex items-center justify-between gap-2 px-1.5 pb-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {heading}
          </span>
          {ready && (
            <span className="rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--accent-contrast)]">
              Up next
            </span>
          )}
        </div>
      )}

      <div className="space-y-1">
        {sides.map((s) => {
          const content = (
            <>
              <span
                className={`min-w-0 break-words ${
                  s.placeholder
                    ? "italic text-[color:var(--muted)]"
                    : s.lost
                      ? "text-[color:var(--muted)]"
                      : s.won
                        ? "font-semibold text-[color:var(--foreground)]"
                        : "font-medium text-[color:var(--foreground)]"
                }`}
              >
                {s.label}
              </span>
              <span className="flex shrink-0 items-center gap-1.5 text-[color:var(--foreground)]">
                {s.followed && (
                  <>
                    <StarIcon />
                    <span className="sr-only">(following)</span>
                  </>
                )}
                {s.won && (
                  <>
                    <CheckIcon />
                    <span className="sr-only">(winner)</span>
                  </>
                )}
              </span>
            </>
          );
          const base = `flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm ${
            s.won ? "bg-[color:var(--highlight)]" : ""
          }`;

          return onPick ? (
            <button
              key={s.side}
              type="button"
              onClick={() => onPick(s.side)}
              disabled={busy || !pickable || s.won}
              className={`${base} border transition enabled:cursor-pointer enabled:hover:border-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-default ${
                s.won ? "border-[color:var(--accent)]" : "border-[color:var(--border)]"
              }`}
            >
              {content}
            </button>
          ) : (
            <div key={s.side} className={base}>
              {content}
            </div>
          );
        })}
      </div>

      {footer}
    </article>
  );
}
