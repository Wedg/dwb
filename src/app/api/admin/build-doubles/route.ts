// src/app/api/admin/build-doubles/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';

type Stage = 'SF' | 'F';

function uuid() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
}

export async function POST(req: Request) {
  try {
    requireAdminPin(req);

    // Latest event
    const { data: ev, error: evErr } = await supabaseAdmin
      .from('events')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (evErr || !ev) return NextResponse.json({ error: 'No event found' }, { status: 400 });
    const eventId = ev.id as string;

    // If doubles SF already exists, do nothing (idempotent)
    const { data: existing, error: exErr } = await supabaseAdmin
      .from('matches').select('id').eq('event_id', eventId).eq('bracket', 'DOUBLES').eq('stage', 'SF');
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 });
    if ((existing?.length ?? 0) > 0) {
      return NextResponse.json({ ok: true, message: 'Doubles already exists.' });
    }

    // Load QFs (both MAIN and LOWER) with winners
    const { data: qfAll, error: qErr } = await supabaseAdmin
      .from('matches')
      .select('id, team_a, team_b, winner, bracket, stage')
      .eq('event_id', eventId).eq('stage', 'QF');
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 400 });

    const qfs = (qfAll ?? []).filter(m => m.bracket === 'MAIN' || m.bracket === 'LOWER');
    if (qfs.length !== 8) return NextResponse.json({ error: `Expected 8 QFs (MAIN+LOWER), found ${qfs.length}` }, { status: 400 });

    // Ensure all QFs have winners & both slots set
    for (const m of qfs) {
      if (!m.winner) return NextResponse.json({ error: 'All QFs must have a winner before building doubles.' }, { status: 400 });
      if (!m.team_a?.length || !m.team_b?.length) return NextResponse.json({ error: 'QF teams incomplete.' }, { status: 400 });
    }

    // Collect the 8 losers (singles → 1 id each)
    const losers: string[] = qfs.map((m) => (m.winner === 'A' ? (m.team_b![0]) : (m.team_a![0])));

    // Pair sequentially into 4 teams of 2
    if (losers.length !== 8) return NextResponse.json({ error: 'Need 8 losers to build doubles.' }, { status: 400 });
    const teams: [string, string][] = [];
    for (let i = 0; i < losers.length; i += 2) teams.push([losers[i], losers[i + 1]]);

    // Build 2 SF + 1 Final (pair 1v4 and 2v3 for small balance)
    const sf1 = uuid();
    const sf2 = uuid();
    const fId = uuid();

    const rows = [
      {
        id: sf1, event_id: eventId, bracket: 'DOUBLES', stage: 'SF' as Stage, round_num: 3,
        is_doubles: true, team_a: teams[0] as unknown as string[], team_b: teams[3] as unknown as string[],
        feeds_winner_to: fId, feeds_loser_to: null,
      },
      {
        id: sf2, event_id: eventId, bracket: 'DOUBLES', stage: 'SF' as Stage, round_num: 3,
        is_doubles: true, team_a: teams[1] as unknown as string[], team_b: teams[2] as unknown as string[],
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
  } catch (e: any) {
    if (e instanceof Response) return e; // 403 from requireAdminPin
    return NextResponse.json({ error: e?.message ?? 'Server error' }, { status: 500 });
  }
}
