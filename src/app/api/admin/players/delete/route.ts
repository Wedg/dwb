import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { id } = await req.json() as { id: string };
    if (!id) return NextResponse.json({ error: 'Player id required' }, { status: 400 });

    const { error } = await supabaseAdmin.from('players').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
