-- "Dinner with the Bishop" tournament hub — database schema.
--
-- Apply this against a fresh Supabase project (paste into the SQL Editor).
-- Idempotent: safe to re-run; existing objects are preserved.
--
-- See docs/SETUP.md for hold-me-by-the-hand instructions.


-- Tables -----------------------------------------------------------

create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  created_at  timestamptz not null default timezone('utc', now())
);

create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  name        text not null,
  seed        int  not null check (seed between 1 and 16),
  created_at  timestamptz not null default timezone('utc', now())
);

create unique index if not exists players_event_seed_idx
  on public.players (event_id, seed);

create table if not exists public.matches (
  id               uuid primary key default gen_random_uuid(),
  event_id         uuid not null references public.events(id) on delete cascade,
  bracket          text not null check (bracket in ('MAIN','LOWER','DOUBLES')),
  stage            text not null check (stage in ('R1','QF','SF','F')),
  round_num        int  not null,
  team_a           text[] not null default '{}',
  team_b           text[] not null default '{}',
  winner           text check (winner in ('A','B')),
  feeds_winner_to  uuid references public.matches(id),
  feeds_loser_to   uuid references public.matches(id),
  is_doubles       boolean not null default false,
  created_at       timestamptz not null default timezone('utc', now())
);

create index if not exists matches_event_bracket_stage_idx
  on public.matches (event_id, bracket, stage);


-- Row-level security -----------------------------------------------
--
-- The app uses two Supabase keys:
--   * anon key — used by the browser for public reads (every page)
--   * service-role key — used by /api/admin/* server routes for writes
--
-- The service-role key BYPASSES row-level security entirely, so all
-- admin functionality keeps working without explicit policies.
--
-- For the anon role we want SELECT only — never INSERT/UPDATE/DELETE.
-- That way even if the anon key leaks, an attacker can't mutate state;
-- they can already see public bracket data anyway.

alter table public.events  enable row level security;
alter table public.players enable row level security;
alter table public.matches enable row level security;

drop policy if exists "anon read events"  on public.events;
create policy "anon read events" on public.events
  for select to anon using (true);

drop policy if exists "anon read players" on public.players;
create policy "anon read players" on public.players
  for select to anon using (true);

drop policy if exists "anon read matches" on public.matches;
create policy "anon read matches" on public.matches
  for select to anon using (true);


-- Realtime publication ---------------------------------------------
--
-- Adding tables to supabase_realtime lets the browser subscribe to
-- live row changes. We don't subscribe yet (Phase 5), but enabling
-- the publication now means we don't have to come back to the SQL
-- editor later.

do $$
declare
  t text;
begin
  for t in select unnest(array['events','players','matches']) loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
