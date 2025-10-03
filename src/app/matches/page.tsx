'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { adminFetch, ensurePin } from '@/lib/adminClient';


type MatchRow = {
  id: string;
  event_id: string;
  bracket: 'MAIN' | 'LOWER' | 'DOUBLES';
  stage: 'R1' | 'QF' | 'SF' | 'F';
  round_num: number;
  team_a: string[];
  team_b: string[];
  winner: 'A' | 'B' | null;
  feeds_winner_to: string | null;
  feeds_loser_to: string | null;
  is_doubles: boolean;
};

type Player = { id: string; name: string; seed: number | null };

const BRACKET_TITLES: Record<'MAIN'|'LOWER'|'DOUBLES', string> = {
  MAIN: 'DwB Spring Champs',
  LOWER: 'Pudel König',
  DOUBLES: 'Anthony Prangley Silence of the Champs',
};


const arraysEqual = (x: string[] = [], y: string[] = []) =>
  x.length === y.length && x.every((id, i) => id === y[i]);

async function getLatestEventId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('events')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) {
    console.error('events load error:', error);
    return null;
  }
  return data?.id ?? null;
}

export default function MatchesPage() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [winner, setWinner] = useState<'A' | 'B' | ''>('');

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    players.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [players]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      const eId = await getLatestEventId();
      if (!eId) {
        setErr('No event found. Create one in Supabase (table: events).');
        setLoading(false);
        return;
      }
      setEventId(eId);

      const [pRes, mRes] = await Promise.all([
        supabase.from('players').select('id,name,seed').eq('event_id', eId),
        supabase
          .from('matches')
          .select(
            'id,event_id,bracket,stage,round_num,team_a,team_b,winner,feeds_winner_to,feeds_loser_to,is_doubles'
          )
          .eq('event_id', eId)
          .order('round_num', { ascending: true })
      ]);

      if (pRes.error) {
        console.error(pRes.error);
        setErr(pRes.error.message ?? 'Failed to load players');
        setLoading(false);
        return;
      }
      if (mRes.error) {
        console.error(mRes.error);
        setErr(mRes.error.message ?? 'Failed to load matches');
        setLoading(false);
        return;
      }

      setPlayers(pRes.data ?? []);
      setMatches(mRes.data ?? []);
      setLoading(false);
    })();
  }, []);

  function playerLabel(ids: string[]) {
    if (!ids || ids.length === 0) return '(TBD)';
    if (ids.length === 1) return nameById.get(ids[0]) ?? ids[0];
    return ids.map((id) => nameById.get(id) ?? id).join(' + ');
  }

  function grouped() {
    const orderStage: Record<MatchRow['stage'], number> = { R1: 1, QF: 2, SF: 3, F: 4 };
    const stageGroups: Record<string, MatchRow[]> = {};
    for (const m of matches) {
      const key = `${m.stage}-${m.bracket}`;
      stageGroups[key] = stageGroups[key] ?? [];
      stageGroups[key].push(m);
    }
    const keys = Object.keys(stageGroups).sort((a, b) => {
      const [sa] = a.split('-') as [MatchRow['stage'], string];
      const [sb] = b.split('-') as [MatchRow['stage'], string];
      return orderStage[sa] - orderStage[sb] || a.localeCompare(b);
    });
    return keys.map((k) => ({ key: k, rows: stageGroups[k] }));
  }

  function openEdit(m: MatchRow) {
    setEditingId(m.id);
    setWinner((m.winner as any) ?? '');
  }

  async function applyAdvance(fromMatch: MatchRow, winnerSide: 'A' | 'B') {
    // 1) Update current match with winner
    const { error: uErr } = await supabase
      .from('matches')
      .update({ winner: winnerSide })
      .eq('id', fromMatch.id);
    if (uErr) throw uErr;

    // Helper: put ENTIRE team (array) into next match's first empty slot
    async function placeTeamInto(nextId: string | null, team: string[] | null) {
    if (!nextId || !team || team.length === 0) return;

    const { data: nm, error: nmErr } = await supabase
        .from('matches')
        .select('id,team_a,team_b')
        .eq('id', nextId)
        .maybeSingle();
    if (nmErr) throw nmErr;
    if (!nm) return;

    const a: string[] = nm.team_a ?? [];
    const b: string[] = nm.team_b ?? [];

    const eq = (x: string[], y: string[]) =>
        x.length === y.length && x.every((id, i) => id === y[i]);
    const hasAny = (x: string[], y: string[]) => x.some((id) => y.includes(id));

    // Already exactly placed?
    if (eq(a, team) || eq(b, team)) return;

    // If a slot contains part of this team (e.g., [p1]), expand it to full team ([p1,p2])
    if (hasAny(a, team) && a.length < team.length) {
        const { error } = await supabase.from('matches').update({ team_a: team }).eq('id', nm.id);
        if (error) throw error;
        return;
    }
    if (hasAny(b, team) && b.length < team.length) {
        const { error } = await supabase.from('matches').update({ team_b: team }).eq('id', nm.id);
        if (error) throw error;
        return;
    }

    // Otherwise, place into the first empty slot
    if (a.length === 0) {
        const { error } = await supabase.from('matches').update({ team_a: team }).eq('id', nm.id);
        if (error) throw error;
        return;
    }
    if (b.length === 0) {
        const { error } = await supabase.from('matches').update({ team_b: team }).eq('id', nm.id);
        if (error) throw error;
        return;
    }

    // Both slots filled with other players → do nothing (guard against accidental overwrite)
    }

    // Build winner/loser TEAMS (arrays). For singles, arrays of length 1. For doubles, both IDs.
    const teamA = Array.isArray(fromMatch.team_a) ? fromMatch.team_a : [];
    const teamB = Array.isArray(fromMatch.team_b) ? fromMatch.team_b : [];
    const winnerTeam = winnerSide === 'A' ? teamA : teamB;
    const loserTeam  = winnerSide === 'A' ? teamB : teamA;

    // 2) Advance winner team
    await placeTeamInto(fromMatch.feeds_winner_to, winnerTeam);
    // 3) Advance loser team (used for R1 → LOWER QF; harmless elsewhere)
    await placeTeamInto(fromMatch.feeds_loser_to, loserTeam);
    }

  async function removeTeamFrom(nextId: string | null, team: string[] | null) {
    if (!nextId || !team || team.length === 0) return;

    // Load the next match (need winner to guard)
    const { data: nm, error: nmErr } = await supabase
        .from('matches')
        .select('id, team_a, team_b, winner')
        .eq('id', nextId)
        .maybeSingle();
    if (nmErr || !nm) return;

    // If downstream match already has a winner, do not modify it
    if (nm.winner) return;

    const a: string[] = nm.team_a ?? [];
    const b: string[] = nm.team_b ?? [];

    // Only clear if the slot exactly matches the team we placed
    if (arraysEqual(a, team)) {
        await supabase.from('matches').update({ team_a: [] }).eq('id', nm.id);
    } else if (arraysEqual(b, team)) {
        await supabase.from('matches').update({ team_b: [] }).eq('id', nm.id);
    }
  }

  async function clearResult(matchId: string) {
    // Load fresh copy (we need winner & teams & feeds)
    const { data: m, error } = await supabase
        .from('matches')
        .select('id, team_a, team_b, winner, feeds_winner_to, feeds_loser_to')
        .eq('id', matchId)
        .maybeSingle();
    if (error || !m) {
        alert('Could not load match to clear.');
        return;
    }

    // If no winner set, nothing to clear
    if (!m.winner) {
        // Still try to remove any accidental downstream placements of these teams
        await removeTeamFrom(m.feeds_winner_to, m.team_a);
        await removeTeamFrom(m.feeds_winner_to, m.team_b);
        await removeTeamFrom(m.feeds_loser_to,  m.team_a);
        await removeTeamFrom(m.feeds_loser_to,  m.team_b);
        return;
    }

    // Determine which team advanced where, then clear downstream, then clear winner on this match
    const teamA: string[] = Array.isArray(m.team_a) ? m.team_a : [];
    const teamB: string[] = Array.isArray(m.team_b) ? m.team_b : [];
    const winnerTeam = m.winner === 'A' ? teamA : teamB;
    const loserTeam  = m.winner === 'A' ? teamB : teamA;

    // Remove teams we placed into next matches (only if those next matches don’t have a winner)
    await removeTeamFrom(m.feeds_winner_to, winnerTeam);
    await removeTeamFrom(m.feeds_loser_to,  loserTeam);

    // Finally, clear this match’s winner
    const { error: uErr } = await supabase
        .from('matches')
        .update({ winner: null })
        .eq('id', m.id);
    if (uErr) throw uErr;
    }

  async function onSave() {
    if (!editingId) return;
    if (winner !== 'A' && winner !== 'B') { alert('Pick A or B'); return; }
    if (!ensurePin()) return;
    try {
        await adminFetch('/api/admin/set-winner', { matchId: editingId, winner });
        // reload matches (unchanged fetch below)
        const { data, error } = await supabase
        .from('matches')
        .select('id,event_id,bracket,stage,round_num,team_a,team_b,winner,feeds_winner_to,feeds_loser_to,is_doubles')
        .eq('event_id', eventId)
        .order('round_num', { ascending: true });
        if (error) throw error;
        setMatches(data ?? []);
        setEditingId(null);
        setWinner('');
    } catch (e: any) {
        alert(e?.message ?? 'Failed');
    }
  }


  return (
    <main style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Matches</h1>
      {loading && <p>Loading…</p>}
      {!loading && err && <p style={{ color: 'crimson' }}>{err}</p>}
      {!loading && !err && grouped().map(({ key, rows }) => {
        const [stage, bracket] = key.split('-') as [MatchRow['stage'], MatchRow['bracket']];
        return (
          <section key={key} style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '12px 0' }}>{stage} — {BRACKET_TITLES[bracket]}</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rows.map((r) => (
                <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <code style={{ opacity: 0.6 }}>{r.id.slice(0, 8)}</code>
                  <span style={{ flex: 1 }}>
                    <strong>A:</strong> {playerLabel(r.team_a)} &nbsp;vs&nbsp; <strong>B:</strong> {playerLabel(r.team_b)}
                    {r.winner && (
                      <em style={{ marginLeft: 8, opacity: 0.8 }}>— Winner: {r.winner}</em>
                    )}
                  </span>
                  <button onClick={() => openEdit(r)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #000', background: '#000', color: '#fff' }}>
                    Set winner
                  </button>

                  {editingId === r.id && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="radio" name="winner" value="A" checked={winner === 'A'} onChange={() => setWinner('A')} />
                        A
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <input type="radio" name="winner" value="B" checked={winner === 'B'} onChange={() => setWinner('B')} />
                        B
                      </label>
                      <button onClick={onSave} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #0a0', background: '#0a0', color: '#fff' }}>
                        Save
                      </button>
                      <button onClick={() => { setEditingId(null); setWinner(''); }} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #666', background: '#fff' }}>
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                            if (!ensurePin()) return;
                            try {
                                await adminFetch('/api/admin/clear-result', { matchId: r.id });
                                // reload…
                                const { data, error } = await supabase
                                .from('matches')
                                .select('id,event_id,bracket,stage,round_num,team_a,team_b,winner,feeds_winner_to,feeds_loser_to,is_doubles')
                                .eq('event_id', eventId)
                                .order('round_num', { ascending: true });
                                if (error) throw error;
                                setMatches(data ?? []);
                                setEditingId(null);
                                setWinner('');
                            } catch (e: any) {
                                alert(e?.message ?? 'Failed to clear');
                            }
                        }}
                        style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #c00', background: '#fff', color: '#c00' }}
                        >
                        Clear result
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
