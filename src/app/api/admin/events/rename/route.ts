import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireAdminPin } from '@/lib/adminAuth';
import { parseEventName } from '@/lib/events';

// Body: { id, name }.
export async function POST(req: Request) {
  try {
    requireAdminPin(req);
    const { id, name } = await req.json() as { id?: string; name?: unknown };
    if (!id) return NextResponse.json({ error: 'Tournament id required' }, { status: 400 });

    const parsed = parseEventName(name);
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('events').update({ name: parsed.name }).eq('id', id).select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!data?.length) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });

    return NextResponse.json({ ok: true, message: `Renamed to "${parsed.name}".` });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
