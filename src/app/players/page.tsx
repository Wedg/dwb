"use client";

import { useEffect, useMemo, useState } from "react";
import { ensurePin, adminFetch } from "@/lib/adminClient";
import { supabase } from "@/lib/supabaseClient";
import { MAX_PLAYERS, parseNames, ROSTER_LOCKED_MESSAGE } from "@/lib/seeding";
import { Toast, type ToastMessage } from "@/components/Toast";

type Player = { id: string; name: string; seed: number | null };

const SEEDS = Array.from({ length: MAX_PLAYERS }, (_, i) => i + 1);

const inputClassName =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] shadow-sm transition focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 focus:ring-offset-[color:var(--background)]";

const iconButtonClassName =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--border)] text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:bg-[color:var(--highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-40";

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [bracketBuilt, setBracketBuilt] = useState(false);
  const [namesText, setNamesText] = useState("");
  const [msg, setMsg] = useState<ToastMessage | null>(null);
  const [busy, setBusy] = useState(false);

  const hasRoster = players.length > 0;
  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0)),
    [players]
  );
  const seedHolder = useMemo(
    () => new Map(players.map((player) => [player.seed, player])),
    [players]
  );
  const names = useMemo(() => parseNames(namesText), [namesText]);
  const spotsLeft = MAX_PLAYERS - players.length;
  const canAdd = !busy && names.length > 0 && names.length <= spotsLeft;
  const locked = bracketBuilt;

  async function load() {
    const { data: ev } = await supabase
      .from("events")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!ev?.id) return;
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("players")
        .select("id,name,seed")
        .eq("event_id", ev.id)
        .order("seed", { ascending: true }),
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("event_id", ev.id),
    ]);
    setPlayers(data ?? []);
    setBracketBuilt((count ?? 0) > 0);
  }

  useEffect(() => {
    void load();
  }, []);

  async function run(action: () => Promise<string>) {
    if (busy || !ensurePin()) return;
    setBusy(true);
    try {
      const done = await action();
      setMsg({ text: done });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMsg({ text: `Error: ${message}`, error: true });
    } finally {
      await load();
      setBusy(false);
    }
  }

  function addPlayers() {
    if (!canAdd) return;
    void run(async () => {
      await adminFetch("/api/admin/players/add", { names });
      setNamesText("");
      return names.length === 1 ? `Added ${names[0]}.` : `Added ${names.length} players.`;
    });
  }

  function shuffleSeeds() {
    if (!confirm(`Randomly redraw the seeds for all ${players.length} players?`)) return;
    void run(async () => {
      const res = await adminFetch<{ message?: string }>("/api/admin/players/shuffle", {});
      return res?.message ?? "Seeds randomised.";
    });
  }

  function setSeed(player: Player, seed: number) {
    const holder = seedHolder.get(seed);
    void run(async () => {
      await adminFetch("/api/admin/players/update", { id: player.id, seed });
      return holder && holder.id !== player.id
        ? `Swapped ${player.name} and ${holder.name}.`
        : `Moved ${player.name} to seed ${seed}.`;
    });
  }

  function renamePlayer(player: Player) {
    const name = prompt(`Rename ${player.name}`, player.name)?.trim();
    if (!name || name === player.name) return;
    void run(async () => {
      await adminFetch("/api/admin/players/update", { id: player.id, name });
      return `Renamed ${player.name} to ${name}.`;
    });
  }

  function removePlayer(player: Player) {
    if (!confirm(`Remove ${player.name}?`)) return;
    void run(async () => {
      await adminFetch("/api/admin/players/delete", { id: player.id });
      return `Removed ${player.name}.`;
    });
  }

  let namesStatus = `${spotsLeft} of ${MAX_PLAYERS} spots left`;
  if (names.length > spotsLeft) namesStatus = `${names.length} names, but only ${spotsLeft} spots left`;
  else if (names.length > 0) namesStatus = `${names.length} ready to add · ${namesStatus}`;

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
          Curate the singles roster and seeds. Changes reach the public pages within 30 seconds.
        </p>
      </header>

      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Add players</h2>
          <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">
            {MAX_PLAYERS} total required
          </p>
        </div>

        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            addPlayers();
          }}
        >
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[color:var(--muted)]">Names, one per line</span>
            <textarea
              className={`${inputClassName} min-h-40 resize-y`}
              placeholder={"Paste the sign-up list or type names in.\nNumbered lists are fine:\n1. Jane Doe\n2. John Smith"}
              value={namesText}
              disabled={spotsLeft === 0}
              onChange={(event) => setNamesText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  addPlayers();
                }
              }}
            />
          </label>
          <p className="text-xs text-[color:var(--muted)]">
            New players take the lowest free seeds in the order listed, so a list in seed order is seeded as-is. Or add
            everyone and use <strong>Randomise seeds</strong> below.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span
              className={`text-sm ${names.length > spotsLeft ? "font-semibold text-red-500" : "text-[color:var(--muted)]"}`}
            >
              {namesStatus}
            </span>
            <button
              type="submit"
              disabled={!canAdd}
              className="h-11 rounded-xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-[color:var(--accent-contrast)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {names.length > 1 ? `Add ${names.length} players` : "Add player"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-0 shadow-sm">
        <header className="flex flex-col gap-3 border-b border-[color:var(--border)] px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Current roster</h2>
            <p className="text-sm text-[color:var(--muted)]">
              {!hasRoster
                ? "Add players to build the bracket."
                : locked
                  ? "Tap a name to rename."
                  : "Tap a name to rename, or a seed to change it."}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
              {players.length}/{MAX_PLAYERS}
            </span>
            <button
              type="button"
              onClick={shuffleSeeds}
              disabled={busy || locked || players.length < 2}
              className="h-9 rounded-xl border border-[color:var(--accent)] px-3 text-sm font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--highlight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              🎲 Randomise seeds
            </button>
          </div>
        </header>

        {locked && (
          <p className="border-b border-[color:var(--border)] bg-[color:var(--highlight)] px-6 py-3 text-sm text-[color:var(--muted)]">
            {ROSTER_LOCKED_MESSAGE}
          </p>
        )}

        <ul className="divide-y divide-[color:var(--border)]">
          {sortedPlayers.map((player, index) => {
            const neighborUp = sortedPlayers[index - 1];
            const neighborDown = sortedPlayers[index + 1];
            const canMoveUp = !locked && !!(neighborUp && player.seed != null && neighborUp.seed != null);
            const canMoveDown = !locked && !!(neighborDown && player.seed != null && neighborDown.seed != null);

            return (
              <li
                key={player.id}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-6 py-4 sm:gap-6"
              >
                <select
                  aria-label={`Seed for ${player.name}`}
                  value={player.seed ?? ""}
                  disabled={busy || locked}
                  onChange={(event) => setSeed(player, Number(event.target.value))}
                  className="w-[4.5rem] cursor-pointer appearance-none rounded-full border border-[color:var(--border)] bg-[color:var(--highlight)] px-3 py-1 text-center text-xs font-semibold tracking-[0.2em] text-[color:var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] disabled:cursor-default"
                >
                  {SEEDS.map((seed) => {
                    const holder = seedHolder.get(seed);
                    return (
                      <option key={seed} value={seed}>
                        #{seed}
                        {holder && holder.id !== player.id ? ` · swap with ${holder.name}` : ""}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={() => renamePlayer(player)}
                  disabled={busy}
                  title="Rename"
                  className="min-w-0 break-words text-left text-base font-medium text-[color:var(--foreground)] decoration-[color:var(--muted)] underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  {player.name}
                </button>
                <div className="flex items-center gap-2 justify-self-end">
                  <button
                    type="button"
                    aria-label={`Move ${player.name} up`}
                    onClick={() => neighborUp?.seed != null && setSeed(player, neighborUp.seed)}
                    disabled={busy || !canMoveUp}
                    className={iconButtonClassName}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${player.name} down`}
                    onClick={() => neighborDown?.seed != null && setSeed(player, neighborDown.seed)}
                    disabled={busy || !canMoveDown}
                    className={iconButtonClassName}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${player.name}`}
                    onClick={() => removePlayer(player)}
                    disabled={busy || locked}
                    className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-red-500 px-2 text-sm sm:px-3 font-semibold text-red-500 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span aria-hidden className="sm:hidden">✕</span>
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
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

      <Toast msg={msg} onClose={setMsg} />
    </main>
  );
}
