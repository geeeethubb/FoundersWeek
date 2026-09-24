<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Founders × Founders Week — project conventions

Student-curated guide to Founders Week at UIUC, run by **Founders – Illinois Entrepreneurs** (the student org). Founders Week is the broader event series; never imply Founders organizes every event.

## Priorities (drive navigation, layout, emphasis and CTAs)
1. **Founders Office Hours** — the primary experience. /office-hours is the most important page; it contains the application (section `#apply`). "Apply for Office Hours" is the primary sitewide CTA. Mentor CTAs link to `/office-hours?mentor=<id>[&window|slot=<id>]#apply` (see `applyHref`/`mentorApplyHref`). All four mentors are always visible (no carousels).
2. **Dan Caruso — Fireside Chat** (Mon Sep 28) — "Supported by Founders". NO application/interest/waitlist/booking flow of any kind.
3. **How to Make $10K/Month in College** (Tue Sep 29, 6–8 PM, 100 MSEB) — "Co-hosted by Founders".
4. All other Founders Week events. The Calendar (/schedule, nav label "Calendar") is the second most important page; it stays chronological with featured placement + badges for priorities (`featuredEntries`).
The Founders afterparty was canceled and must not appear anywhere. The university's Friday "Founders Evening Showcase and Reception" is a separate event and stays.

## Content integrity (non-negotiable)
- Never invent facts: schedules, speakers, credentials, venues/addresses, registration links, durations, mentor titles/topics/bios, funding totals, deadlines. Missing data renders as honest copy ("To be announced", "Topics being confirmed").
- All public content lives in `/content` (typed, validated by `content/validate.ts`). Load it through `@/content` (server-only) — it strips mentor drafts and `organizerNotes`, and only includes `content/demo.ts` when `SHOW_DEMO_CONTENT=true` outside production.
- Involvement labels (Hosted / Co-hosted / Supported by Founders / Part of Founders Week) only when a source supports them.
- Applying never reserves a slot. Use `APPLICATION_COPY` / `INTEREST_COPY` wording.
- Distinguish availability window vs proposed slot vs confirmed slot vs application status using `components/ui/status.tsx`.

## Code map
- `lib/time.ts` — all date/time formatting & America/Chicago conversion (deterministic; label times "CT").
- `lib/schedule/entries.ts` — normalized `ScheduleEntry` (events + generated office-hours entries); `lib/schedule/url.ts` — shareable filter URLs.
- `lib/mentors.ts` — scheduling status ("Scheduling in progress"), CTA labels.
- `lib/applications/*` — statuses/constants, catalog of selectable mentor options, shared zod schema (client + server).
- `lib/db/client.ts` — any Postgres (`postgres://`, e.g. Neon via Vercel Storage or an existing Supabase project with `DATABASE_SCHEMA`) or local PGlite (`pglite:<dir>`); tables auto-created on first use from `db/migrations`.
- `lib/security/*` — HMAC signing, origin checks, DB-backed rate limiting, status-link tokens.
- `components/ui/*` — design-system primitives (Button, Badge, Notice, Monogram, field helpers, icons, status badges).

## Design system
Ink/navy surfaces, warm paper text, Illinois orange (`accent`) only for CTAs, active states, "Hosted by Founders", picks, and focus. Monospace (`mono-label`, `font-mono tabular`) for dates, times and metadata. Line style carries certainty: solid = confirmed, dashed = planned/proposed/window, dotted = TBA/in progress. Prefer hairline-divided lists over card grids. No gradients, glow, blobs, glassmorphism or emoji. `paper-faint` is decorative only (fails contrast for text).

## Next.js 16 specifics
`params`/`searchParams` are Promises; `cookies()`/`headers()` are async; `middleware` is now `proxy.ts`. Type page props explicitly, e.g. `{ params: Promise<{ id: string }> }`.

## Checks
`npm run typecheck`, `npm run lint`, `npm test` (Vitest, `tests/unit`), `npm run test:e2e` (Playwright, `tests/e2e`), `npm run build`.
Isolated dev server + screenshots: `node scripts/dev/with-dev-server.mjs --port 31xx --dist .next-x [--env K=V] -- node scripts/dev/snap.mjs --out <dir> schedule office-hours` (paths without a leading slash).
