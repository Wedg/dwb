// src/app/api/admin/reset/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';

type Action = 'matches_only' | 'regen_r1';

function canonicalPairs(): [number, number][] {
  // 16-player canonical seeding: [1,16],[8,9],[5,12],[4,13],[3,14],[6,11],[7,10],[2,15]
  return [[1,16],[8,9],[5,12],[4,13],[3,14],[6,11],[7,10],[2,15]];
}

export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { action } = (await req.json()) as { action: Action };

    // Get latest event
    const { data: ev, error: evErr } = await supabaseAdmin
      .from('events')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (evErr || !ev) return NextResponse.json({ error: 'No event found' }, { status: 400 });
    const eventId = ev.id as string;

    // 1) Delete ALL matches for this event (single statement → safe for self-FKs)
    const { error: delErr } = await supabaseAdmin
      .from('matches')
      .delete()
      .eq('event_id', eventId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

    if (action === 'matches_only') {
      return NextResponse.json({ ok: true, message: 'All matches cleared.' });
    }

    // 2) (Optional) Regenerate R1 in MAIN from the 16 seeds
    const { data: players, error: pErr } = await supabaseAdmin
      .from('players')
      .select('id,seed')
      .eq('event_id', eventId);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

    if (!players || players.length !== 16) {
      return NextResponse.json({ error: `Expected 16 players, found ${players?.length ?? 0}.` }, { status: 400 });
    }

    // Sort by seed and map by seed number for convenience
    const sorted = [...players].sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999));
    const bySeed = new Map<number, string>();
    sorted.forEach(p => { if (p.seed != null) bySeed.set(p.seed, p.id); });

    // Build the 8 R1 matches
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
    if (error instanceof Response) return error; // 403 from requireAdminPin
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
