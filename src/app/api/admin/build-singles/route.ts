// src/app/api/admin/build-singles/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';

type Bracket = 'MAIN' | 'LOWER';
type Stage = 'R1' | 'QF' | 'SF' | 'F';

function uuid() {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).toString();
}

// Canonical R1 seed pairs for a 16-player draw
function canonicalPairs(): [number, number][] {
  return [[1,16],[8,9],[5,12],[4,13],[3,14],[6,11],[7,10],[2,15]];
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

    // Load players (need 16 with seeds)
    const { data: players, error: pErr } = await supabaseAdmin
      .from('players')
      .select('id,seed')
      .eq('event_id', eventId);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
    if (!players || players.length !== 16) {
      return NextResponse.json({ error: `Expected 16 players, found ${players?.length ?? 0}.` }, { status: 400 });
    }

    // Build seed→id map
    const bySeed = new Map<number, string>();
    for (const p of players) {
      if (p.seed == null) return NextResponse.json({ error: 'All 16 players must have a seed (1..16).' }, { status: 400 });
      bySeed.set(p.seed, p.id);
    }
    // Sanity: make sure we have seeds 1..16
    for (let s = 1; s <= 16; s++) {
      if (!bySeed.get(s)) return NextResponse.json({ error: `Missing player with seed ${s}.` }, { status: 400 });
    }

    // Ensure R1 (MAIN) exists — create if missing
    const { data: r1Existing, error: r1Err } = await supabaseAdmin
      .from('matches')
      .select('id')
      .eq('event_id', eventId)
      .eq('bracket', 'MAIN')
      .eq('stage', 'R1');
    if (r1Err) return NextResponse.json({ error: r1Err.message }, { status: 400 });

    if ((r1Existing?.length ?? 0) === 0) {
      const r1Rows = canonicalPairs().map(([sa, sb]) => ({
        event_id: eventId,
        bracket: 'MAIN' as Bracket,
        stage: 'R1' as Stage,
        round_num: 1,
        is_doubles: false,
        team_a: [bySeed.get(sa)!],
        team_b: [bySeed.get(sb)!],
        feeds_winner_to: null,
        feeds_loser_to: null,
      }));
      const { error: insR1Err } = await supabaseAdmin.from('matches').insert(r1Rows);
      if (insR1Err) return NextResponse.json({ error: insR1Err.message }, { status: 400 });
    }

    // Fetch the (now ensured) R1 list
    const { data: r1, error: r1FetchErr } = await supabaseAdmin
      .from('matches')
      .select('id,team_a,team_b,stage,bracket,round_num')
      .eq('event_id', eventId).eq('stage', 'R1').eq('bracket', 'MAIN');
    if (r1FetchErr) return NextResponse.json({ error: r1FetchErr.message }, { status: 400 });
    if (!r1 || r1.length !== 8) {
      return NextResponse.json({ error: `Expected 8 R1 matches (MAIN), found ${r1?.length ?? 0}` }, { status: 400 });
    }

    // Helper: ensure 4 QF, 2 SF, 1 F per bracket
    async function ensureSkeleton(bracket: Bracket) {
      const { data: qfs, error: qErr } = await supabaseAdmin
        .from('matches').select('id').eq('event_id', eventId).eq('bracket', bracket).eq('stage', 'QF');
      if (qErr) throw new Error(qErr.message);

      if (!qfs || qfs.length === 0) {
        const qfIds = Array.from({ length: 4 }, () => uuid());
        const sfIds = Array.from({ length: 2 }, () => uuid());
        const fId = uuid();

        const rows = [
          ...qfIds.map((id, i) => ({
            id, event_id: eventId, bracket, stage: 'QF' as Stage, round_num: 2,
            is_doubles: false, team_a: [] as string[], team_b: [] as string[],
            feeds_winner_to: sfIds[Math.floor(i / 2)], feeds_loser_to: null,
          })),
          ...sfIds.map((id) => ({
            id, event_id: eventId, bracket, stage: 'SF' as Stage, round_num: 3,
            is_doubles: false, team_a: [] as string[], team_b: [] as string[],
            feeds_winner_to: fId, feeds_loser_to: null,
          })),
          {
            id: fId, event_id: eventId, bracket, stage: 'F' as Stage, round_num: 4,
            is_doubles: false, team_a: [] as string[], team_b: [] as string[],
            feeds_winner_to: null, feeds_loser_to: null,
          },
        ];

        const { error: insErr } = await supabaseAdmin.from('matches').insert(rows);
        if (insErr) throw new Error(insErr.message);
      }

      const { data: qfAfter, error: qErr2 } = await supabaseAdmin
        .from('matches').select('id').eq('event_id', eventId).eq('bracket', bracket).eq('stage', 'QF');
      if (qErr2) throw new Error(qErr2.message);
      return (qfAfter ?? []).map(d => d.id).sort();
    }

    const qfMainIds  = await ensureSkeleton('MAIN');
    const qfLowerIds = await ensureSkeleton('LOWER');
    if (qfMainIds.length !== 4 || qfLowerIds.length !== 4) {
      return NextResponse.json({ error: 'QF skeleton incomplete.' }, { status: 400 });
    }

    // Build seed map for R1 matches
    const seedById = new Map<string, number>();
    for (const s of Array.from(bySeed.keys())) {
      const pid = bySeed.get(s)!;
      seedById.set(pid, s);
    }

    const canon = canonicalPairs().map(([a,b]) => `${Math.min(a,b)}-${Math.max(a,b)}`);
    const wirings: { r1Id: string; slotIndex: number }[] = [];

    for (const m of r1) {
      const aId = (m.team_a?.[0]) ?? '';
      const bId = (m.team_b?.[0]) ?? '';
      const sa = seedById.get(aId)!;
      const sb = seedById.get(bId)!;
      const key = `${Math.min(sa, sb)}-${Math.max(sa, sb)}`;
      const slotIndex = canon.indexOf(key);
      if (slotIndex === -1) {
        return NextResponse.json({ error: `R1 match with seeds (${sa},${sb}) not canonical.` }, { status: 400 });
      }
      wirings.push({ r1Id: m.id, slotIndex });
    }

    // Two R1 slots per QF: 0–1→QF0, 2–3→QF1, 4–5→QF2, 6–7→QF3
    for (const w of wirings) {
      const targetQfIndex = Math.floor(w.slotIndex / 2);
      const mainQfTarget  = qfMainIds[targetQfIndex];
      const lowerQfTarget = qfLowerIds[targetQfIndex];
      const { error: updErr } = await supabaseAdmin
        .from('matches')
        .update({ feeds_winner_to: mainQfTarget, feeds_loser_to: lowerQfTarget })
        .eq('id', w.r1Id);
      if (updErr) throw new Error(updErr.message);
    }

    const propagateTeam = async (
      nextId: string | null,
      team: string[] | null,
      opponent: string[] | null,
    ) => {
      if (!nextId || !team || team.length === 0) return;

      const { data: nm, error: nmErr } = await supabaseAdmin
        .from('matches')
        .select('id, team_a, team_b, winner')
        .eq('id', nextId)
        .maybeSingle();
      if (nmErr || !nm) return;
      if (nm.winner) return;

      const a: string[] = Array.isArray(nm.team_a) ? nm.team_a : [];
      const b: string[] = Array.isArray(nm.team_b) ? nm.team_b : [];

      const eq = (x: string[], y: string[]) => x.length === y.length && x.every((id, i) => id === y[i]);
      const overlap = (x: string[], y: string[]) => x.some((id) => y.includes(id));

      const originPlayers = new Set([...(team ?? []), ...(opponent ?? [])]);
      const aHasOrigin = a.some((id) => originPlayers.has(id));
      const bHasOrigin = b.some((id) => originPlayers.has(id));
      const aHasTeam = overlap(a, team);
      const bHasTeam = overlap(b, team);

      let target: 'a' | 'b' | null = null;
      if (aHasTeam) target = 'a';
      else if (bHasTeam) target = 'b';
      else if (aHasOrigin && !bHasOrigin) target = 'a';
      else if (bHasOrigin && !aHasOrigin) target = 'b';
      else if (aHasOrigin && bHasOrigin) target = 'a';

      if (aHasOrigin || bHasOrigin) {
        const clearUpdates: { team_a?: string[]; team_b?: string[] } = {};
        if (aHasOrigin && (target !== 'a' || !eq(a, team))) clearUpdates.team_a = [];
        if (bHasOrigin && (target !== 'b' || !eq(b, team))) clearUpdates.team_b = [];

        if (Object.keys(clearUpdates).length > 0) {
          await supabaseAdmin.from('matches').update(clearUpdates).eq('id', nm.id);
        }

        const nextA = clearUpdates.team_a !== undefined ? [] : a;
        const nextB = clearUpdates.team_b !== undefined ? [] : b;

        if (target === 'a') {
          if (!eq(nextA, team)) {
            await supabaseAdmin.from('matches').update({ team_a: team }).eq('id', nm.id);
          }
          return;
        }
        if (target === 'b') {
          if (!eq(nextB, team)) {
            await supabaseAdmin.from('matches').update({ team_b: team }).eq('id', nm.id);
          }
          return;
        }
      }

      if (eq(a, team) || eq(b, team)) return;
      if (overlap(a, team) && a.length < team.length) {
        await supabaseAdmin.from('matches').update({ team_a: team }).eq('id', nm.id);
        return;
      }
      if (overlap(b, team) && b.length < team.length) {
        await supabaseAdmin.from('matches').update({ team_b: team }).eq('id', nm.id);
        return;
      }
      if (a.length === 0) {
        await supabaseAdmin.from('matches').update({ team_a: team }).eq('id', nm.id);
        return;
      }
      if (b.length === 0) {
        await supabaseAdmin.from('matches').update({ team_b: team }).eq('id', nm.id);
        return;
      }
    };

    const { data: r1Winners, error: r1WinnersErr } = await supabaseAdmin
      .from('matches')
      .select('team_a, team_b, winner, feeds_winner_to, feeds_loser_to')
      .eq('event_id', eventId)
      .eq('stage', 'R1')
      .eq('bracket', 'MAIN');
    if (r1WinnersErr) return NextResponse.json({ error: r1WinnersErr.message }, { status: 400 });

    for (const match of r1Winners ?? []) {
      if (!match.winner) continue;
      const teamA: string[] = Array.isArray(match.team_a) ? match.team_a : [];
      const teamB: string[] = Array.isArray(match.team_b) ? match.team_b : [];
      const winnerTeam = match.winner === 'A' ? teamA : teamB;
      const loserTeam = match.winner === 'A' ? teamB : teamA;

      await propagateTeam(match.feeds_winner_to as string | null, winnerTeam, loserTeam);
      await propagateTeam(match.feeds_loser_to as string | null, loserTeam, winnerTeam);
    }

    return NextResponse.json({ ok: true, message: 'R1 ensured (or created), QF/SF/F ensured, R1 wired.' });
  } catch (error: unknown) {
    if (error instanceof Response) return error; // 403 from requireAdminPin
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
