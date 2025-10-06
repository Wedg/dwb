import { NextResponse } from "next/server";

import { requireAdminPin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AddPlayerPayload = {
  name: string;
  seed: number;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function addPlayerFromRequest(req: Request) {
  requireAdminPin(req);

  const { name, seed } = (await req.json()) as Partial<AddPlayerPayload>;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return badRequest("Name required");
  }

  if (!Number.isInteger(seed) || seed < 1 || seed > 16) {
    return badRequest("Seed must be an integer 1..16");
  }

  const trimmedName = name.trim();

  const { data: ev, error: eventErr } = await supabaseAdmin
    .from("events")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventErr) {
    return NextResponse.json({ error: eventErr.message }, { status: 500 });
  }

  if (!ev?.id) {
    return badRequest("No event found");
  }

  const eventId = ev.id as string;

  const [{ data: all, error: listErr }, { data: sameSeed, error: seedErr }] = await Promise.all([
    supabaseAdmin.from("players").select("id").eq("event_id", eventId),
    supabaseAdmin
      .from("players")
      .select("id")
      .eq("event_id", eventId)
      .eq("seed", seed),
  ]);

  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 500 });
  }

  if (seedErr) {
    return NextResponse.json({ error: seedErr.message }, { status: 500 });
  }

  if ((all?.length ?? 0) >= 16) {
    return badRequest("Already have 16 players");
  }

  if ((sameSeed?.length ?? 0) > 0) {
    return badRequest(`Seed ${seed} already taken`);
  }

  const { error: insertErr } = await supabaseAdmin
    .from("players")
    .insert([{ event_id: eventId, name: trimmedName, seed }]);

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
