// src/app/api/admin/build-doubles/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';
import {
  pairLosersIntoDoublesTeams,
  planDoublesSwaps,
  shuffled,
  type MatchSlots,
  type Team,
} from '@/lib/bracket';

type Stage = 'SF' | 'F';

function uuid() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
}

// Draws the doubles from the 8 singles QF losers at random. Pressed again
// after a QF result was corrected, it swaps in whoever now lost that QF and
// leaves everyone else's partner alone; once doubles results exist it refuses.
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

    const qfSlots: MatchSlots[] = qfs.map((m) => ({ team_a: m.team_a, team_b: m.team_b, winner: m.winner }));
    const losers: string[] = qfs.map((m) => (m.winner === 'A' ? (m.team_b![0]) : (m.team_a![0])));

    const { data: existing, error: exErr } = await supabaseAdmin
      .from('matches').select('id, stage, team_a, team_b, winner').eq('event_id', eventId).eq('bracket', 'DOUBLES');
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 400 });

    let redraw = false;
    if ((existing?.length ?? 0) > 0) {
      const sfs = existing!.filter((m) => m.stage === 'SF');
      const swaps = planDoublesSwaps(qfSlots, sfs.flatMap((m) => [...m.team_a, ...m.team_b]));
      if (swaps && swaps.size === 0) {
        return NextResponse.json({ ok: true, message: 'Doubles are already up to date with the QF results.' });
      }
      if (existing!.some((m) => m.winner)) {
        return NextResponse.json({
          error: 'QF results changed after doubles results were entered. Clear the doubles results on the Matches page, then press Build Doubles again.',
        }, { status: 409 });
      }

      if (swaps) {
        const swap = (team: Team) => team.map((id) => swaps.get(id) ?? id);
        for (const sf of sfs) {
          const { error: updErr } = await supabaseAdmin
            .from('matches').update({ team_a: swap(sf.team_a), team_b: swap(sf.team_b) }).eq('id', sf.id);
          if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });
        }

        const { data: people } = await supabaseAdmin
          .from('players').select('id,name').in('id', [...swaps.keys(), ...swaps.values()]);
        const name = (id: string) => people?.find((p) => p.id === id)?.name ?? 'unknown';
        const changes = [...swaps].map(([out, inn]) => `${name(inn)} replaces ${name(out)}`).join('; ');
        return NextResponse.json({ ok: true, message: `Doubles updated: ${changes}. Everyone else keeps their partner.` });
      }

      // The QF line-ups changed too much to patch (e.g. an R1 correction):
      // start the doubles draw again. Single delete is safe for the SF → F FKs.
      const { error: delErr } = await supabaseAdmin
        .from('matches').delete().eq('event_id', eventId).eq('bracket', 'DOUBLES');
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });
      redraw = true;
    }

    let pairing;
    try {
      pairing = pairLosersIntoDoublesTeams(shuffled(losers));
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

    return NextResponse.json({
      ok: true,
      message: redraw
        ? 'The QF line-ups changed, so the doubles were drawn again: 2 SF + Final.'
        : 'Doubles drawn at random: 2 SF + Final.',
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
