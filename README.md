# Founders × Founders Week

A student-curated guide to **Founders Week** at the University of Illinois Urbana-Champaign, built by
**Founders – Illinois Entrepreneurs**.

What matters most, in order:

1. **Founders Office Hours** (`/office-hours`). Meet experienced founders and operators one-on-one.
   Mentor profiles, availability, and the application (`/office-hours#apply`). "Apply for Office Hours"
   is the primary call to action everywhere.
2. **Dan Caruso — Fireside Chat** (Mon Sep 28). Supported by Founders. It is information only: there
   is no application.
3. **How to Make $10K/Month in College** (Tue Sep 29, 6–8 PM, 100 MSEB). Co-hosted by Founders.
4. **The Calendar** (`/schedule`, also `/calendar`). The full Founders Week program by day, with
   filters, search, program blocks, overlap detection, shareable links and calendar export.

Organizers review applications and assign appointments in a protected view (`/organizers`).

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · zod · any standard Postgres
(a free Neon database from Vercel's Storage tab is the simplest). An embedded PGlite database covers
local development. No Supabase project is required.

> **Content status:** missing assets and unconfirmed details are listed in
> [docs/CONTENT-STATUS.md](docs/CONTENT-STATUS.md).

---

## Quick start (local)

Requires Node.js 20.9+ (developed on Node 24).

```bash
npm install
cp .env.example .env.local        # then set APP_SECRET and ORGANIZER_PASSWORD
npm run dev                       # http://localhost:3000
```

With `DATABASE_URL=pglite:./.data/pglite` (the default in `.env.example`), applications are stored in a
real embedded Postgres under `./.data/`. It creates and migrates itself on first use. Delete `./.data/`
to start fresh. Only one process can open a PGlite folder at a time.

Preview every visual state with fictional, clearly labeled demo data:

```bash
SHOW_DEMO_CONTENT=true npm run dev      # demo events (overlaps, slots with capacity), demo mentors
SHOW_DRAFT_CONTENT=true npm run dev     # show unapproved mentor copy, labeled DRAFT
```

Both flags are ignored on Vercel production deploys.

## Pages

| Route | What it is |
| --- | --- |
| `/` | Home: Office Hours first (all four mentors + apply), then Dan Caruso, the Sep 29 panel and a calendar preview |
| `/office-hours` | **Primary page.** Mentor lineup and profiles, how matching works, and the application (`#apply`) |
| `/office-hours?mentor=<id>[&window=<id>\|&slot=<id>]#apply` | Application with that mentor (and time) preselected. Every mentor CTA uses this |
| `/office-hours/[id]` | Mentor profile |
| `/schedule` (alias `/calendar`) | Calendar. Filters live in the URL: `?day=2026-10-01`, `?view=picks`, `?type=talk,panel`, `?q=…` |
| `/schedule/[id]` | Shareable event page. Calendar export at `/schedule/[id]/calendar.ics` when the date and time are confirmed. All eligible events: `/schedule/calendar.ics` |
| `/apply` | Redirects to `/office-hours#apply`, keeping `mentor`/`window`/`slot` |
| `/apply/status/[token]` | Applicant's private status page (link shown after applying) |
| `/organizers` | Protected organizer view |

## Editing content

All public content is typed data in [`/content`](content), validated on load. `npm test` or
`npm run build` fails with a readable message on a bad date, duplicate id, a session outside its block,
a slot outside its window, a speaker linked to an unknown mentor, and so on.

**Events:** [`content/events.ts`](content/events.ts)
- `date` is `YYYY-MM-DD`. Times are 24-hour `HH:mm` **Central Time** (America/Chicago), shown as "CT".
  Use `time: { kind: "exact", start, end }`, `{ kind: "part-of-day", part: "morning", before: "12:00" }` or `{ kind: "tba" }`.
- `status`: `confirmed` | `planned` | `tentative` | `canceled`. "Add to calendar" appears only for
  `confirmed` events with an exact start and end.
- `involvement`: `hosted` | `cohosted` | `supported` | `week` | `null`, shown as Hosted / Co-hosted /
  Supported by Founders / Part of Founders Week. Set it only when a source supports it.
- `featured: { rank }`: promotional priority (office hours are always rank 1; Dan Caruso is 2; the
  Sep 29 panel is 3). The calendar itself stays chronological.
- `sessions`: timed sub-sessions of a program block (`people`, with `role: "moderator"` and
  `mentorId` to link an office-hours mentor's profile).
- `related: true`: a related event outside the official program. `callout`: informational note, no CTA.
  `links`: official information links.
- Keep `id` stable once shared, because it is the URL.

**Mentors:** [`content/mentors.ts`](content/mentors.ts). The order in this file is the order on the site.
- `role` and `company` hold verified facts only (`null` when unknown).
- `bio`: concise factual background. `expertise`: grounded in verified information, each with its `basis`.
- `askMeAbout` and `goodFitFor` must come from the mentor: `{ status: "draft" | "approved", value }`.
  Drafts never render publicly.
- `availability`: general **availability windows**, not bookings. An empty list means the mentor shows
  **"Scheduling in progress"** with **"Express interest"**, and students can apply without picking a
  time. Add a window and the button becomes "Apply to meet [first name]" automatically.
- `slots`: specific appointment times inside a window, with a `capacity` and a `status` of `proposed`
  or `confirmed`. Organizers can only *confirm* appointments in `confirmed` slots.
- `organizerNotes`: shown only in the organizer view (for example, scheduling constraints).
- `headshot`: add approved photos under `public/mentors/` (`{ src, alt, width, height }`). Otherwise an
  initials portrait is generated.
- Window and slot ids are stored with applications. Never rename or reuse them.

**Site settings:** [`content/site.ts`](content/site.ts)
- `applications.open` is the master switch. `opensAt`, `deadline` and `decisionsBy` take ISO timestamps
  with an offset (e.g. `"2026-09-28T23:59:00-05:00"`). All are `null` by default; none were invented.
  The deadline is enforced by the API.
- `applications.emailDomains`: accepted "Illinois email" domains (default `illinois.edu`).
- `org.contactEmail`, `org.url`, `week.officialUrl` and `brand` are `null` until supplied.

**Brand assets:** see [`public/brand/README.md`](public/brand/README.md).

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | For applications | Postgres connection string (`postgresql://…`), or `pglite:./.data/pglite` for local use (refused on Vercel) |
| `POSTGRES_URL` | Alternative | Set automatically by Vercel's storage integrations. Used when `DATABASE_URL` is empty |
| `DATABASE_SCHEMA` | No | Keep all tables in their own schema (e.g. `founders_week`) to share a database with another app |
| `DATABASE_AUTO_MIGRATE` | No | `false` turns off automatic table setup on first use (then run `npm run db:migrate`) |
| `APP_SECRET` | In production | ≥ 32 random chars. Signs organizer sessions and applicant status links |
| `ORGANIZER_PASSWORD` | For `/organizers` | Shared organizer password (≥ 12 chars). Changing it signs everyone out |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Canonical origin for share links, social images, sitemap and emails |
| `DATABASE_POOL_MAX` | No | Connections per server instance (default 3) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | No | Acknowledgment email after an application is saved. Selection emails are never automatic |
| `APPLICATION_RATE_LIMIT_PER_HOUR` | No | Submissions per IP per hour (default 10) |
| `APPLICATION_RATE_LIMIT_PER_EMAIL_PER_DAY` | No | Submissions per email per day (default 5) |
| `SHOW_DEMO_CONTENT`, `SHOW_DRAFT_CONTENT` | No | Preview-only content (ignored on production deploys) |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

Until `DATABASE_URL` (or `POSTGRES_URL`) points at a reachable database, and `APP_SECRET` is set in
production, the application stays visible but **submission is disabled with an explanation**. Success
is only ever shown after the database confirms the write.

## Database setup: pick one

The app needs only a standard Postgres connection string. It **creates its own tables on the first
request**, with no SQL to run by hand. Setup is idempotent and locked, so it's safe when several
serverless instances start at once. Nothing depends on Supabase.

### Option A (recommended, free, no Supabase): Vercel Storage → Neon

1. In Vercel, open your project and go to **Storage → Create Database → Neon (Serverless Postgres)**.
   Choose the **Free** plan and a US region, and create it.
2. Click **Connect Project**, select this project and all environments. Vercel adds `DATABASE_URL`
   and `POSTGRES_URL` automatically. The app reads either.
3. In **Settings → Environment Variables**, add:
   - `APP_SECRET`: 32+ random characters (`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`)
   - `ORGANIZER_PASSWORD`: a strong shared password for organizers
   - `NEXT_PUBLIC_SITE_URL`: your site URL, e.g. `https://founders-week.vercel.app`
4. **Redeploy.** Open `/office-hours#apply`: the form is enabled, and the first request creates the
   tables. Submit a test application, sign in at `/organizers`, and check it appears (the dashboard's
   "Data store" indicator shows the connected database).

Any other Postgres host (Prisma Postgres, Railway, Render, RDS, a university server) works the same
way: set `DATABASE_URL`.

### Option B: reuse one of your existing Supabase projects (no new project needed)

Supabase's free plan limits you to two projects, but this app can live **inside an existing one**
without touching its data:

1. In that project, go to **Connect → Transaction pooler** (port `6543`) and copy the URI, substituting
   your database password.
2. In Vercel, set `DATABASE_URL` to that URI and **`DATABASE_SCHEMA=founders_week`**, plus
   `APP_SECRET`, `ORGANIZER_PASSWORD` and `NEXT_PUBLIC_SITE_URL` as above.
3. Redeploy. On first use the app creates a separate `founders_week` schema and puts all its tables
   there. The project's existing `public` tables are never read or changed. The schema is not exposed
   through Supabase's API: it isn't in the exposed-schemas list, and the `anon` and `authenticated`
   roles are explicitly revoked.

To create the tables ahead of time instead:
`DATABASE_URL="<uri>" DATABASE_SCHEMA=founders_week npm run db:migrate`.

### Option C: fully local (no hosted database)

`DATABASE_URL=pglite:./.data/pglite` (the default in `.env.example`) stores applications in an
embedded Postgres on disk. Use it for development, testing and demos, or to run the whole site on a
single machine with a persistent disk (`npm run build && npm start`). It is **not usable on Vercel**,
whose serverless disk is temporary, so the app refuses it there instead of silently losing
applications. Back up by copying `.data/`, or export CSV from `/organizers`.

### Security model (all options)

Only the Next.js server talks to the database, over the connection string. No database API keys are
used or exposed to browsers. Every applicant table has row-level security enabled with no policies,
and privileges are revoked from Supabase's public `anon`/`authenticated` roles when they exist. This
is verified by integration tests against a real Postgres 18 server with those roles and Supabase-style
default grants (`tests/integration/postgres.test.ts`).

If no database is configured, the application stays visible but **submission is disabled with an
explanation**. Success is only ever shown after the database confirms the write.

## Organizer workflow

1. Open `/organizers` and sign in with `ORGANIZER_PASSWORD` plus your name (recorded in the activity log).
2. Filter by mentor, availability (a window, a slot, or "interest only"), status, or search.
3. Open an application to read answers, add notes and change status. Statuses: Submitted → Under review →
   Selected, awaiting confirmation / Waitlisted → Confirmed → Attended (or Canceled).
4. **Assign appointment** proposes a slot. Email the student yourself; nothing is sent automatically.
   Once they confirm, click **Confirm**.
   - A slot never exceeds its `capacity`. Proposed and confirmed appointments both hold a seat.
   - A student (matched by email across applications) can't hold overlapping appointments.
   - Appointments can only be confirmed in `confirmed` slots. For mentors still scheduling (Ron, Vik),
     add slots in `content/mentors.ts` first.
5. **Export CSV** exports the current filtered list. Cells that could run as spreadsheet formulas are
   neutralized.

## Deployment (Vercel)

1. Import `geeeethubb/FoundersWeek` in Vercel (framework: Next.js; defaults are fine).
2. Complete **Database setup** above (Option A or B) and the environment variables.
3. Deploy. `/organizers`, `/api` and status pages are `noindex` and uncached.

Without a database the site still deploys and is fully browsable; only submissions are disabled.
Any Node host also works (`npm run build && npm start`).

## Development

```bash
npm run typecheck     # TypeScript
npm run lint          # ESLint
npm test              # unit tests (Vitest)
npm run test:e2e      # Playwright end-to-end (local PGlite by default)
E2E_DATABASE_URL=postgresql://… npm run test:e2e   # same suite against a real Postgres database
TEST_POSTGRES_URL=postgresql://… npm test           # also runs tests/integration (auto-setup, concurrency, shared schema)
npm run build         # production build
```

`scripts/dev/with-dev-server.mjs` and `scripts/dev/snap.mjs` start an isolated dev server and take
desktop and mobile screenshots (see AGENTS.md).
