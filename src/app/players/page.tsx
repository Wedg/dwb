"use client";

import { useEffect, useMemo, useState } from "react";
import { ensurePin, adminFetch } from "@/lib/adminClient";
import { supabase } from "@/lib/supabaseClient";

type Player = { id: string; name: string; seed: number | null };

const inputClassName =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] shadow-sm transition focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 focus:ring-offset-[color:var(--background)]";

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [seed, setSeed] = useState<number | "">("");
  const [msg, setMsg] = useState<string | null>(null);

  const hasRoster = players.length > 0;
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0)),
    [players]
  );

  async function load() {
    const { data: ev } = await supabase
      .from("events")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ev?.id) return;
    const { data } = await supabase
      .from("players")
      .select("id,name,seed")
      .eq("event_id", ev.id)
      .order("seed", { ascending: true });
    setPlayers(data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addPlayer() {
    if (!ensurePin()) return;
    try {
      await adminFetch("/api/admin/players/add", { name, seed: Number(seed) });
      setName("");
      setSeed("");
      await load();
      setMsg("Player added.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMsg(`Error: ${message}`);
    }
  }

  async function delPlayer(id: string) {
    if (!ensurePin()) return;
    try {
      await adminFetch("/api/admin/players/delete", { id });
      await load();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(message);
    }
  }

  async function swapSeeds(playerId: string, direction: -1 | 1) {
    if (!ensurePin()) return;

    const index = sortedPlayers.findIndex((player) => player.id === playerId);
    if (index < 0) return;

    const current = sortedPlayers[index];
    const neighbor = sortedPlayers[index + direction];

    if (!neighbor || current.seed == null || neighbor.seed == null) {
      setMsg("Cannot adjust seed order for this player yet.");
      return;
    }

    try {
      await Promise.all([
        adminFetch("/api/admin/players/update", { id: current.id, seed: neighbor.seed }),
        adminFetch("/api/admin/players/update", { id: neighbor.id, seed: current.seed }),
      ]);
      await load();
      setMsg(`Moved ${current.name} ${direction === -1 ? "up" : "down"}.`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMsg(`Error: ${message}`);
    }
  }

  const disabledAdd = !name || seed === "";

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--surface-glow),_transparent_65%)]"
      />

      <header className="flex flex-col gap-3 text-center sm:gap-4">
        <span className="self-center rounded-full border border-[color:var(--border)] bg-[color:var(--highlight)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
          Admin tools
        </span>
        <h1 className="text-balance text-3xl font-semibold sm:text-4xl">Players</h1>
        <p className="text-pretty text-sm text-[color:var(--muted)] sm:text-base">
          Curate the singles roster and seeds. All updates sync instantly to the public brackets and matches views.
        </p>
      </header>

      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Add a player</h2>
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
            16 total required
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,150px)_auto] sm:items-end">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[color:var(--muted)]">Name</span>
            <input
              className={inputClassName}
              placeholder="Jane Doe"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[color:var(--muted)]">Seed</span>
            <input
              className={inputClassName}
              placeholder="1..16"
              type="number"
              inputMode="numeric"
              value={seed}
              min={1}
              max={16}
              onChange={(event) =>
                setSeed(event.target.value === "" ? "" : Number(event.target.value))
              }
            />
          </label>
          <button
            type="button"
            onClick={addPlayer}
            disabled={disabledAdd}
            className="h-11 rounded-xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-[color:var(--accent-contrast)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add player
          </button>
        </div>

        {msg && (
          <p className="mt-4 rounded-xl border border-[color:var(--border)] bg-[color:var(--highlight)] px-4 py-2 text-sm text-[color:var(--muted)]">
            {msg}
          </p>
        )}
      </section>

      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-0 shadow-sm">
        <header className="flex flex-col gap-1 border-b border-[color:var(--border)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Current roster</h2>
            <p className="text-sm text-[color:var(--muted)]">
              {hasRoster ? "Tap a seed to make adjustments" : "Add players to build the bracket."}
            </p>
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
            {players.length}/16
          </span>
        </header>

        <ul className="divide-y divide-[color:var(--border)]">
          {sortedPlayers.map((player, index) => {
            const neighborUp = sortedPlayers[index - 1];
            const neighborDown = sortedPlayers[index + 1];
            const canMoveUp = !!(neighborUp && player.seed != null && neighborUp.seed != null);
            const canMoveDown = !!(neighborDown && player.seed != null && neighborDown.seed != null);

            return (
              <li key={player.id} className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:gap-6">
                <span className="inline-flex min-w-[3.5rem] items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--highlight)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
                  #{player.seed ?? "—"}
                </span>
                <div className="flex-1 text-base font-medium text-[color:var(--foreground)]">
                  {player.name}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => swapSeeds(player.id, -1)}
                    disabled={!canMoveUp}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:bg-[color:var(--highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => swapSeeds(player.id, 1)}
                    disabled={!canMoveDown}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:bg-[color:var(--highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => delPlayer(player.id)}
                  className="inline-flex items-center justify-center rounded-xl border border-red-500 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)]"
                >
                  Remove
                </button>
              </li>
            );
          })}

          {!hasRoster && (
            <li className="px-6 py-8 text-sm text-[color:var(--muted)]">
              No players yet. Add names above to seed the draw.
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
