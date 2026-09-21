// src/lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// SUPABASE_SERVICE_ROLE_KEY is what the Supabase Vercel integration manages;
// SUPABASE_SERVICE_ROLE is the legacy name from manual setup. Accept either.
const key  = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE)!; // server-only
export const supabaseAdmin = createClient(url, key, {
  auth: { persistSession: false },
});