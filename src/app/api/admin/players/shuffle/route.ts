import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';
import {
  explainSeedWriteError,
  planShuffle,
  ROSTER_LOCKED_MESSAGE,
  type SeededPlayer,
} from '@/lib/seeding';

// Randomly redraws the seeds of everyone on the roster.
export async function POST(req: Request) {
  try {
    requireAdminPin(req);

    // latest event
    const { data: ev, error: evErr } = await supabaseAdmin
      .from('events').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (evErr) return NextResponse.json({ error: `Event lookup failed: ${evErr.message}` }, { status: 500 });
    if (!ev) return NextResponse.json({ error: 'No event found' }, { status: 400 });
    const eventId = ev.id as string;

    const { count, error: mErr } = await supabaseAdmin
      .from('matches').select('id', { count: 'exact', head: true }).eq('event_id', eventId);
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    if (count) return NextResponse.json({ error: ROSTER_LOCKED_MESSAGE }, { status: 409 });

    const { data: players, error: pErr } = await supabaseAdmin
      .from('players').select('id,name,seed').eq('event_id', eventId);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    const roster = (players ?? []) as SeededPlayer[];
    if (roster.length < 2) return NextResponse.json({ error: 'Add at least two players first' }, { status: 400 });

    const changes = new Map(planShuffle(roster).map((c) => [c.id, c.seed]));
    const rows = roster
      .filter((p) => changes.has(p.id))
      .map((p) => ({ ...p, event_id: eventId, seed: changes.get(p.id)! }));

    // Every reassigned seed in ONE statement — see the note in lib/seeding.ts.
    if (rows.length) {
      const { error: updErr } = await supabaseAdmin.from('players').upsert(rows, { onConflict: 'id' });
      if (updErr) return NextResponse.json({ error: explainSeedWriteError(updErr.message) }, { status: 400 });
    }

    return NextResponse.json({ ok: true, message: `Seeds randomised for ${roster.length} players.` });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
