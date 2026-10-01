# Dinner with the Bishop — Tournament Hub

A Next.js application that keeps the entire "Dinner with the Bishop" community in sync during tournament weekends. The site exposes live singles and doubles brackets for spectators while giving tournament directors a streamlined control panel to seed players, wire matches, advance winners, and recover from mistakes in seconds.

## What you can do with this app

### Public views
- **Home hub** – The tournament name, a big way into the brackets, the champions once finals are decided, a three-step "how the evening works", and a QR code to share at the venue.
- **Brackets** – One tab per trophy. On phones you step through the rounds (opening on the round being played); on bigger screens you get the whole tree. Finished brackets show their champion. Empty slots say who they're waiting for ("Winner of Tom v Grant").
- **Follow a player** – Pick your name once and the site remembers it on that phone: a card shows the next match ("Up next: Quarterfinal v Sarah"), and that player's matches are starred everywhere.
- **Matches** – Every match round by round. Read-only for spectators; on the TD's phone (TD mode) you tap the winner's name to record results.
- **Always fresh** – Public pages update every 30 seconds and whenever you come back to them, with "Updated just now" and a Refresh button.
- **Looks right when shared** – Bishop icon for the browser tab and home screen, and a preview card when the link is posted in WhatsApp or iMessage.

### Admin tools
- **Player management** – Paste the 16 singles competitors in one go, randomise or hand-adjust the seeds, rename, or remove players, all behind the admin PIN. The roster locks once the bracket is built (renames still allowed, for substitutes). See `src/app/players/page.tsx`, `src/app/api/admin/players/*`, and the pure logic in `src/lib/seeding.ts`.
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

## Database schema
The canonical schema lives in [`db/schema.sql`](./db/schema.sql) — paste it into the Supabase SQL editor for a fresh project (it's idempotent, safe to re-run). It creates `events`, `players`, and `matches`, enables row-level security with anon-**read-only** policies (writes only ever happen through the service-role key in the admin routes), and turns on the realtime publication for future live-update support.

For a full guided walkthrough — new Supabase project → schema → Vercel env vars → deploy → smoke test — see [`docs/SETUP.md`](./docs/SETUP.md).

The UI expects exactly 16 seeded singles players and uses the match wiring logic in [`src/lib/bracket.ts`](./src/lib/bracket.ts) (called from the admin routes) to connect winners/losers across brackets.

## Typical TD workflow
1. **Start the tournament** from TD Control (name it, optionally copy last year's players). Older tournaments are kept under *Past tournaments* and can be deleted there, e.g. after a test run.
2. **Add the 16 players** on the Players admin page by pasting a list (one name per line; new players take the lowest free seeds in order), then click **Randomise seeds** or adjust seeds by hand. The app enforces max players and seed uniqueness.
3. **Open TD Control** and run the Singles builder to create Round 1 plus the downstream brackets.【F:src/app/control/page.tsx†L146-L200】【F:src/app/api/admin/build-singles/route.ts†L53-L167】
4. **Record match winners** from the Matches page by tapping the winner's name; results automatically advance teams to the next round or the Lower bracket.
5. **Build Doubles** once all singles quarterfinals are complete. The eight QF losers are drawn into four random teams, two semifinals and a final. Press it again after correcting a QF result and only that player is swapped.
6. **Reset bracket** if you need to start the draw again. It deletes every match and result but keeps the players, so you can re-seed and build again.

## Deployment notes
- The production site can be hosted on Vercel (default Next.js target) or any platform that supports Next.js.
- Provision `NEXT_PUBLIC_*`, `SUPABASE_SERVICE_ROLE`, and `ADMIN_PIN` secrets in your hosting provider.
- Lock down the service role key—only server-side environments should have access to it.

Happy directing, and have a great event! 🏆
