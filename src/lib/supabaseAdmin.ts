// src/lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

// NEXT_PUBLIC_SUPABASE_URL must be correct regardless — the browser-side
// pages (supabaseClient.ts) can only ever read a NEXT_PUBLIC_-prefixed var.
// This fallback to the integration's server-only SUPABASE_URL only helps
// the admin routes here; it can't substitute for a wrong/missing
// NEXT_PUBLIC_SUPABASE_URL on the client side.
const url  = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL)!;
// SUPABASE_SERVICE_ROLE_KEY is what the Supabase Vercel integration manages;
// SUPABASE_SERVICE_ROLE is the legacy name from manual setup. Accept either.
const key  = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE)!; // server-only
export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false },
});