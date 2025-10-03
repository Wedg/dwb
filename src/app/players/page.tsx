'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ensurePin, adminFetch } from '@/lib/adminClient';

type Player = { id: string; name: string; seed: number | null };

export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState('');
  const [seed, setSeed] = useState<number | ''>('');
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data: ev } = await supabase.from('events').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!ev?.id) return;
    const { data } = await supabase.from('players').select('id,name,seed').eq('event_id', ev.id).order('seed', { ascending: true });
    setPlayers(data ?? []);
  }

  useEffect(() => { load(); }, []);

  async function addPlayer() {
    if (!ensurePin()) return;
    try {
      await adminFetch('/api/admin/players/add', { name, seed: Number(seed) });
      setName(''); setSeed('');
      await load();
      setMsg('Player added.');
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
  }

  async function delPlayer(id: string) {
    if (!ensurePin()) return;
    try {
      await adminFetch('/api/admin/players/delete', { id });
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
      <h1>Players</h1>

      {/* Admin add form */}
      <div style={{ margin: '12px 0', padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        <strong>Add player</strong>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Seed (1..16)" type="number" value={seed} onChange={(e) => setSeed(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: 120 }} />
          <button onClick={addPlayer} style={{ padding: '6px 10px' }}>Add</button>
        </div>
        {msg && <div style={{ marginTop: 8, opacity: 0.8 }}>{msg}</div>}
      </div>

      {/* List */}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {players.map((p) => (
          <li key={p.id} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid #eee' }}>
            <code style={{ opacity: 0.6, minWidth: 80 }}>#{p.seed}</code>
            <span style={{ flex: 1 }}>{p.name}</span>
            <button onClick={() => delPlayer(p.id)} style={{ border: '1px solid #c00', background: '#fff', color: '#c00', borderRadius: 6, padding: '4px 8px' }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
