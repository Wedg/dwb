import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';
import {
  checkName,
  explainSeedWriteError,
  planSetSeed,
  RosterError,
  ROSTER_LOCKED_MESSAGE,
  type SeededPlayer,
} from '@/lib/seeding';

// Body: { id, name?, seed? }. A seed already held by someone else swaps the
// two players. Renaming is always allowed; seeds lock once matches exist.
export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { id, name, seed } = await req.json() as { id: string; name?: string; seed?: number };

    if (!id) return NextResponse.json({ error: 'Player id required' }, { status: 400 });
    if (typeof name !== 'string' && seed == null) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    // latest event
    const { data: ev, error: evErr } = await supabaseAdmin
      .from('events').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (evErr) return NextResponse.json({ error: `Event lookup failed: ${evErr.message}` }, { status: 500 });
    if (!ev) return NextResponse.json({ error: 'No event found' }, { status: 400 });
    const eventId = ev.id as string;

    const { data: players, error: pErr } = await supabaseAdmin
      .from('players').select('id,name,seed').eq('event_id', eventId);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    const roster = (players ?? []) as SeededPlayer[];
    const player = roster.find((p) => p.id === id);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const rows = new Map<string, SeededPlayer>();
    if (typeof name === 'string') {
      const newName = checkName(roster, name, id);
      if (newName !== player.name) rows.set(id, { ...player, name: newName });
    }

    if (seed != null) {
      const { count, error: mErr } = await supabaseAdmin
        .from('matches').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
      if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
      if (count) return NextResponse.json({ error: ROSTER_LOCKED_MESSAGE }, { status: 409 });

      for (const change of planSetSeed(roster, id, seed)) {
        const current = rows.get(change.id) ?? roster.find((p) => p.id === change.id)!;
        rows.set(change.id, { ...current, seed: change.seed });
      }
    }

    if (rows.size === 0) return NextResponse.json({ ok: true });

    // Both sides of a swap in ONE statement — see the note in lib/seeding.ts.
    const { error: updErr } = await supabaseAdmin
      .from('players')
      .upsert([...rows.values()].map((p) => ({ ...p, event_id: eventId })), { onConflict: 'id' });
    if (updErr) return NextResponse.json({ error: explainSeedWriteError(updErr.message) }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof RosterError) return NextResponse.json({ error: error.message }, { status: 400 });
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
