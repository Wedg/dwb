import { NextResponse } from "next/server";

import { addPlayerFromRequest } from "../addPlayer";

export async function POST(req: Request) {
  try {
    return await addPlayerFromRequest(req);
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
