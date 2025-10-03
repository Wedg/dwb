// src/app/api/admin/set-winner/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { matchId, winner } = await req.json() as { matchId: string; winner: 'A'|'B' };

    // Load match
    const { data: m, error } = await supabaseAdmin
      .from('matches')
      .select('id, team_a, team_b, winner, feeds_winner_to, feeds_loser_to, is_doubles')
      .eq('id', matchId)
      .maybeSingle();
    if (error || !m) return NextResponse.json({ error: 'Match not found' }, { status: 400 });

    // Update winner
    const { error: uErr } = await supabaseAdmin
      .from('matches')
      .update({ winner })
      .eq('id', m.id);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

    const teamA: string[] = Array.isArray(m.team_a) ? m.team_a : [];
    const teamB: string[] = Array.isArray(m.team_b) ? m.team_b : [];
    const winnerTeam = winner === 'A' ? teamA : teamB;
    const loserTeam  = winner === 'A' ? teamB : teamA;

    async function placeTeam(nextId: string | null, team: string[] | null) {
      if (!nextId || !team || team.length === 0) return;
      const { data: nm, error: nmErr } = await supabaseAdmin
        .from('matches')
        .select('id, team_a, team_b, winner')
        .eq('id', nextId)
        .maybeSingle();
      if (nmErr || !nm) return;

      // don't touch decided matches
      if (nm.winner) return;

      const a: string[] = nm.team_a ?? [];
      const b: string[] = nm.team_b ?? [];

      const eq = (x: string[], y: string[]) => x.length === y.length && x.every((id, i) => id === y[i]);
      const overlap = (x: string[], y: string[]) => x.some((id) => y.includes(id));

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
      // both filled → skip
    }

    await placeTeam(m.feeds_winner_to, winnerTeam);
    await placeTeam(m.feeds_loser_to,  loserTeam);

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error; // 403 from requireAdminPin
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
