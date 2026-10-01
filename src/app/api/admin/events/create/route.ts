import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';
import { parseEventName } from '@/lib/events';

// Body: { name, copyPlayers? }. Starts a new tournament, which becomes the
// current one straight away (the app always shows the newest event). Older
// tournaments are kept; copyPlayers brings the current roster across.
export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const body = await req.json() as { name?: unknown; copyPlayers?: unknown };

    const parsed = parseEventName(body.name);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    let roster: { name: string; seed: number }[] = [];
    if (body.copyPlayers === true) {
      const { data: current, error: evErr } = await supabaseAdmin
        .from('events').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (evErr) return NextResponse.json({ error: `Event lookup failed: ${evErr.message}` }, { status: 500 });
      if (current) {
        const { data, error: pErr } = await supabaseAdmin
          .from('players').select('name,seed').eq('event_id', current.id);
        if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
        roster = data ?? [];
      }
    }

    const { data: created, error: insErr } = await supabaseAdmin
      .from('events').insert({ name: parsed.name }).select('id').single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    if (roster.length) {
      const { error: copyErr } = await supabaseAdmin
        .from('players').insert(roster.map((p) => ({ ...p, event_id: created.id })));
      if (copyErr) {
        // Don't leave a half-made tournament behind as the current one.
        await supabaseAdmin.from('events').delete().eq('id', created.id);
        return NextResponse.json({ error: `Copying players failed: ${copyErr.message}` }, { status: 400 });
      }
    }

    const copied = roster.length ? ` with ${roster.length} players copied across` : '';
    return NextResponse.json({ ok: true, message: `Started "${parsed.name}"${copied}.` });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
