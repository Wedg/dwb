import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';
import { planAddPlayers, RosterError } from '@/lib/seeding';

// Body: { names: string[] } to add several at once, or { name, seed? } for one.
// Players without a seed take the lowest free seeds, in the order given.
export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const body = await req.json() as { name?: unknown; seed?: unknown; names?: unknown };

    const entries = Array.isArray(body.names)
      ? body.names.map((name) => ({ name: typeof name === 'string' ? name : '' }))
      : [{
          name: typeof body.name === 'string' ? body.name : '',
          seed: body.seed == null || body.seed === '' ? undefined : Number(body.seed),
        }];

    // latest event
    const { data: ev, error: evErr } = await supabaseAdmin
      .from('events').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (evErr) return NextResponse.json({ error: `Event lookup failed: ${evErr.message}` }, { status: 500 });
    if (!ev) return NextResponse.json({ error: 'No event found' }, { status: 400 });
    const eventId = ev.id as string;

    const { data: existing, error: pErr } = await supabaseAdmin
      .from('players').select('name,seed').eq('event_id', eventId);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });

    // One insert for the whole batch, so it all lands or none of it does.
    const rows = planAddPlayers(existing ?? [], entries).map((row) => ({ ...row, event_id: eventId }));
    const { error: insErr } = await supabaseAdmin.from('players').insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, added: rows.length });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof RosterError) return NextResponse.json({ error: error.message }, { status: 400 });
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
