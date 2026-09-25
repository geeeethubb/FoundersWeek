# Content status: missing assets and unconfirmed details

Last reviewed: 2026-09-23. The site renders everything below with honest copy ("Time to be announced",
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

- Founders – Illinois Entrepreneurs logo: supplied 2026-09-24. The site uses a generated reversed (light-on-dark) version. An official reversed file is welcome (see `public/brand/README.md`).
- Approved Illinois mark, if permitted. None in use.
- Favicon: `app/icon.svg` is a neutral orange "×", not a logo.
- Org links (website, Instagram, LinkedIn) → `content/site.ts` → `org`.

## Mentors

Headshots were supplied for all six mentors (`public/mentors/`; Vik's source image is only 251×251 px, so a larger one would look sharper).
Bios and "Can help most with" highlights were written 2026-09-24 at the organizers' request from the mentors'
public profiles. LinkedIn requires sign-in, so every statement was checked against public sources instead.
Those sources are listed per mentor in `content/mentors.ts`. Mentors should give them a quick look.

**Patrick Haddox** (CEO & Co-Founder, Samara Aerospace)
- Window: Thu Oct 1, 10:00–11:30 AM CT, in person at Espresso Royale at Grainger Library, 1301 W
  Springfield Ave, Urbana (organizer update, Sept 24). He's open to all three 25-minute sessions in
  the window (10:00, 10:30, 11:00; organizer update, Sept 24).
- Background and expertise are composed only from his role and his Founders Showcase panel listing.
  Personal bio and mentor-confirmed topics are not supplied.

**Arnav Mishra** (Co-Founder & CTO, Doss)
- Window: Fri Oct 2, 10:00–11:30 AM CT (confirmed by the organizers on Sept 24; earlier only "before
  noon" was known). Sessions follow the 25-minute rule; location is pending.
- Background and expertise come from his role and Founders Showcase talk listing. Mentor-confirmed
  topics are not supplied.

**Vikram "Vik" Lakhwara** (Founder & Managing Member, Stakehouse; title per stakehouse.fund)
- Scheduling in progress. Existing commitments Wednesday through Saturday morning are **not** available
  slots. This is an organizer-only note.

**Elliott Notrica** (Founder & CEO, Symbio Bioculinary). Added 2026-09-24.
- Windows (from his email, Sept 25; set by the organizers): Wed Sept 30, 9 AM–noon and 2–5 PM, and
  Thu Oct 1, noon–5 PM CT (22 sessions of 25 minutes). Location is still to be set.
- On Thursday's TechRise Cohort 2 panel (linked on his profile).

**Ron Lewis** (Co-Founder, Auctus Advisory)
- Window: Thu Oct 1, 2:30–4:30 PM CT, in person at the Business Instructional Facility (BIF), 515 E.
  Gregory Drive, Champaign (organizer update, Sept 24). He's also open to Oct 4; that is an
  organizer-only note until the organizers send details. Nothing about Oct 4 is published.
- Bio published as supplied by organizers. Expertise is taken from that bio.
- Suggested topics (revenue strategy, startup financial planning, communicating business progress to
  stakeholders) are **draft, not published**. Set `askMeAbout.status` to `"approved"` once he confirms.

**Rishab Veldur** (Co-Founder & CEO, Auvi Labs). Added 2026-09-24.
- Office hours: Thursday, Oct 1, anytime 12:00–5:00 PM CT (window locked by the organizers on Sept 24;
  earlier his email only gave the date). It's an availability window, not booked appointments: session
  length, location and capacity are still pending. Applicants can tick the window like Patrick's. He's at
  Founders Week on Oct 1 and 2, but Oct 2 is **not** office-hours availability.
- He'd like to meet student teams. That's an organizer-only preference, not an eligibility rule.
- Bio, background tags (Medtech, Hardware and software, University spinouts) and suggested fit were supplied
  by the organizers and checked against the Carle Illinois article (Aug 17, 2026), Auvi Labs' About page
  and the 2024 Cozad results (AUVI placed second). Beacon is investigational (not FDA-cleared, not
  commercially available), and the site must not say otherwise. No degree or class year is published.
  The phone number in his email signature stays off the site.
- On Friday's Showcase panel "Health Innovation: From Therapeutics to Devices" (1:20–1:55 PM), linked from
  his profile and separate from his Thursday office hours.
- Headshot supplied by the organizers (800×800).

## Events

- **Dan Caruso — Fireside Chat** (Mon Sep 28, 4 PM, Beckman Institute Auditorium, Room 1025, 405 N.
  Mathews Ave., Urbana): supported by Founders; featured. No end time was supplied, so calendar export
  waits for one. The private session is mentioned for information only. There is deliberately no
  application, interest form, waitlist or booking flow.
- **How to Make $10K/Month in College** (Tue Sep 29, 6–8 PM, Materials Science and Engineering
  Building, Room 100, 1304 W. Green St., Urbana): co-hosted by Founders; featured; links to
  austnkennedy.com. Calendar export is enabled.
- **Happy Hour with Arnav Mishra at Legends** (Wed Sep 30, 5–7 PM, Legends at 6th & Green): Arnav's
  event, supported by Founders (organizer update, Sept 24); featured third on the home page. Details are
  from his Partiful page, which requires an RSVP. Full street address and any age requirement were not
  listed.
- **Founder Failure Lab** (Wed Sep 30, 6:30–8:30 PM, Campus Instructional Facility (CIF), Room 1038,
  1405 Springfield Ave., Urbana): hosted by Founders; featured with a light-orange card. Details, speakers,
  LinkedIn links and both blurbs from the organizers (Sept 24), combined into one description.
  Registration: https://luma.com/hyoeuqh1 (free). Checked against public sources on Sept 24:
  - End time: the organizers first said 8:00 PM; the Luma page says 8:30 PM. Organizers confirmed
    8:30 PM on Sept 24, and the site uses it.
  - Luma lists the place only as "CIF 1038"; the street address is the organizers'.
  - "Manu Edakara" (one k) matches Luma, Gies, Entrepreneurship at Illinois and Forbes; his official title
    is Director, iVenture Accelerator (Forbes 30 Under 30, Education, 2020).
  - "NoshBox" is the company's own spelling. VORO is a brand of Omnipher (Nick's iVenture 10 company).
  - The 70% / 43% / 29% figures are from CB Insights, "The top 9 reasons startups fail" (March 2026):
    431 VC-backed startups that shut down since 2023; the description credits CB Insights.
  It overlaps Arnav's happy hour (5–7 PM); the calendar shows both.
- **Tailgate and EnterpriseWorks Tour** and **Illinois Football vs. Purdue** (Sat Oct 3): times are not
  in the supplied agenda. The listing states that tickets are not included.
- The **Founders Week Afterparty** (Sat Oct 3, HERE Apartments) was **canceled** and removed from the site.
  The university's Friday **Founders Evening Showcase and Reception** is a separate event and remains.
- Street addresses were supplied for Dan Caruso's chat and the Sept 29 panel only; other venues show
  building names as given. No map links.
- Speakers are listed by name only, as in the agenda. Affiliations were not supplied, apart from those in session titles.

## Demo content

`content/demo.ts` holds clearly fictional events and mentors for design work and tests. It only
loads with `SHOW_DEMO_CONTENT=true`, is labeled "Demo" everywhere, and never loads on a Vercel production
deploy.
