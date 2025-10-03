import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { name, seed } = await req.json() as { name: string; seed: number };

    if (!name || typeof name !== 'string') return NextResponse.json({ error: 'Name required' }, { status: 400 });
    if (!Number.isInteger(seed) || seed < 1 || seed > 16) {
      return NextResponse.json({ error: 'Seed must be an integer 1..16' }, { status: 400 });
    }

    // latest event
    const { data: ev } = await supabaseAdmin
      .from('events').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!ev?.id) return NextResponse.json({ error: 'No event found' }, { status: 400 });
    const eventId = ev.id as string;

    // enforce max 16 and unique seed
    const [{ data: all }, { data: sameSeed }] = await Promise.all([
      supabaseAdmin.from('players').select('id').eq('event_id', eventId),
      supabaseAdmin.from('players').select('id').eq('event_id', eventId).eq('seed', seed),
    ]);
    if ((all?.length ?? 0) >= 16) return NextResponse.json({ error: 'Already have 16 players' }, { status: 400 });
    if ((sameSeed?.length ?? 0) > 0) return NextResponse.json({ error: `Seed ${seed} already taken` }, { status: 400 });

    const { error: insErr } = await supabaseAdmin.from('players').insert([{ event_id: eventId, name, seed }]);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
