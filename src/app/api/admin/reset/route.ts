// src/app/api/admin/reset/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';
import { canonicalPairs } from '@/lib/bracket';

type Action = 'matches_only' | 'regen_r1';

export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { action } = (await req.json()) as { action: Action };

    const { data: ev, error: evErr } = await supabaseAdmin
      .from('events')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (evErr || !ev) return NextResponse.json({ error: 'No event found' }, { status: 400 });
    const eventId = ev.id as string;

    // Single delete is safe for self-referencing FKs.
    const { error: delErr } = await supabaseAdmin
      .from('matches')
      .delete()
      .eq('event_id', eventId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

    if (action === 'matches_only') {
      return NextResponse.json({ ok: true, message: 'All matches cleared.' });
    }

    const { data: players, error: pErr } = await supabaseAdmin
      .from('players')
      .select('id,seed')
      .eq('event_id', eventId);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

    if (!players || players.length !== 16) {
      return NextResponse.json({ error: `Expected 16 players, found ${players?.length ?? 0}.` }, { status: 400 });
    }

    const bySeed = new Map<number, string>();
    for (const p of players) {
      if (p.seed != null) bySeed.set(p.seed, p.id);
    }

    const pairs = canonicalPairs().map(([sA, sB]) => {
      const aId = bySeed.get(sA);
      const bId = bySeed.get(sB);
      if (!aId || !bId) throw new Error('All 16 players must have seeds 1..16.');
      return {
        event_id: eventId,
        bracket: 'MAIN' as const,
        stage: 'R1' as const,
        round_num: 1,
        is_doubles: false,
        team_a: [aId],
        team_b: [bId],
        feeds_winner_to: null,
        feeds_loser_to: null,
      };
    });

    const { error: insErr } = await supabaseAdmin.from('matches').insert(pairs);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, message: 'Matches cleared and R1 regenerated.' });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
