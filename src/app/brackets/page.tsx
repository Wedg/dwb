'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Bracket = 'MAIN' | 'LOWER' | 'DOUBLES';
type Stage = 'R1' | 'QF' | 'SF' | 'F';

type MatchRow = {
  id: string;
  event_id: string;
  bracket: Bracket;
  stage: Stage;
  round_num: number;
  team_a: string[];
  team_b: string[];
  winner: 'A' | 'B' | null;
};

type Player = { id: string; name: string };

const BRACKET_TITLES: Record<Bracket, string> = {
  MAIN: 'DwB Spring Champs',
  LOWER: 'Pudel König',
  DOUBLES: 'Anthony Prangley Silence of the Champs',
};

const STAGE_ORDER: Stage[] = ['R1', 'QF', 'SF', 'F'];
const STAGE_LABEL: Record<Stage, string> = { R1: 'Round 1', QF: 'Quarterfinals', SF: 'Semifinals', F: 'Final' };

async function getLatestEventId(): Promise<string | null> {
  const { data, error } = await supabase
    .from('events')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data?.id ?? null;
}

export default function BracketsPage() {
  const [eventId, setEventId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Bracket>('MAIN');

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
        setErr('No event found.');
        setLoading(false);
        return;
      }
      setEventId(eId);

      const [pRes, mRes] = await Promise.all([
        supabase.from('players').select('id,name').eq('event_id', eId),
        supabase
          .from('matches')
          .select('id,event_id,bracket,stage,round_num,team_a,team_b,winner')
          .eq('event_id', eId)
      ]);

      if (pRes.error) { setErr(pRes.error.message); setLoading(false); return; }
      if (mRes.error) { setErr(mRes.error.message); setLoading(false); return; }

      setPlayers(pRes.data ?? []);
      setMatches(mRes.data ?? []);
      setLoading(false);
    })();
  }, []);

  function labelTeam(ids: string[]) {
    if (!ids || ids.length === 0) return '—';
    if (ids.length === 1) return nameById.get(ids[0]) ?? ids[0];
    return ids.map(id => nameById.get(id) ?? id).join(' + ');
  }

  // Build rounds for a given bracket
  function roundsFor(bracket: Bracket) {
    const rows = matches.filter(m => m.bracket === bracket);
    const byStage = new Map<Stage, MatchRow[]>();
    for (const s of STAGE_ORDER) byStage.set(s, []);
    rows.forEach(m => byStage.get(m.stage)!.push(m));

    // Sort deterministically within each stage for a stable layout
    for (const s of STAGE_ORDER) {
      const arr = byStage.get(s)!;
      arr.sort((a, b) => {
        // Prefer round_num ascending, then id
        const r = (a.round_num ?? 0) - (b.round_num ?? 0);
        if (r !== 0) return r;
        return a.id.localeCompare(b.id);
      });
    }

    // Return as arrays in bracket order
    return STAGE_ORDER
      .map(stage => ({ stage, matches: byStage.get(stage)! }))
      .filter(group => group.matches.length > 0);
  }

  const rounds = roundsFor(tab);

  return (
    <main style={{ padding: '16px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1 style={{ marginBottom: 8 }}>Brackets</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['MAIN','LOWER','DOUBLES'] as Bracket[]).map(b => (
          <button
            key={b}
            onClick={() => setTab(b)}
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              border: '1px solid #ccc',
              background: tab === b ? '#111' : '#fff',
              color: tab === b ? '#fff' : '#111',
              cursor: 'pointer'
            }}
          >
            {BRACKET_TITLES[b]}
          </button>
        ))}
      </div>

      {loading && <p>Loading…</p>}
      {err && <p style={{ color: 'crimson' }}>{err}</p>}

      {!loading && !err && (
        <section style={{ overflowX: 'auto', paddingBottom: 8 }}>
          {/* Bracket grid */}
          <div
            style={{
              display: 'grid',
              gridAutoFlow: 'column',
              gridAutoColumns: 'minmax(220px, 1fr)',
              gap: '24px',
              alignItems: 'start',
              minHeight: 200
            }}
          >
            {rounds.map((col) => (
              <div key={col.stage}>
                <h3 style={{ margin: '0 0 8px 0' }}>{STAGE_LABEL[col.stage as Stage]}</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  {col.matches.map((m) => (
                    <div key={m.id} style={{ position: 'relative' }}>
                      <div style={{
                        border: '1px solid #ddd',
                        borderRadius: 10,
                        padding: '8px 10px',
                        background: '#fff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1, fontWeight: m.winner === 'A' ? 700 : 500 }}>
                            {labelTeam(m.team_a)}
                          </div>
                          <div style={{ flex: 1, textAlign: 'right', fontWeight: m.winner === 'B' ? 700 : 500 }}>
                            {labelTeam(m.team_b)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {col.matches.length === 0 && <div style={{ opacity: 0.6 }}>No matches</div>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p style={{ marginTop: 16, opacity: 0.7 }}>
        Tip: Use the <a href="/matches" style={{ textDecoration: 'underline' }}>Matches</a> page to set winners; brackets update live.
      </p>
    </main>
  );
}
