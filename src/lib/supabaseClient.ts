// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is what the Supabase Vercel integration
// manages; NEXT_PUBLIC_SUPABASE_ANON_KEY is the legacy name from manual setup.
// Accept either.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
);
