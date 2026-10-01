# CLAUDE.md

Project notes for Claude Code working in this repo. Read `README.md` first for the user-facing description; this file captures practical knowledge that isn't in the README.

## What this app is
"Dinner with the Bishop" tournament hub. A 16-player single-elimination chess draw with a parallel "Pudel König" lower bracket (R1 losers) and a "Anthony Prangley Twin Bishops and Bar Bill" doubles draw built from the eight singles QF losers. Run once a year for the club's "Spring Champs" event; spectators view live brackets on phones via QR code, the TD drives state from a PIN-protected admin panel.

## Stack & layout
- **Next.js 15 (App Router)** + **React 19** + **TypeScript** + **Tailwind v4**.
- **Supabase** for storage (3 tables: `events`, `players`, `matches`). Anonymous key for public reads, service-role key for server-side writes.
- All pages are `"use client"` and read directly from Supabase. Mutations always go through `/src/app/api/admin/*` server routes, which gate on `x-admin-pin`.
- Tests: **vitest** for the pure modules in `src/lib` (`npm test`). Linting: ESLint (build is configured to ignore lint errors via `next.config.ts`).

```
src/
  app/
    page.tsx                    home + QR
    layout.tsx                  global nav
    brackets/page.tsx           public bracket grid (tabs: MAIN/LOWER/DOUBLES)
    matches/page.tsx            stage-by-stage list; tap a name to set the winner, clear result
    players/page.tsx            roster + seed up/down + delete
    control/page.tsx            TD dashboard: tournaments (new/rename/delete past) + builders + reset
    api/admin/
      build-singles/            create+wire R1→QFs, ensure QF/SF/F skeleton
      build-doubles/            random doubles draw from 8 QF losers; re-press patches it after QF corrections
      set-winner/               set winner; auto-place into feeds_winner_to / feeds_loser_to
      clear-result/             clear winner; pull team back from downstream slots
      reset/                    delete all matches in the current tournament (players kept)
      events/{create,rename,delete}/  tournaments; delete refuses the current one
      players/{add,update,delete,shuffle}/  add takes { names: [] } for bulk
  lib/
    supabaseClient.ts           browser (anon)
    supabaseAdmin.ts            server (service role)
    adminAuth.ts                requireAdminPin() — header check
    adminClient.ts              ensurePin() + adminFetch() — localStorage `dwb_admin_pin`
    bracket.ts                  pure bracket logic (canonicalPairs, planPlaceTeam, …)
    bracket.test.ts             vitest tests for bracket.ts
    seeding.ts                  pure roster/seed logic (bulk add, swap, shuffle)
    seeding.test.ts             vitest tests for seeding.ts
    events.ts (+ .test.ts)      tournament name helpers
  components/
    Toast.tsx                   bottom-of-screen message used by the admin pages
db/
  schema.sql                    tables + RLS policies + realtime publication
docs/
  SETUP.md                      step-by-step Supabase + Vercel walkthrough
```

