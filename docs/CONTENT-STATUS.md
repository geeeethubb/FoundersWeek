# Content status: missing assets and unconfirmed details

Last reviewed: 2026-09-23. The site renders everything below with honest copy ("Time forthcoming",
"Scheduling in progress", "To be confirmed"). Nothing has been guessed.

## Priorities

1. **Founders Office Hours**: the primary experience (`/office-hours`, with the application at `#apply`).
2. **Dan Caruso — Fireside Chat** (Mon Sep 28), Supported by Founders.
3. **How to Make $10K/Month in College** (Tue Sep 29), Co-hosted by Founders.
4. All other Founders Week events (`/schedule`, labeled "Calendar").

## Blocking or high-impact

| Item | Where it goes | Effect today |
| --- | --- | --- |
| **Database connection + `APP_SECRET`** | Environment (see README → Database setup: Vercel Storage/Neon, or an existing Supabase project with `DATABASE_SCHEMA`) | Office-hours submissions stay disabled, with an explanation, until configured. |
| **Application deadline / decision date** | `content/site.ts` → `applications.deadline`, `decisionsBy` | No deadline shown or enforced. |
| **Founders contact email** | `content/site.ts` → `org.contactEmail` | No "questions?" address on the site or in emails. |
| **Official Founders Week page URL** | `content/site.ts` → `week.officialUrl` | Not linked. |

## Brand assets

- Founders – Illinois Entrepreneurs logo/wordmark → `public/brand/` (see `public/brand/README.md`). A typographic lockup is used meanwhile.
- Approved Illinois mark, if permitted. None in use.
- Favicon: `app/icon.svg` is a neutral orange "×", not a logo.
- Org links (website, Instagram, LinkedIn) → `content/site.ts` → `org`.

## Mentors

No headshots were supplied, so each mentor shows a generated initials portrait. Add approved photos
under `public/mentors/` and reference them in `content/mentors.ts` (`headshot`).

**Patrick Haddox** (CEO & Co-Founder, Samara Aerospace)
- Window: Thu Oct 1, 10:00–11:30 AM CT. He will host one or two sessions; exact appointments, lengths
  and location are pending. Add `slots` once set.
- Background and expertise are composed only from his role and his Founders Showcase panel listing.
  Personal bio and mentor-confirmed topics are not supplied.

**Arnav Mishra** (Co-Founder & CTO, Doss)
- Fri Oct 2, before noon. The exact window, duration, session count and location are pending.
- Background and expertise come from his role and Founders Showcase talk listing. Mentor-confirmed
  topics are not supplied.

**Vikram "Vik" Lakhwara** (Stakehouse)
- Scheduling in progress. Existing commitments Wednesday through Saturday morning are **not** available
  slots. This is an organizer-only note.
- Title is unverified, so none is shown. Background and expertise come only from his Founders Showcase
  panel listing ("Funding Start-ups in the Midwest"). A fuller bio and expertise need verification.

**Ron Lewis** (Co-Founder, Auctus Advisory)
- Scheduling in progress: date, time and format are pending.
- Bio published as supplied by organizers. Expertise is taken from that bio.
- Suggested topics (revenue strategy, startup financial planning, communicating business progress to
  stakeholders) are **draft, not published**. Set `askMeAbout.status` to `"approved"` once he confirms.

## Events

- **Dan Caruso — Fireside Chat** (Mon Sep 28): time, location and organizer are forthcoming, and no
  official information link was supplied. The private session is mentioned for information only. There
  is deliberately no application, interest form, waitlist or booking flow.
- **How to Make $10K/Month in College** (Tue Sep 29, 6–8 PM, 100 MSEB): confirmed, links to
  austnkennedy.com. Calendar export is enabled.
- **Tailgate and EnterpriseWorks Tour** and **Illinois Football vs. Purdue** (Sat Oct 3): times are not
  in the supplied agenda. The listing states that tickets are not included.
- The **Founders Week Afterparty** (Sat Oct 3, HERE Apartments) was **canceled** and removed from the site.
  The university's Friday **Founders Evening Showcase and Reception** is a separate event and remains.
- Street addresses and map links for venues were not supplied. Building names are shown as given.
- Speakers are listed by name only, as in the agenda. Affiliations were not supplied, apart from those in session titles.

## Demo content

`content/demo.ts` holds clearly fictional events and mentors for design work and tests. It only
loads with `SHOW_DEMO_CONTENT=true`, is labeled "Demo" everywhere, and never loads on a Vercel production
deploy.
