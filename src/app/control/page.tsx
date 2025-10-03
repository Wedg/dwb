"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ensurePin, adminFetch } from "@/lib/adminClient";
import { supabase } from "@/lib/supabaseClient";

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
};

export default function ControlPage() {
  const [status, setStatus] = useState<Status>(INITIAL_STATUS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refreshStatus() {
    try {
      const { data: ev } = await supabase
        .from("events")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
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
      });
    } catch {
      // non-fatal fetch error
    }
  }

  useEffect(() => {
    void refreshStatus();
  }, []);

  function nextActionHint(s: Status): string {
    if (s.players !== 16) return "Add and seed players (need exactly 16 with seeds 1..16).";
    if (s.r1 < 8) return "Create Round 1 (use \"Reset: Start fresh (R1 only)\" or the Singles builder).";
    if (s.r1Winners < 8) return `Set winners for Round 1 (${s.r1Winners}/8).`;
    if (s.qfMain < 4 || s.qfLower < 4) return "Create 4 QFs per bracket (click the Singles builder).";
    if (s.qfMainWinners + s.qfLowerWinners < 8)
      return `Set all 8 QF winners (${s.qfMainWinners + s.qfLowerWinners}/8). This enables Doubles.`;
    if (s.dSF === 0) return "Build Doubles (from QF losers).";
    if (s.dSFWinners < 2) return `Set Doubles SF winners (${s.dSFWinners}/2) to populate the Final.`;
    if (s.dFinal === 1 && s.dFinalWinner === 0) return "Set the Doubles Final winner to finish the event.";
    return "All good. Continue setting winners through to each Final.";
  }

  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      if (!ensurePin()) return;
      await fn();
      await refreshStatus();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Action failed";
      setMsg(message);
    } finally {
      setBusy(false);
    }
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
          These endpoints update live data. You will be prompted for the admin PIN before continuing.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              action(async () => {
                const res = await adminFetch<{ message?: string }>("/api/admin/build-singles", {});
                setMsg(res?.message ?? "Singles wired.");
              })
            }
            className="rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-contrast)] shadow transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working…" : "Create 4 QFs per bracket & wire R1"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              action(async () => {
                const res = await adminFetch<{ message?: string }>("/api/admin/build-doubles", {});
                setMsg(res?.message ?? "Doubles created.");
              })
            }
            className="rounded-2xl border border-blue-900 bg-blue-900 px-4 py-3 text-sm font-semibold text-white shadow transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working…" : "Build Doubles (from QF losers)"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              action(async () => {
                const res = await adminFetch<{ message?: string }>("/api/admin/reset", { action: "matches_only" });
                setMsg(res?.message ?? "All matches cleared.");
              })
            }
            className="rounded-2xl border border-red-600 bg-transparent px-4 py-3 text-sm font-semibold text-red-600 shadow transition hover:bg-red-600/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working…" : "Reset: Clear ALL matches"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              action(async () => {
                const res = await adminFetch<{ message?: string }>("/api/admin/reset", { action: "regen_r1" });
                setMsg(res?.message ?? "Cleared + regenerated R1.");
              })
            }
            className="rounded-2xl border border-[color:var(--accent)] bg-[color:var(--accent)] px-4 py-3 text-sm font-semibold text-[color:var(--accent-contrast)] shadow transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--background)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working…" : "Reset: Start fresh (R1 only)"}
          </button>
        </div>

        {msg && (
          <p className="mt-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--highlight)] px-4 py-3 text-sm text-[color:var(--muted)]">
            {msg}
          </p>
        )}
      </section>

      <p className="text-center text-sm text-[color:var(--muted)]">
        Manage players on <Link href="/players" className="underline">Players</Link>. Set winners on the {" "}
        <Link href="/matches" className="underline">Matches</Link> page. View the public tree on {" "}
        <Link href="/brackets" className="underline">Brackets</Link>.
      </p>
    </main>
  );
}
