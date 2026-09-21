// src/app/api/admin/build-doubles/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';
import { pairLosersIntoDoublesTeams } from '@/lib/bracket';

type Stage = 'SF' | 'F';

function uuid() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
}

export async function POST(req: Request) {
  try {
    requireAdminPin(req);

    const { data: ev, error: evErr } = await supabaseAdmin
      .from('events')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (evErr || !ev) return NextResponse.json({ error: 'No event found' }, { status: 400 });
    const eventId = ev.id as string;

    const { data: existing, error: exErr } = await supabaseAdmin
      .from('matches').select('id').eq('event_id', eventId).eq('bracket', 'DOUBLES').eq('stage', 'SF');
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 });
    if ((existing?.length ?? 0) > 0) {
      return NextResponse.json({ ok: true, message: 'Doubles already exists.' });
    }

    const { data: qfAll, error: qErr } = await supabaseAdmin
      .from('matches')
      .select('id, team_a, team_b, winner, bracket, stage')
      .eq('event_id', eventId).eq('stage', 'QF');
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 400 });

    const qfs = (qfAll ?? []).filter(m => m.bracket === 'MAIN' || m.bracket === 'LOWER');
    if (qfs.length !== 8) return NextResponse.json({ error: `Expected 8 QFs (MAIN+LOWER), found ${qfs.length}` }, { status: 400 });

    for (const m of qfs) {
      if (!m.winner) return NextResponse.json({ error: 'All QFs must have a winner before building doubles.' }, { status: 400 });
      if (!m.team_a?.length || !m.team_b?.length) return NextResponse.json({ error: 'QF teams incomplete.' }, { status: 400 });
    }

    const losers: string[] = qfs.map((m) => (m.winner === 'A' ? (m.team_b![0]) : (m.team_a![0])));

    let pairing;
    try {
      pairing = pairLosersIntoDoublesTeams(losers);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Pairing failed';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const sf1 = uuid();
    const sf2 = uuid();
    const fId = uuid();
    const [matchupA, matchupB] = pairing.sfMatchups;

    const rows = [
      {
        id: sf1, event_id: eventId, bracket: 'DOUBLES', stage: 'SF' as Stage, round_num: 3,
        is_doubles: true, team_a: matchupA[0] as unknown as string[], team_b: matchupA[1] as unknown as string[],
        feeds_winner_to: fId, feeds_loser_to: null,
      },
      {
        id: sf2, event_id: eventId, bracket: 'DOUBLES', stage: 'SF' as Stage, round_num: 3,
        is_doubles: true, team_a: matchupB[0] as unknown as string[], team_b: matchupB[1] as unknown as string[],
        feeds_winner_to: fId, feeds_loser_to: null,
      },
      {
        id: fId, event_id: eventId, bracket: 'DOUBLES', stage: 'F' as Stage, round_num: 4,
        is_doubles: true, team_a: [] as string[], team_b: [] as string[],
        feeds_winner_to: null, feeds_loser_to: null,
      },
    ];

    const { error: insErr } = await supabaseAdmin.from('matches').insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    return NextResponse.json({ ok: true, message: 'Doubles created: 2 SF + Final.' });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
