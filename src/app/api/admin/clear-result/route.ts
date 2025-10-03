// src/app/api/admin/clear-result/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';

const arraysEqual = (x: string[] = [], y: string[] = []) =>
  x.length === y.length && x.every((id, i) => id === y[i]);

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

    async function removeTeam(nextId: string | null, team: string[] | null) {
      if (!nextId || !team || team.length === 0) return;
      const { data: nm, error: nmErr } = await supabaseAdmin
        .from('matches')
        .select('id, team_a, team_b, winner')
        .eq('id', nextId)
        .maybeSingle();
      if (nmErr || !nm) return;
      if (nm.winner) return; // don't touch decided matches

      const a: string[] = nm.team_a ?? [];
      const b: string[] = nm.team_b ?? [];

      if (arraysEqual(a, team)) {
        await supabaseAdmin.from('matches').update({ team_a: [] }).eq('id', nm.id);
      } else if (arraysEqual(b, team)) {
        await supabaseAdmin.from('matches').update({ team_b: [] }).eq('id', nm.id);
      }
    }

    if (m.winner) {
      const teamA: string[] = Array.isArray(m.team_a) ? m.team_a : [];
      const teamB: string[] = Array.isArray(m.team_b) ? m.team_b : [];
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
