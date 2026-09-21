// src/app/api/admin/set-winner/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';
import { planPlaceTeam, type MatchSlots, type Team } from '@/lib/bracket';

async function placeTeam(nextId: string | null, team: Team, opponent: Team) {
  if (!nextId || team.length === 0) return;
  const { data: nm, error } = await supabaseAdmin
    .from('matches')
    .select('id, team_a, team_b, winner')
    .eq('id', nextId)
    .maybeSingle();
  if (error || !nm) return;
  const slots: MatchSlots = {
    team_a: Array.isArray(nm.team_a) ? nm.team_a : [],
    team_b: Array.isArray(nm.team_b) ? nm.team_b : [],
    winner: nm.winner ?? null,
  };
  const patch = planPlaceTeam(slots, team, opponent);
  if (patch) {
    await supabaseAdmin.from('matches').update(patch).eq('id', nm.id);
  }
}

export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { matchId, winner } = await req.json() as { matchId: string; winner: 'A'|'B' };

    const { data: m, error } = await supabaseAdmin
      .from('matches')
      .select('id, team_a, team_b, winner, feeds_winner_to, feeds_loser_to, is_doubles')
      .eq('id', matchId)
      .maybeSingle();
    if (error || !m) return NextResponse.json({ error: 'Match not found' }, { status: 400 });

    const { error: uErr } = await supabaseAdmin
      .from('matches')
      .update({ winner })
      .eq('id', m.id);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

    const teamA: Team = Array.isArray(m.team_a) ? m.team_a : [];
    const teamB: Team = Array.isArray(m.team_b) ? m.team_b : [];
    const winnerTeam = winner === 'A' ? teamA : teamB;
    const loserTeam  = winner === 'A' ? teamB : teamA;

    await placeTeam(m.feeds_winner_to, winnerTeam, loserTeam);
    await placeTeam(m.feeds_loser_to,  loserTeam, winnerTeam);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
