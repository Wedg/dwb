# Dinner with the Bishop — Tournament Hub

A Next.js application that keeps the entire "Dinner with the Bishop" community in sync during tournament weekends. The site exposes live singles and doubles brackets for spectators while giving tournament directors a streamlined control panel to seed players, wire matches, advance winners, and recover from mistakes in seconds.

## What you can do with this app

### Public views
- **Home hub** – Landing page that links out to every area of the tournament site and exposes a shareable QR code so players can pull the bracket up on their phones in a tap.【F:src/app/page.tsx†L7-L56】
- **Brackets** – Interactive grid that renders Main, Lower, and Doubles draws directly from Supabase so spectators always see the live layout of each stage.【F:src/app/brackets/page.tsx†L7-L120】
- **Matches** – Stage-by-stage list of every match with player names populated from Supabase; TDs can quickly set winners and automatically propagate teams through the bracket.【F:src/app/matches/page.tsx†L8-L200】

### Admin tools
- **Player management** – Add, seed, update, or delete the 16 singles competitors for the current event with safeguards for duplicate seeds and PIN-protected access.【F:src/app/players/page.tsx†L8-L64】【F:src/app/api/admin/players/add/route.ts†L5-L33】【F:src/app/api/admin/players/update/route.ts†L1-L33】
- **TD Control panel** – Dashboard that surfaces current bracket status, recommends the next action, and offers one-click builders for Singles, Doubles, and reset flows.【F:src/app/control/page.tsx†L26-L200】
- **Automation APIs** – Server-side routes that create the entire singles bracket skeleton, spin up doubles from quarterfinal losers, clear results, or reset the tournament while enforcing the admin PIN.【F:src/app/api/admin/build-singles/route.ts†L18-L169】【F:src/app/api/admin/build-doubles/route.ts†L12-L98】【F:src/app/api/admin/clear-result/route.ts†L9-L52】【F:src/app/api/admin/reset/route.ts†L13-L76】

## Architecture at a glance
- **Framework**: Next.js App Router with client-side pages for most interactions.
- **Data layer**: Supabase stores three core tables—`events`, `players`, and `matches`—which the UI queries with the anonymous key and mutates through server routes that use the service role key.【F:src/app/matches/page.tsx†L35-L102】【F:src/app/api/admin/build-singles/route.ts†L22-L169】
- **Security**: Admin-only endpoints require a PIN delivered via the `x-admin-pin` header; the PIN is prompted once and cached locally in the browser.【F:src/lib/adminAuth.ts†L1-L6】【F:src/lib/adminClient.ts†L2-L25】

## Getting started locally

### Prerequisites
- Node.js 18 or newer (matches Next.js requirement)
- A Supabase project with the tables described below

### Environment variables
Create a `.env.local` file and supply the following keys:

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL used by the browser client.【F:src/lib/supabaseClient.ts†L1-L7】 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key for read access from public pages.【F:src/lib/supabaseClient.ts†L1-L7】 |
| `SUPABASE_SERVICE_ROLE` | Supabase service role key used by server actions to write to the database.【F:src/lib/supabaseAdmin.ts†L1-L8】 |
| `ADMIN_PIN` | Shared secret required to call any admin route; distribute to trusted TDs only.【F:src/lib/adminAuth.ts†L1-L6】 |
| `NEXT_PUBLIC_SITE_URL` *(optional)* | Overrides the QR code/link shown on the home page when running locally or on preview builds.【F:src/app/page.tsx†L8-L18】 |

### Install and run
```bash
npm install
npm run dev
```
Visit `http://localhost:3000` to load the hub.

### Linting & build
```bash
npm run lint
npm run build
```

## Supabase schema reference
Below is a minimal schema that matches what the application expects. Adjust column defaults or constraints to suit your project.

```sql
-- Events table – create a new row per tournament weekend
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz default timezone('utc', now())
);

-- Players (exactly 16 per event, seeds 1..16)
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  name text not null,
  seed int not null check (seed between 1 and 16),
  created_at timestamptz default timezone('utc', now())
);
create unique index if not exists players_event_seed_idx on public.players(event_id, seed);

-- Matches for both singles and doubles draws
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  bracket text not null check (bracket in ('MAIN','LOWER','DOUBLES')),
  stage text not null check (stage in ('R1','QF','SF','F')),
  round_num int not null,
  team_a text[] not null default '{}',
  team_b text[] not null default '{}',
  winner text check (winner in ('A','B')),
  feeds_winner_to uuid references public.matches(id),
  feeds_loser_to uuid references public.matches(id),
  is_doubles boolean not null default false,
  created_at timestamptz default timezone('utc', now())
);
```
The UI expects exactly 16 seeded singles players and uses the match wiring logic in the admin routes to connect winners/losers across brackets.【F:src/app/api/admin/players/add/route.ts†L10-L29】【F:src/app/api/admin/build-singles/route.ts†L32-L167】【F:src/app/api/admin/build-doubles/route.ts†L22-L98】

## Typical TD workflow
1. **Create the event row** in Supabase (or reuse the latest event record).
2. **Add 16 players with unique seeds** through the Players admin page; the app enforces max players and seed uniqueness.【F:src/app/players/page.tsx†L20-L63】【F:src/app/api/admin/players/add/route.ts†L10-L29】
3. **Open TD Control** and run the Singles builder to create Round 1 plus the downstream brackets.【F:src/app/control/page.tsx†L146-L200】【F:src/app/api/admin/build-singles/route.ts†L53-L167】
4. **Record match winners** from the Matches page; results automatically advance teams to the next round or the Lower bracket.【F:src/app/matches/page.tsx†L133-L199】
5. **Build Doubles** once all singles quarterfinals are complete—the API pairs QF losers into doubles semifinals and final.【F:src/app/control/page.tsx†L117-L180】【F:src/app/api/admin/build-doubles/route.ts†L32-L98】
6. **Use reset tools** if you need to clear matches or rebuild Round 1 from seeds without touching the player list.【F:src/app/control/page.tsx†L183-L200】【F:src/app/api/admin/reset/route.ts†L28-L76】

## Deployment notes
- The production site can be hosted on Vercel (default Next.js target) or any platform that supports Next.js.
- Provision `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE`, and `ADMIN_PIN` secrets in your hosting provider.
- Lock down the service role key—only server-side environments should have access to it.

Happy directing, and have a great event! 🏆
