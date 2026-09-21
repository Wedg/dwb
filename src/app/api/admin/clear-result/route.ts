// src/app/api/admin/clear-result/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';
import { planRemoveTeam, type MatchSlots, type Team } from '@/lib/bracket';

async function removeTeam(nextId: string | null, team: Team) {
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
  const patch = planRemoveTeam(slots, team);
  if (patch) {
    await supabaseAdmin.from('matches').update(patch).eq('id', nm.id);
  }
}

export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { matchId } = await req.json() as { matchId: string };

    const { data: m, error } = await supabaseAdmin
      .from('matches')
      .select('id, team_a, team_b, winner, feeds_winner_to, feeds_loser_to')
      .eq('id', matchId)
      .maybeSingle();
    if (error || !m) return NextResponse.json({ error: 'Match not found' }, { status: 400 });

    if (m.winner) {
      const teamA: Team = Array.isArray(m.team_a) ? m.team_a : [];
      const teamB: Team = Array.isArray(m.team_b) ? m.team_b : [];
      const winnerTeam = m.winner === 'A' ? teamA : teamB;
      const loserTeam  = m.winner === 'A' ? teamB : teamA;

      await removeTeam(m.feeds_winner_to, winnerTeam);
      await removeTeam(m.feeds_loser_to,  loserTeam);
    }

    await supabaseAdmin.from('matches').update({ winner: null }).eq('id', m.id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
