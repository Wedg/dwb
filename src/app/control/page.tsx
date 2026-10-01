"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ensurePin, adminFetch } from "@/lib/adminClient";
import { supabase } from "@/lib/supabaseClient";
import { suggestEventName } from "@/lib/events";
import { Toast, type ToastMessage } from "@/components/Toast";

type Status = {
  players: number;
  r1: number;
  qfMain: number;
  qfLower: number;
  doubles: number;
  r1Winners: number;
  qfMainWinners: number;
  qfLowerWinners: number;
  dSF: number;
  dSFWinners: number;
  dFinal: number;
  dFinalWinner: number;
  results: number;
};

type EventSummary = {
  id: string;
  name: string;
  createdAt: string;
  players: number;
  matches: number;
};

const INITIAL_STATUS: Status = {
  players: 0,
  r1: 0,
  qfMain: 0,
  qfLower: 0,
  doubles: 0,
  r1Winners: 0,
  qfMainWinners: 0,
  qfLowerWinners: 0,
  dSF: 0,
  dSFWinners: 0,
  dFinal: 0,
  dFinalWinner: 0,
  results: 0,
};

const inputClassName =
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] shadow-sm transition focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)] focus:ring-offset-2 focus:ring-offset-[color:var(--background)]";

const smallButtonClassName =
  "inline-flex h-9 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-40";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