## Data model invariants
- **Current event = newest event**: `events` ordered by `created_at desc limit 1`. TD Control → *Start new tournament* inserts a row, which switches every page to it; older events are kept as history (invisible to the app) until deleted from the *Past tournaments* list. The current event can't be deleted (that would silently revive the previous one). Event names needn't be unique. The name shows on the home page, Brackets page and TD Control.
- **Players**: exactly 16 per event, with unique `seed` 1..16. The singles builder errors out otherwise. Uniqueness is the `players_event_seed_key` constraint, which is `DEFERRABLE` (checked at end of statement), so **any seed change that touches more than one player must be a single statement**: the routes send one `upsert` of full rows. Two separate updates always fail with a duplicate key error; that was the old swap bug. Seeding logic (bulk add, swap, shuffle) lives in `src/lib/seeding.ts`.
- **Roster lock**: once any match exists for the event, `players/update` (seed), `players/shuffle` and `players/delete` refuse with 409, because R1 holds player ids. Renames are always allowed; renaming is how to swap in a substitute.
- **Matches**: rows are flat. `bracket ∈ {MAIN, LOWER, DOUBLES}`, `stage ∈ {R1, QF, SF, F}`. `team_a` / `team_b` are `text[]` of player IDs (length 1 for singles, 2 for doubles, `[]` for TBD).
- **Bracket wiring** lives on each match: `feeds_winner_to` / `feeds_loser_to` point at the next match's `id`. There is no separate edges table.
- **Canonical R1 seed pairs** (hard-coded in two routes — keep in sync): `[1,16],[8,9],[5,12],[4,13],[3,14],[6,11],[7,10],[2,15]`.
- **R1→QF mapping**: R1 slots 0–1 → QF0, 2–3 → QF1, 4–5 → QF2, 6–7 → QF3 (where slot index = position in canonical pairs). Winners feed MAIN QFs; losers feed LOWER QFs.
- **Doubles**: built once all 8 QFs (MAIN+LOWER) have winners. The 8 losers are shuffled (random draw, the club's choice), then consecutive pairs form 4 teams; SF1 = team[0] vs team[3], SF2 = team[1] vs team[2]; both feed the single F. Doubles aren't linked to the QFs by feeds, so a QF correction doesn't reach them by itself: pressing Build Doubles again runs `planDoublesSwaps` (swap the old loser for the new one in place), redraws if it can't patch, and refuses once any doubles result exists.
- **Wiring order**: build-singles wires R1 into QFs in `qfWiringOrder` (QFs grouped by the SF they feed). Plain id order paired the semis at random; that was a bug. Already-wired R1 matches are left alone on re-runs.
- **Display order**: the Brackets and Matches pages sort with `drawOrder` (R1 by canonical slot, later rounds by the earliest slot that feeds them), so it reflects the actual feeds. Don't sort matches by id for display.
- **Result guards**: set-winner and clear-result refuse (409) when the match feeds a match that already has a result, and set-winner refuses while a side is TBD (`resultChangeProblem`). Otherwise the downstream match would keep a stale player.

## Admin auth model (important + thin)
- Single shared PIN in `ADMIN_PIN` env var. Header `x-admin-pin` checked by `requireAdminPin()` (`src/lib/adminAuth.ts`). String equality.
- The browser caches the PIN in `localStorage` under `dwb_admin_pin` after the first prompt; a 403 clears it so the next action re-prompts. There's no logout, no expiry, no rate limiting, no audit log. Treat as "shared secret good enough for one weekend".

## Local dev
```
npm install
npm run dev    # next dev --turbopack on :3000
npm run lint
npm run build
```
Required env in `.env.local` (none of these are committed):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE`
- `ADMIN_PIN`
- `NEXT_PUBLIC_SITE_URL` (optional; controls QR code value)

## Deployment
- Hosted on **Vercel**. Production fallback URL hard-coded in `src/app/page.tsx` is `https://dwb-theta.vercel.app` — that's the live host. `.vercel` is gitignored. There is no `vercel.json` checked in; Vercel uses the Next.js defaults plus dashboard-set env vars.
- All four env vars above must be set in the Vercel project. Service-role and PIN should only be set as server env vars (never `NEXT_PUBLIC_`).

## Known sharp edges
A bunch of these were patched in PRs #7–17 (see `git log`); they're worth knowing because the patterns recur:
- The propagation logic in `set-winner`, `build-singles`, and `clear-result` is non-trivial — it has to handle re-corrections (changing a winner after downstream slots are populated). If you change one, look at the others.
- "Latest event" is implicit. Starting a new tournament (or inserting an `events` row in Supabase) mid-tournament instantly hides the existing players/matches from the UI. They're still there, and deleting the new event brings them back.
- `next.config.ts` sets `eslint.ignoreDuringBuilds: true` — lint errors will not fail a Vercel deploy.
- Tournament UI loads on mount only — no Supabase realtime subscription. Spectators must refresh to see new winners.
- README path citations (`【F:...】`) reference some pre-rename paths (e.g. `src/app/players/add/route.ts` instead of `src/app/api/admin/players/add/route.ts`). The architecture description is still accurate.

## When making changes
- Run `npm run lint`, `npm test`, and `npm run build` before claiming done.
- Bracket-logic changes belong in `src/lib/bracket.ts` (pure, no Supabase). The admin routes are thin wrappers that read from / write to Supabase and call into `bracket.ts`. Add a test in `bracket.test.ts` for any logic change — it's the only safety net we have for the propagation rules.
- For end-to-end sanity, also walk through the UI: build singles → set R1 winners → QFs → build doubles → SF/F → clear a result mid-stream.
- Admin endpoints expect `POST` with JSON body and the `x-admin-pin` header. New admin endpoints should call `requireAdminPin(req)` first and follow the existing `try/catch` pattern that re-throws `Response` instances.
- Schema changes go in `db/schema.sql`. The file is idempotent — re-running it is safe.

## Git conventions
- Develop branch `dev` exists for current resurrection work. Main is the deployed branch (Vercel auto-deploys it).
- Commit messages in history are short imperative sentences (e.g. "Fix bracket advancement when correcting winners"). PRs are squash-merged.
