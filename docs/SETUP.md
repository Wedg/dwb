# Reviving the tournament hub: Supabase + Vercel setup

A hold-me-by-the-hand walkthrough for standing up a fresh Supabase project, applying the schema, and deploying to Vercel. Total time: ~30 minutes, mostly waiting for things to provision.

You'll do the clicking; I'll handle the code-side updates (changing the QR-code URL, adding a keep-alive workflow, etc.) once you tell me what's been provisioned.

---

## Part 0 — Check before you rebuild

Supabase's free tier *pauses* an inactive project first and only *deletes* it later (see Part 4). A paused project can be **resumed with one click and all data intact** — a very different outcome from a deleted one, which needs everything below.

1. Log into <https://supabase.com/dashboard>.
2. Look for a `dwb` (or similarly named) project, including under a "paused" filter/section.
3. **Found it, paused?** Click **Resume**, wait for it to come back online, then skip to 1.4 to re-grab the keys (they don't change on resume) — you can skip schema creation and the event insert entirely.
4. **Found it, but empty/broken, or genuinely gone?** Continue with Part 1 below to rebuild from scratch.

## Part 1 — Supabase

### 1.1 Create the project

1. Go to <https://supabase.com> → **Start your project** (top right) → sign in with GitHub.
2. On the dashboard click **New project**.
3. Fill in:
   - **Project name**: `dwb` (anything's fine)
   - **Database password**: click "Generate" and save it somewhere — you won't usually need it again, but losing it can be annoying.
   - **Region**: pick the one closest to your venue. For a club in Europe, `eu-central-1` (Frankfurt) is a good default.
   - **Pricing plan**: Free.
4. Click **Create new project**. Wait ~2 minutes for provisioning to finish.

### 1.2 Apply the schema

1. In the Supabase dashboard left sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open `db/schema.sql` from this repo (the file we just created), select all, copy.
4. Paste into the SQL Editor.
5. Click **Run** (or press Ctrl-Enter / Cmd-Enter).
6. You should see "Success. No rows returned" at the bottom.

What you just did: created the three tables (`events`, `players`, `matches`), turned on row-level security so the public anon key can only read (never write), and enabled real-time so we can wire up live spectator updates later.

### 1.3 Create the first event row

The app always uses "the latest event by `created_at`", so you need exactly one event row to exist before any of the pages will load data.

1. Still in SQL Editor, run:
   ```sql
   insert into public.events (name) values ('Spring Champs 2026');
   ```
2. You should see "Success. 1 row affected".

Sanity check: left sidebar → **Table Editor** → click `events`. You should see one row.

### 1.4 Capture the keys

You need three pieces of info from Supabase to give to Vercel.

1. Left sidebar → click the gear icon **Project Settings** at the bottom.
2. Click **API** in the settings menu.
3. On this page, copy these three values into a temporary text file (we'll paste them into Vercel in Part 2):

   - **Project URL** — looks like `https://abcdefghij.supabase.co`. Goes into `NEXT_PUBLIC_SUPABASE_URL`.
   - **anon public** API key — a long JWT starting with `eyJ...`. Goes into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   - **service_role** API key — also a long JWT starting with `eyJ...`. Click "Reveal" to see it. Goes into `SUPABASE_SERVICE_ROLE`.

> ⚠️ **The service_role key bypasses all security.** Treat it like a password.
> Never paste it into client-side code, never commit it to git, never share it in Slack/email.
> It only ever lives in server-side environment variables (Vercel + your local `.env.local`).

---

## Part 2 — Vercel

### 2.0 Check whether a Vercel project already exists

Don't assume you're starting from zero here — only the Supabase project is confirmed gone. A Vercel security-bot PR (#19, merged May 2026) referenced a live project at `vercel.com/wedgs-projects/dwb-9nty`, so a project connected to this repo may still exist.

1. Go to <https://vercel.com/dashboard> and look for a project already linked to `Wedg/dwb` (possibly named `dwb-9nty` or similar, not necessarily `dwb-theta` — that name only appears as a hardcoded fallback in the code, it isn't confirmed as the current production URL).
2. **Found one?** Skip straight to 2.2 — open its **Settings → Environment Variables**, update the four values there (they almost certainly point at the deleted Supabase project), then jump to **Settings → Deployments** and redeploy. You don't need to re-import the repo.
3. **Nothing there?** Follow 2.1 onward to import fresh.

### 2.1 Connect the GitHub repo

1. Go to <https://vercel.com/new>.
2. Sign in with GitHub if you aren't already.
3. Find the `Wedg/dwb` repo in the list and click **Import**.
   (If you don't see it, click "Adjust GitHub App Permissions" and grant access to the repo.)

### 2.2 Configure environment variables

Before clicking Deploy, expand the **Environment Variables** section and add four entries:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | (Supabase Project URL from 1.4) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (Supabase anon key from 1.4) |
| `SUPABASE_SERVICE_ROLE` | (Supabase service_role key from 1.4) |
| `ADMIN_PIN` | A short PIN you'll type into the admin panel — pick something memorable, e.g. 4–8 digits |

For each row: paste the name on the left, the value on the right, leave "All Environments" selected, click **Add**.

### 2.3 Deploy

Click **Deploy**. Wait ~2 minutes for the build.

When it finishes, Vercel shows a confetti animation and a link like `https://dwb-xxxxxx.vercel.app`. Click it — you should see the home page with a QR code.

### 2.4 Add the production URL as an env var

The QR code on the home page currently points to a hardcoded fallback (`dwb-theta.vercel.app`). Setting `NEXT_PUBLIC_SITE_URL` makes it use the right URL.

1. In the Vercel project dashboard, go to **Settings** → **Environment Variables**.
2. Add one more entry:
   - **Name**: `NEXT_PUBLIC_SITE_URL`
   - **Value**: your production URL (e.g. `https://dwb-xxxxxx.vercel.app`)
3. Go to **Deployments**, find the most recent one, click the `...` menu → **Redeploy**.

### 2.5 Tell me the production URL

Paste the production URL here in the chat and I'll update the hardcoded fallback in `src/app/page.tsx` so even without `NEXT_PUBLIC_SITE_URL` set the QR code is correct. (Belt-and-braces.)

---

## Part 3 — Smoke test

Open the production URL in your browser. The first time you do anything admin, the app will prompt for the PIN you set in 2.2 — it then caches it in your browser's localStorage.

Walk through:

1. **Players** page → add 16 players with seeds 1–16.
2. **TD Control** → click **Build singles bracket**.
3. **Matches** page → confirm 8 R1 matches appear under "DwB Spring Champs".
4. Set winners on a couple of R1 matches → check they appear in the corresponding QF.
5. **TD Control** → use **Reset: Delete all matches** to undo and try again from scratch if you want.

If anything goes wrong, copy the exact error message and paste it here.

---

## Part 4 — Optional: keep the Supabase project alive

Supabase's free tier pauses projects with no database activity for ~1 week, and deletes them after ~90 days of being paused. Last year's project is almost certainly already gone for this reason.

To prevent it happening again, we can add a small GitHub Actions workflow that runs a harmless `select 1` query weekly. Tell me when you've finished Parts 1–3 and I'll add it to the repo.

---

## Troubleshooting

**"No event found" on every page** → You skipped step 1.3. Run the `insert into public.events ...` SQL.

**"Forbidden: bad admin PIN" when clicking buttons** → The PIN you typed in the browser doesn't match `ADMIN_PIN` in Vercel env vars. To reset: open browser DevTools → Application → Local Storage → delete `dwb_admin_pin`, refresh, retype.

**Build fails immediately with `Error: supabaseUrl is required`** → All three Supabase env vars must be set *before* the first build, not just before runtime: `src/lib/supabaseAdmin.ts` calls `createClient()` at module load time, and Next.js imports every `api/admin/*` route during `next build` (the "Collecting page data" step) to prerender the rest of the app — so a missing/empty `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE` fails the whole build, confirmed by reproducing it locally. Double-check all three are saved in Vercel's Environment Variables *before* triggering a deploy.

**Build fails on Vercel with "Failed to fetch Geist from Google Fonts"** → This was a sandbox-only issue while developing; it shouldn't happen on Vercel. If it does, share the error.

**Anon-key SELECT works but writes silently fail** → That means RLS is enabled (correct) but a route is somehow using the anon key for writes (incorrect). All writes must go through `/api/admin/*` server routes. If you've added a new admin endpoint, make sure it imports `supabaseAdmin` and not `supabase`.
