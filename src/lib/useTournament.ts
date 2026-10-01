// Client hooks for the public pages: the current tournament's data, kept
// fresh, and which player this phone is following. Browser only.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import type { ViewMatch } from "./tournament";

export type TournamentPlayer = { id: string; name: string; seed: number | null };

export type TournamentData = {
  event: { id: string; name: string | null } | null;
  players: TournamentPlayer[];
  matches: ViewMatch[];
  /** True until the first load finishes. */
  loading: boolean;
  /** Set when the first load fails or there's no tournament yet. */
  error: string | null;
  /** A background refresh failed; the data shown is from `updatedAt`. */
  stale: boolean;
  updatedAt: number | null;
};

const REFRESH_MS = 30_000;
const MATCH_COLUMNS = "id,bracket,stage,team_a,team_b,winner,feeds_winner_to,feeds_loser_to";

const INITIAL: TournamentData = {
  event: null,
  players: [],
  matches: [],
  loading: true,
  error: null,
  stale: false,
  updatedAt: null,
};

const messageOf = (error: unknown) =>
  (error as { message?: string } | null)?.message ?? "Couldn't load the tournament";

/**
 * Loads the current tournament (the newest event) with its players and
 * matches, and keeps it fresh: every 30 seconds while the page is on screen,
 * and straight away when it comes back into view (phone unlocked, tab
 * switched back). A failed refresh keeps showing the last good data.
 */
export function useTournament() {
  const [data, setData] = useState<TournamentData>(INITIAL);
  const mounted = useRef(true);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const startedAt = useRef(0);

  const load = useCallback(async () => {
    startedAt.current = Date.now();
    try {
      const { data: event, error: evErr } = await supabase
        .from("events")
        .select("id,name")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (evErr) throw evErr;
      if (!event) {
        if (mounted.current) {
          setData({ ...INITIAL, loading: false, error: "No tournament has been set up yet.", updatedAt: Date.now() });
        }
        return;
      }
      const [players, matches] = await Promise.all([
        supabase.from("players").select("id,name,seed").eq("event_id", event.id),
        supabase.from("matches").select(MATCH_COLUMNS).eq("event_id", event.id),
      ]);
      if (players.error) throw players.error;
      if (matches.error) throw matches.error;
      if (mounted.current) {
        setData({
          event,
          players: players.data ?? [],
          matches: (matches.data ?? []) as ViewMatch[],
          loading: false,
          error: null,
          stale: false,
          updatedAt: Date.now(),
        });
      }
    } catch (error: unknown) {
      if (!mounted.current) return;
      setData((prev) =>
        prev.updatedAt && !prev.error
          ? { ...prev, stale: true }
          : { ...prev, loading: false, error: messageOf(error) },
      );
    }
  }, []);

  /** Reloads now. A call made mid-load runs once more after it, so nothing is missed. */
  const refresh = useCallback((): Promise<void> => {
    if (running.current) {
      again.current = true;
      return running.current;
    }
    running.current = (async () => {
      do {
        again.current = false;
        await load();
      } while (again.current && mounted.current);
    })().finally(() => {
      running.current = null;
    });
    return running.current;
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    // Returning to a tab fires both focus and visibilitychange; one load is enough.
    const onShow = () => {
      if (document.visibilityState === "visible" && Date.now() - startedAt.current > 2_000) void refresh();
    };
    const timer = window.setInterval(onShow, REFRESH_MS);
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [refresh]);

  return { ...data, refresh };
}

const FOLLOW_KEY = "dwb_follow_player";
const FOLLOW_EVENT = "dwb-follow-change";

/**
 * The player this phone follows, remembered in localStorage. Only returns
 * someone in the current tournament, so last year's choice is ignored.
 */
export function useFollowedPlayer(players: TournamentPlayer[]): [string | null, (id: string | null) => void] {
  const [stored, setStored] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        setStored(localStorage.getItem(FOLLOW_KEY));
      } catch {
        // storage blocked (private mode); following just won't be remembered
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener(FOLLOW_EVENT, read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener(FOLLOW_EVENT, read);
    };
  }, []);

  const follow = useCallback((id: string | null) => {
    try {
      if (id) localStorage.setItem(FOLLOW_KEY, id);
      else localStorage.removeItem(FOLLOW_KEY);
    } catch {
      // storage blocked; still follow for this visit
    }
    setStored(id);
    window.dispatchEvent(new Event(FOLLOW_EVENT));
  }, []);

  const followed = stored && players.some((p) => p.id === stored) ? stored : null;
  return [followed, follow];
}
