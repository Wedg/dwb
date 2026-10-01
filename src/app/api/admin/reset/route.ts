// src/app/api/admin/reset/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';

// Deletes every match (singles and doubles) in the current tournament. Players
// stay, and the roster unlocks so seeds can change before rebuilding.
export async function POST(req: Request) {
  try {
    requireAdminPin(req);

    const { data: ev, error: evErr } = await supabaseAdmin
      .from('events')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (evErr) return NextResponse.json({ error: `Event lookup failed: ${evErr.message}` }, { status: 500 });
    if (!ev) return NextResponse.json({ error: 'No event found' }, { status: 400 });
    const eventId = ev.id as string;

    // Single delete is safe for self-referencing FKs.
    const { error: delErr, count } = await supabaseAdmin
      .from('matches')
      .delete({ count: 'exact' })
      .eq('event_id', eventId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

    return NextResponse.json({
      ok: true,
      message: `Bracket reset: ${count ?? 0} matches deleted. Players kept.`,
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
