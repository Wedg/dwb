import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { id, name, seed } = await req.json() as { id: string; name?: string; seed?: number };

    if (!id) return NextResponse.json({ error: 'Player id required' }, { status: 400 });

    // latest event (for unique-seed check)
    const { data: ev } = await supabaseAdmin
      .from('events').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!ev?.id) return NextResponse.json({ error: 'No event found' }, { status: 400 });
    const eventId = ev.id as string;

    const patch: { name?: string; seed?: number } = {};
    if (typeof name === 'string' && name.trim()) patch.name = name.trim();
    if (seed != null) {
      if (!Number.isInteger(seed) || seed < 1 || seed > 16)
        return NextResponse.json({ error: 'Seed must be 1..16' }, { status: 400 });
      // unique seed
      const { data: dupe } = await supabaseAdmin
        .from('players').select('id').eq('event_id', eventId).eq('seed', seed).neq('id', id);
      if ((dupe?.length ?? 0) > 0) return NextResponse.json({ error: `Seed ${seed} already taken` }, { status: 400 });
      patch.seed = seed;
    }

    if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    const { error: updErr } = await supabaseAdmin.from('players').update(patch).eq('id', id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
