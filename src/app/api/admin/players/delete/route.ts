import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';
import { ROSTER_LOCKED_MESSAGE } from '@/lib/seeding';

export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: 'Player id required' }, { status: 400 });

    // Matches hold player ids, so removing someone after the draw would leave
    // a blank in the bracket.
    const { data: player, error: pErr } = await supabaseAdmin
      .from('players').select('event_id').eq('id', id).maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!player) return NextResponse.json({ ok: true });
    const { count, error: mErr } = await supabaseAdmin
      .from('matches').select('id', { count: 'exact', head: true }).eq('event_id', player.event_id);
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
    if (count) return NextResponse.json({ error: ROSTER_LOCKED_MESSAGE }, { status: 409 });

    const { error } = await supabaseAdmin.from('players').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
