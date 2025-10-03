// src/app/control/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ensurePin, adminFetch } from '@/lib/adminClient';

type Status = {
  // totals
  players: number;
  r1: number;
  qfMain: number;
  qfLower: number;
  doubles: number;        // all doubles matches (SF + F)

  // winners set
  r1Winners: number;      // out of 8
  qfMainWinners: number;  // out of 4
  qfLowerWinners: number; // out of 4
  dSF: number;            // doubles SF count (should be 2 when created)
  dSFWinners: number;     // out of 2
  dFinal: number;         // 0 or 1
  dFinalWinner: number;   // 0 or 1
};

export default function ControlPage() {
  const [status, setStatus] = useState<Status>({
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
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ---- Status loader (reads via anon key) ----
  async function refreshStatus() {
    try {
      // latest event id
      const { data: ev } = await supabase
        .from('events')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!ev) {
        setStatus({
          players: 0, r1: 0, qfMain: 0, qfLower: 0, doubles: 0,
          r1Winners: 0, qfMainWinners: 0, qfLowerWinners: 0,
          dSF: 0, dSFWinners: 0, dFinal: 0, dFinalWinner: 0,
        });
        return;
      }
      const eventId = ev.id;

      const [
        players,
        r1All,           r1Win,
        qfMainAll,       qfMainWin,
        qfLowerAll,      qfLowerWin,
        doublesAll,
        dSFAll,          dSFWins,
        dFinalAll,       dFinalWins,
      ] = await Promise.all([
        supabase.from('players').select('id').eq('event_id', eventId),
        supabase.from('matches').select('id').eq('event_id', eventId).eq('stage', 'R1'),
        supabase.from('matches').select('id').eq('event_id', eventId).eq('stage', 'R1').not('winner', 'is', null),

        supabase.from('matches').select('id').eq('event_id', eventId).eq('stage', 'QF').eq('bracket', 'MAIN'),
        supabase.from('matches').select('id').eq('event_id', eventId).eq('stage', 'QF').eq('bracket', 'MAIN').not('winner', 'is', null),

        supabase.from('matches').select('id').eq('event_id', eventId).eq('stage', 'QF').eq('bracket', 'LOWER'),
        supabase.from('matches').select('id').eq('event_id', eventId).eq('stage', 'QF').eq('bracket', 'LOWER').not('winner', 'is', null),

        supabase.from('matches').select('id').eq('event_id', eventId).eq('bracket', 'DOUBLES'),

        supabase.from('matches').select('id').eq('event_id', eventId).eq('bracket', 'DOUBLES').eq('stage', 'SF'),
        supabase.from('matches').select('id').eq('event_id', eventId).eq('bracket', 'DOUBLES').eq('stage', 'SF').not('winner', 'is', null),

        supabase.from('matches').select('id').eq('event_id', eventId).eq('bracket', 'DOUBLES').eq('stage', 'F'),
        supabase.from('matches').select('id').eq('event_id', eventId).eq('bracket', 'DOUBLES').eq('stage', 'F').not('winner', 'is', null),
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
      // non-fatal
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  // ---- Next-action hint ----
  function nextActionHint(s: Status): string {
    if (s.players !== 16) return 'Add and seed players (need exactly 16 with seeds 1..16).';
    if (s.r1 < 8) return 'Create Round 1 (use “Reset: Start fresh (R1 only)” or the Singles builder).';
    if (s.r1Winners < 8) return `Set winners for Round 1 (${s.r1Winners}/8).`;
    if (s.qfMain < 4 || s.qfLower < 4) return 'Create 4 QFs per bracket (click the Singles builder).';
    if (s.qfMainWinners + s.qfLowerWinners < 8)
      return `Set all 8 QF winners (${s.qfMainWinners + s.qfLowerWinners}/8). This enables Doubles.`;
    if (s.dSF === 0) return 'Build Doubles (from QF losers).';
    if (s.dSFWinners < 2) return `Set Doubles SF winners (${s.dSFWinners}/2) to populate the Final.`;
    if (s.dFinal === 1 && s.dFinalWinner === 0) return 'Set the Doubles Final winner to finish the event.';
    return 'All good. Continue setting winners through to each Final.';
  }

  // ---- Button handler helper (write via service routes) ----
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setMsg(null);
    try {
      if (!ensurePin()) return;
      await fn();
      await refreshStatus();
    } catch (e: any) {
      setMsg(e?.message ?? 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 920 }}>
      <h1>TD Control</h1>
      <p style={{ marginTop: 4, opacity: 0.8 }}>Admin-only actions (secured by PIN).</p>

      {/* Status banner */}
      <div
        style={{
          border: '1px solid #ddd',
          borderRadius: 10,
          padding: '12px 14px',
          margin: '16px 0',
          background: '#f9f9fb',
          lineHeight: 1.6,
        }}
      >
        <strong>Tournament Status</strong>
        <div>Players: {status.players} {status.players === 16 ? '✅' : '⚠️'}</div>

        <div style={{ marginTop: 6 }}>
          <em>Singles (DwB Spring Champs + Pudel König)</em>
        </div>
        <div>R1 matches: {status.r1} {status.r1 === 8 ? '✅' : '⚠️'} — Winners set: {status.r1Winners}/8</div>
        <div>QF (Main): {status.qfMain} {status.qfMain === 4 ? '✅' : '⚠️'} — Winners set: {status.qfMainWinners}/4</div>
        <div>QF (Lower): {status.qfLower} {status.qfLower === 4 ? '✅' : '⚠️'} — Winners set: {status.qfLowerWinners}/4</div>

        <div style={{ marginTop: 6 }}>
          <em>Doubles (Anthony Prangley Silence of the Champs)</em>
        </div>
        <div>SF created: {status.dSF}/2 — SF winners: {status.dSFWinners}/2</div>
        <div>Final created: {status.dFinal}/1 — Final winner set: {status.dFinalWinner}/1</div>

        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed #ddd' }}>
          <strong>Next action:</strong> {nextActionHint(status)}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() =>
            action(async () => {
              const res = await adminFetch('/api/admin/build-singles', {});
              setMsg(res?.message ?? 'Singles wired.');
            })
          }
          disabled={busy}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #000',
            background: '#000',
            color: '#fff',
          }}
        >
          {busy ? 'Working…' : 'Create 4 QFs per bracket & wire R1'}
        </button>

        <button
          onClick={() =>
            action(async () => {
              const res = await adminFetch('/api/admin/build-doubles', {});
              setMsg(res?.message ?? 'Doubles created.');
            })
          }
          disabled={busy}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #003',
            background: '#003',
            color: '#fff',
          }}
        >
          {busy ? 'Working…' : 'Build Doubles (from QF losers)'}
        </button>

        <button
          onClick={() =>
            action(async () => {
              const res = await adminFetch('/api/admin/reset', { action: 'matches_only' });
              setMsg(res?.message ?? 'All matches cleared.');
            })
          }
          disabled={busy}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #900',
            background: '#fff',
            color: '#900',
          }}
        >
          {busy ? 'Working…' : 'Reset: Clear ALL matches'}
        </button>

        <button
          onClick={() =>
            action(async () => {
              const res = await adminFetch('/api/admin/reset', { action: 'regen_r1' });
              setMsg(res?.message ?? 'Cleared + regenerated R1.');
            })
          }
          disabled={busy}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #000',
            background: '#000',
            color: '#fff',
          }}
        >
          {busy ? 'Working…' : 'Reset: Start fresh (R1 only)'}
        </button>
      </div>

      {msg && <p style={{ marginTop: 12 }}>{msg}</p>}

      <p style={{ marginTop: 18, opacity: 0.7 }}>
        Manage players on <a href="/players" style={{ textDecoration: 'underline' }}>Players</a>.
        Set winners on the <a href="/matches" style={{ textDecoration: 'underline' }}>Matches</a> page.
        View the public tree on <a href="/brackets" style={{ textDecoration: 'underline' }}>Brackets</a>.
      </p>
    </main>
  );
}
