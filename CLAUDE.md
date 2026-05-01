# CLAUDE.md

Project notes for Claude Code working in this repo. Read `README.md` first for the user-facing description; this file captures practical knowledge that isn't in the README.

## What this app is
"Dinner with the Bishop" tournament hub. A 16-player single-elimination chess draw with a parallel "Pudel König" lower bracket (R1 losers) and a "Anthony Prangley Twin Bishops and Bar Bill" doubles draw built from the eight singles QF losers. Run once a year for the club's "Spring Champs" event; spectators view live brackets on phones via QR code, the TD drives state from a PIN-protected admin panel.

## Stack & layout
- **Next.js 15 (App Router)** + **React 19** + **TypeScript** + **Tailwind v4**.
- **Supabase** for storage (3 tables: `events`, `players`, `matches`). Anonymous key for public reads, service-role key for server-side writes.
- All pages are `"use client"` and read directly from Supabase. Mutations always go through `/src/app/api/admin/*` server routes, which gate on `x-admin-pin`.
- Tests: **none**. Linting: ESLint (build is configured to ignore lint errors via `next.config.ts`).

```
src/
  app/
    page.tsx                    home + QR
    layout.tsx                  global nav
    brackets/page.tsx           public bracket grid (tabs: MAIN/LOWER/DOUBLES)
    matches/page.tsx            stage-by-stage list, set/clear winners
    players/page.tsx            roster + seed up/down + delete
    control/page.tsx            TD dashboard + builders/resets
    api/admin/
      build-singles/            create+wire R1→QFs, ensure QF/SF/F skeleton
      build-doubles/            create doubles SF/F from 8 QF losers
      set-winner/               set winner; auto-place into feeds_winner_to / feeds_loser_to
      clear-result/             clear winner; pull team back from downstream slots
      reset/                    matches_only | regen_r1
      players/{add,update,delete}/
  lib/
    supabaseClient.ts           browser (anon)
    supabaseAdmin.ts            server (service role)
    adminAuth.ts                requireAdminPin() — header check
    adminClient.ts              ensurePin() + adminFetch() — localStorage `dwb_admin_pin`
```

## Data model invariants
- Always exactly **one current event**. The "latest event" is `events` ordered by `created_at desc limit 1`. Anything that creates an extra event row will silently switch the app to it — there is no event picker UI.
- **Players**: exactly 16 per event, with unique `seed` 1..16. The singles builder errors out otherwise.
- **Matches**: rows are flat. `bracket ∈ {MAIN, LOWER, DOUBLES}`, `stage ∈ {R1, QF, SF, F}`. `team_a` / `team_b` are `text[]` of player IDs (length 1 for singles, 2 for doubles, `[]` for TBD).
- **Bracket wiring** lives on each match: `feeds_winner_to` / `feeds_loser_to` point at the next match's `id`. There is no separate edges table.
- **Canonical R1 seed pairs** (hard-coded in two routes — keep in sync): `[1,16],[8,9],[5,12],[4,13],[3,14],[6,11],[7,10],[2,15]`.
- **R1→QF mapping**: R1 slots 0–1 → QF0, 2–3 → QF1, 4–5 → QF2, 6–7 → QF3 (where slot index = position in canonical pairs). Winners feed MAIN QFs; losers feed LOWER QFs.
- **Doubles**: built once all 8 QFs (MAIN+LOWER) have winners. Pairs of consecutive losers form 4 teams; SF1 = team[0] vs team[3], SF2 = team[1] vs team[2]; both feed the single F.

## Admin auth model (important + thin)
- Single shared PIN in `ADMIN_PIN` env var. Header `x-admin-pin` checked by `requireAdminPin()` (`src/lib/adminAuth.ts`). String equality.
- The browser caches the PIN in `localStorage` under `dwb_admin_pin` after the first prompt. There's no logout, no expiry, no rate limiting, no audit log. Treat as "shared secret good enough for one weekend".

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
- `reset` with `regen_r1` clears all matches and rebuilds R1 only; the user must then run the singles builder to re-create QF/SF/F skeletons and re-wire feeds. The control page UI tells them this; the API does not enforce it.
- "Latest event" is implicit. Creating a fresh `events` row in Supabase mid-tournament instantly orphans the existing players/matches from the UI.
- `next.config.ts` sets `eslint.ignoreDuringBuilds: true` — lint errors will not fail a Vercel deploy.
- Tournament UI loads on mount only — no Supabase realtime subscription. Spectators must refresh to see new winners.
- README path citations (`【F:...】`) reference some pre-rename paths (e.g. `src/app/players/add/route.ts` instead of `src/app/api/admin/players/add/route.ts`). The architecture description is still accurate.

## When making changes
- Run `npm run lint` and `npm run build` before claiming done. There are no tests to run.
- Bracket logic edits should be sanity-checked against a full walk-through: build singles → set R1 winners → set QF winners → build doubles → set SF/F winners → clear a result mid-stream. The UI is the only test harness.
- Keep `canonicalPairs()` identical in `build-singles/route.ts` and `reset/route.ts`.
- Admin endpoints expect `POST` with JSON body and the `x-admin-pin` header. New admin endpoints should call `requireAdminPin(req)` first and follow the existing `try/catch` pattern that re-throws `Response` instances.

## Git conventions
- Develop branch `dev` exists for current resurrection work. Main is the deployed branch (Vercel auto-deploys it).
- Commit messages in history are short imperative sentences (e.g. "Fix bracket advancement when correcting winners"). PRs are squash-merged.
