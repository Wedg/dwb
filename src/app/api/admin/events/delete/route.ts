import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';

// Body: { id }. Permanently deletes a past tournament with its players and
// matches (ON DELETE CASCADE). The current tournament can't be deleted:
// deleting it would silently bring the previous one back as current.
export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { id } = await req.json() as { id?: string };
    if (!id) return NextResponse.json({ error: 'Tournament id required' }, { status: 400 });

    const { data: current, error: evErr } = await supabaseAdmin
      .from('events').select('id').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (evErr) return NextResponse.json({ error: `Event lookup failed: ${evErr.message}` }, { status: 500 });
    if (current?.id === id) {
      return NextResponse.json({
        error: "That's the current tournament, so it can't be deleted. Start a new tournament first; this one then moves to Past tournaments.",
      }, { status: 409 });
    }

    const { data, error } = await supabaseAdmin.from('events').delete().eq('id', id).select('name');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data?.length) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    return NextResponse.json({ ok: true, message: `Deleted "${data[0].name ?? 'Untitled'}".` });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