export default function ControlPage() {
  const [status, setStatus] = useState<Status>(INITIAL_STATUS);
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState("");
  const [copyPlayers, setCopyPlayers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<ToastMessage | null>(null);

  const current = events[0] ?? null;
  const past = events.slice(1);

  async function refreshStatus() {
    try {
      const { data: rows } = await supabase
        .from("events")
        .select("id,name,created_at,players(count),matches(count)")
        .order("created_at", { ascending: false });
      const summaries: EventSummary[] = (rows ?? []).map((row) => ({
        id: row.id,
        name: row.name ?? "Untitled",
        createdAt: row.created_at,
        players: row.players?.[0]?.count ?? 0,
        matches: row.matches?.[0]?.count ?? 0,
      }));
      setEvents(summaries);
      setNewName((name) => name || suggestEventName(summaries[0]?.name, new Date().getFullYear()));
      setLoaded(true);

      const ev = summaries[0];
      if (!ev) {
        setStatus(INITIAL_STATUS);
        return;
      }
      const eventId = ev.id;

      const [
        players,
        r1All,
        r1Win,
        qfMainAll,
        qfMainWin,
        qfLowerAll,
        qfLowerWin,
        doublesAll,
        dSFAll,
        dSFWins,
        dFinalAll,
        dFinalWins,
        results,
      ] = await Promise.all([
        supabase.from("players").select("id").eq("event_id", eventId),
        supabase.from("matches").select("id").eq("event_id", eventId).eq("stage", "R1"),
        supabase
          .from("matches")
          .select("id")
          .eq("event_id", eventId)
          .eq("stage", "R1")
          .not("winner", "is", null),
        supabase
          .from("matches")
          .select("id")
          .eq("event_id", eventId)
          .eq("stage", "QF")
          .eq("bracket", "MAIN"),
        supabase
          .from("matches")
          .select("id")
          .eq("event_id", eventId)
          .eq("stage", "QF")
          .eq("bracket", "MAIN")
          .not("winner", "is", null),
        supabase
          .from("matches")
          .select("id")
          .eq("event_id", eventId)
          .eq("stage", "QF")
          .eq("bracket", "LOWER"),
        supabase
          .from("matches")
          .select("id")
          .eq("event_id", eventId)
          .eq("stage", "QF")
          .eq("bracket", "LOWER")
          .not("winner", "is", null),
        supabase.from("matches").select("id").eq("event_id", eventId).eq("bracket", "DOUBLES"),
        supabase
          .from("matches")
          .select("id")
          .eq("event_id", eventId)
          .eq("bracket", "DOUBLES")
          .eq("stage", "SF"),
        supabase
          .from("matches")
          .select("id")
          .eq("event_id", eventId)
          .eq("bracket", "DOUBLES")
          .eq("stage", "SF")
          .not("winner", "is", null),
        supabase
          .from("matches")
          .select("id")
          .eq("event_id", eventId)
          .eq("bracket", "DOUBLES")
          .eq("stage", "F"),
        supabase
          .from("matches")
          .select("id")
          .eq("event_id", eventId)
          .eq("bracket", "DOUBLES")
          .eq("stage", "F")
          .not("winner", "is", null),
        supabase.from("matches").select("id").eq("event_id", eventId).not("winner", "is", null),
      ]);

      setStatus({
        players: players.data?.length ?? 0,
        r1: r1All.data?.length ?? 0,
        qfMain: qfMainAll.data?.length ?? 0,
        qfLower: qfLowerAll.data?.length ?? 0,
        doubles: doublesAll.data?.length ?? 0,
        r1Winners: r1Win.data?.length ?? 0,
        qfMainWinners: qfMainWin.data?.length ?? 0,
        qfLowerWinners: qfLowerWin.data?.length ?? 0,
        dSF: dSFAll.data?.length ?? 0,
        dSFWinners: dSFWins.data?.length ?? 0,
        dFinal: dFinalAll.data?.length ?? 0,
        dFinalWinner: dFinalWins.data?.length ?? 0,
        results: results.data?.length ?? 0,
      });
    } catch {
      // non-fatal fetch error
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  function nextActionHint(s: Status): string {
    if (!current) return "Start a tournament in the Tournament section above.";
    if (s.players !== 16) return `Add 16 players on the Players page (${s.players}/16), then randomise the seeds.`;
    if (s.r1 < 8 || s.qfMain < 4 || s.qfLower < 4) return "Click \"Build singles bracket\".";
    if (s.r1Winners < 8) return `Set winners for Round 1 on the Matches page (${s.r1Winners}/8).`;
    if (s.qfMainWinners + s.qfLowerWinners < 8)
      return `Set all 8 QF winners (${s.qfMainWinners + s.qfLowerWinners}/8). This enables Doubles.`;
    if (s.dSF === 0) return "Click \"Build Doubles\" to draw the doubles teams.";
    if (s.dSFWinners < 2) return `Set Doubles SF winners (${s.dSFWinners}/2) to populate the Final.`;
    if (s.dFinal === 1 && s.dFinalWinner === 0) return "Set the Doubles Final winner to finish the event.";
    return "All good. Continue setting winners through to each Final.";
  }

  async function action(fn: () => Promise<string>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    if (busy || !ensurePin()) return;
    setBusy(true);
    try {
      setMsg({ text: await fn() });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Action failed";
      setMsg({ text: `Error: ${message}`, error: true });
    } finally {
      await refreshStatus();
      setBusy(false);
    }
  }

  function startTournament() {
    const name = newName.trim();
    if (!name) return;
    const keepNote = current
      ? `\n\nThe current "${current.name}" (started ${formatDate(current.createdAt)}) moves to Past tournaments, where you can delete it.`
      : "";
    void action(async () => {
      const res = await adminFetch<{ message?: string }>("/api/admin/events/create", {
        name,
        copyPlayers: copyPlayers && !!current,
      });
      setNewName("");
      setCopyPlayers(false);
      return res?.message ?? `Started "${name}".`;
    }, `Start "${name}"?\n\nThe whole app switches to it straight away.${keepNote}`);
  }

  function renameTournament() {
    if (!current) return;
    const name = prompt("Rename tournament", current.name)?.trim();
    if (!name || name === current.name) return;
    void action(async () => {
      const res = await adminFetch<{ message?: string }>("/api/admin/events/rename", { id: current.id, name });
      return res?.message ?? "Renamed.";
    });
  }

  function deleteTournament(ev: EventSummary) {
    void action(async () => {
      const res = await adminFetch<{ message?: string }>("/api/admin/events/delete", { id: ev.id });
      return res?.message ?? "Deleted.";
    }, `Permanently delete "${ev.name}" (started ${formatDate(ev.createdAt)}) with its ${plural(ev.players, "player")} and ${plural(ev.matches, "match", "matches")}?\n\nThis can't be undone.`);
  }

  return (
    <main className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_var(--surface-glow),_transparent_65%)]"
      />

      <header className="flex flex-col gap-3 text-center sm:gap-4">
        <span className="self-center rounded-full border border-[color:var(--border)] bg-[color:var(--highlight)] px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-[color:var(--accent)]">
          Admin control
        </span>
        <h1 className="text-balance text-3xl font-semibold sm:text-4xl">TD Control</h1>
        <p className="text-pretty text-sm text-[color:var(--muted)] sm:text-base">
          Quick actions to build brackets, manage doubles, and reset rounds. Designed for pin-protected tournament staff on the go.
        </p>
      </header>

      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold">Tournament</h2>
        {current ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--highlight)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-words text-xl font-semibold text-[color:var(--foreground)]">{current.name}</p>
              <p className="text-sm text-[color:var(--muted)]">
                Started {formatDate(current.createdAt)} · {plural(current.players, "player")} ·{" "}
                {plural(current.matches, "match", "matches")}
              </p>
            </div>
            <button
              type="button"
              onClick={renameTournament}
              disabled={busy}
              className={`${smallButtonClassName} self-start border-[color:var(--border)] text-[color:var(--muted)] hover:bg-[color:var(--background)] focus-visible:ring-[color:var(--accent)] sm:self-center`}
            >
              Rename
            </button>
          </div>
        ) : (
          loaded && (
            <p className="mt-2 text-sm text-[color:var(--muted)]">No tournament yet. Start one below.</p>
          )
        )}

        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTournament();
          }}
        >
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-[color:var(--muted)]">
              {current ? "Start a new tournament" : "Tournament name"}
            </span>
            <input
              className={inputClassName}
              value={newName}
              maxLength={80}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Spring Champs 2027"
            />
          </label>
          {current && current.players > 0 && (
            <label className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
              <input
                type="checkbox"
                checked={copyPlayers}
                onChange={(event) => setCopyPlayers(event.target.checked)}
              />
              Copy the {plural(current.players, "player")} from {current.name}
            </label>
          )}
          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className="h-11 rounded-xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-[color:var(--accent-contrast)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-60 sm:self-start"
          >
            {current ? "Start new tournament" : "Create tournament"}
          </button>
          <p className="text-xs text-[color:var(--muted)]">
            Everyone sees the newest tournament. The current one is kept under Past tournaments, so a test run can be
            deleted there afterwards. Names don&apos;t have to be unique.
          </p>
        </form>

        {past.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-[color:var(--muted)]">
              Past tournaments
            </h3>
            <ul className="mt-3 divide-y divide-[color:var(--border)] rounded-2xl border border-[color:var(--border)]">
              {past.map((ev) => (
                <li key={ev.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-[color:var(--foreground)]">{ev.name}</p>
                    <p className="text-xs text-[color:var(--muted)]">
                      Started {formatDate(ev.createdAt)} · {plural(ev.players, "player")} ·{" "}
                      {plural(ev.matches, "match", "matches")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteTournament(ev)}
                    disabled={busy}
                    className={`${smallButtonClassName} shrink-0 border-red-500 text-red-500 hover:bg-red-500/10 focus-visible:ring-red-500`}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold">Tournament status</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Snapshot of your event progress with guidance on what to do next.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--highlight)] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">Singles</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--muted)]">Players seeded</dt>
                <dd className="font-semibold text-[color:var(--foreground)]">{status.players}/16</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--muted)]">Round 1 created</dt>
                <dd className="font-semibold text-[color:var(--foreground)]">{status.r1}/8</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--muted)]">Round 1 winners</dt>
                <dd className="font-semibold text-[color:var(--foreground)]">{status.r1Winners}/8</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--muted)]">Main QF created</dt>
                <dd className="font-semibold text-[color:var(--foreground)]">{status.qfMain}/4</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--muted)]">Lower QF created</dt>
                <dd className="font-semibold text-[color:var(--foreground)]">{status.qfLower}/4</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--muted)]">QF winners set</dt>
                <dd className="font-semibold text-[color:var(--foreground)]">{status.qfMainWinners + status.qfLowerWinners}/8</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--highlight)] p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">Doubles</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--muted)]">Matches created</dt>
                <dd className="font-semibold text-[color:var(--foreground)]">{status.doubles}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--muted)]">SF slots</dt>
                <dd className="font-semibold text-[color:var(--foreground)]">{status.dSF}/2</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--muted)]">SF winners</dt>
                <dd className="font-semibold text-[color:var(--foreground)]">{status.dSFWinners}/2</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--muted)]">Final created</dt>
                <dd className="font-semibold text-[color:var(--foreground)]">{status.dFinal}/1</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[color:var(--muted)]">Final winner</dt>
                <dd className="font-semibold text-[color:var(--foreground)]">{status.dFinalWinner}/1</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--background)]/70 p-4 text-sm text-[color:var(--muted)]">
          <strong className="font-semibold text-[color:var(--foreground)]">Next action:</strong> {nextActionHint(status)}
        </div>
      </section>

      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold">Quick actions</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          These buttons call admin endpoints that mutate the live bracket. Enter the PIN when prompted.
        </p>
        <div className="mt-4 space-y-3 rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--background)]/70 p-4 text-sm text-[color:var(--muted)]">
          <p className="font-semibold text-[color:var(--foreground)]">Suggested flow</p>
          <ol className="list-decimal space-y-2 pl-4">
            <li>Start the tournament above (or carry on with the current one).</li>
            <li>Add the 16 players on the Players screen and randomise the seeds.</li>
            <li>
              Click <strong>Build singles bracket</strong>. This draws Round&nbsp;1 from the seeds and sets up every round after it.
            </li>
            <li>Record winners on the Matches page by tapping the winner&apos;s name. They move on automatically.</li>
            <li>
              Once all eight quarterfinals have winners, click <strong>Build Doubles</strong> to draw the doubles teams.
            </li>
            <li>
              To start the draw again, use <strong>Reset bracket</strong>. Players are kept, so you can re-seed and build again.
            </li>
          </ol>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy || !current}
            onClick={() =>
              action(async () => {
                const res = await adminFetch<{ message?: string }>("/api/admin/build-singles", {});
                return res?.message ?? "Singles bracket ensured and Round 1 wired into the QFs.";
              })
            }
            className="rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-contrast)] shadow transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working…" : "Build singles bracket"}
          </button>
          <p className="sm:col-span-2 text-sm text-[color:var(--muted)]">
            Draws Round&nbsp;1 from the seeds, creates the quarterfinals, semis and final for both the main and Pudel König brackets,
            and connects them: Round&nbsp;1 winners go to the main QFs, losers to the Pudel König QFs. Safe to press again; it only
            fills in what&apos;s missing.
          </p>

          <button
            type="button"
            disabled={busy || !current}
            onClick={() =>
              action(async () => {
                const res = await adminFetch<{ message?: string }>("/api/admin/build-doubles", {});
                return res?.message ?? "Doubles drawn from the eight singles QF losers.";
              })
            }
            className="rounded-2xl border border-blue-900 bg-blue-900 px-4 py-3 text-sm font-semibold text-white shadow transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working…" : "Build Doubles (from QF losers)"}
          </button>
          <p className="sm:col-span-2 text-sm text-[color:var(--muted)]">
            Randomly pairs the eight quarterfinal losers into four teams and draws two semifinals and a final. If you correct a
            quarterfinal result afterwards, press it again: the player who now lost that quarterfinal takes over, and everyone else
            keeps their partner. Once doubles results are in, it won&apos;t change the draw.
          </p>

          <button
            type="button"
            disabled={busy || !current}
            onClick={() =>
              action(
                async () => {
                  const res = await adminFetch<{ message?: string }>("/api/admin/reset", {});
                  return res?.message ?? "Bracket reset. Players kept.";
                },
                status.results > 0
                  ? `Reset the bracket?\n\nThis deletes all ${plural(current?.matches ?? 0, "match", "matches")}, including ${plural(status.results, "result")} already entered. Players are kept.`
                  : "Reset the bracket?\n\nThis deletes every match. No results have been entered yet. Players are kept."
              )
            }
            className="rounded-2xl border border-red-600 bg-transparent px-4 py-3 text-sm font-semibold text-red-600 shadow transition hover:bg-red-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working…" : "Reset bracket (keep players)"}
          </button>
          <p className="sm:col-span-2 text-sm text-[color:var(--muted)]">
            Deletes every match and result, singles and doubles, in the current tournament. Players stay, and seeds can be changed
            again. Then click <strong>Build singles bracket</strong> to draw a fresh bracket.
          </p>
        </div>
      </section>

      <p className="text-center text-sm text-[color:var(--muted)]">
        Manage players on <Link href="/players" className="underline">Players</Link>. Set winners on the {" "}
        <Link href="/matches" className="underline">Matches</Link> page. View the public tree on {" "}
        <Link href="/brackets" className="underline">Brackets</Link>.
      </p>

      <Toast msg={msg} onClose={setMsg} />
    </main>
  );
}
