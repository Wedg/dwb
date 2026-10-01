"use client";

import { useEffect, useState } from "react";

const ago = (ms: number) => {
  const seconds = Math.round(ms / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  return minutes <= 1 ? "1 min ago" : `${minutes} min ago`;
};

/** "Updated just now · Refresh". Pages refresh themselves; this shows how fresh they are. */
export function LastUpdated({
  updatedAt,
  stale,
  onRefresh,
}: {
  updatedAt: number | null;
  stale: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!updatedAt) return null;
  const since = ago(Math.max(now, updatedAt) - updatedAt);

  return (
    <p className="flex flex-wrap items-center justify-center gap-x-2 text-xs text-[color:var(--muted)]">
      <span>{stale ? `Couldn't reach the server · last updated ${since}` : `Updated ${since}`}</span>
      <span aria-hidden>·</span>
      <button
        type="button"
        disabled={refreshing}
        onClick={async () => {
          setRefreshing(true);
          await onRefresh();
          setNow(Date.now());
          setRefreshing(false);
        }}
        className="font-semibold text-[color:var(--foreground)] underline-offset-4 hover:underline disabled:opacity-60"
      >
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </p>
  );
}
