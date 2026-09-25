/**
 * Renders the Office Hours page, the mentor cards and the mentor profile pages to static HTML
 * with the public (default-env) data and checks what students would actually see: all six
 * mentors in one balanced grid, approved headshots, one availability line each, "Select mentor"
 * actions that land on the application (#apply) with the mentor preselected — and that nothing
 * private (organizer notes, drafts, the internal "basis" of expertise items) or retired (decorative
 * numbering, "To be confirmed" tables, the availability glossary, "one-on-one" claims) renders.
 * Rishab Veldur (Auvi Labs) has one exact window (Thu, Oct 1, noon to 5 PM CT), background chips and
 * a good-fit paragraph instead of a topic list, and his profile never makes medical-device claims.
 * The date-only path ("Exact time to be confirmed") and the part-of-day path ("Morning, exact window
 * pending") are rendered with synthetic fixture mentors: every real mentor with a window has exact times.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The application is owned and tested separately; here it only needs to mark its place (#apply).
vi.mock("@/components/apply/apply-section", () => ({
  ApplySection: ({ searchParams }: { searchParams: Record<string, unknown> }) =>
    createElement(
      "section",
      { id: "apply", "data-prefill": JSON.stringify(searchParams) },
      createElement("h2", { id: "apply-heading" }, "Apply for Office Hours"),
    ),
}));

import OfficeHoursPage, { generateMetadata as officeHoursMetadata } from "@/app/office-hours/page";
import MentorProfilePage, { generateMetadata as profileMetadata } from "@/app/office-hours/[id]/page";
import MentorNotFound from "@/app/office-hours/[id]/not-found";
import { getMentors, getScheduleEntries } from "@/content";
import { mentors as productionMentors } from "@/content/mentors";
import { site } from "@/content/site";
import type { Mentor } from "@/content/types";
import { MentorCard, MentorGrid } from "@/components/mentors/mentor-card";
import { OfficeHoursLines } from "@/components/mentors/mentor-profile";
import { buildApplicationCatalog } from "@/lib/applications/catalog";
import { resolvePrefill } from "@/lib/applications/prefill";
import { INTEREST_COPY } from "@/lib/mentors";
import {
  availabilityLines,
  availabilityNote,
  mentorAppearanceViews,
  mentorCardView,
  officeHoursPlace,
  sessionRuleLine,
} from "@/lib/mentors-view";
import { sessionRuleText } from "@/lib/schedule/sessions";

/** "Each session is 25 minutes, with a 5-minute break between sessions." (from site.officeHours) */
const SESSION_RULE = sessionRuleText(site.officeHours);

const MENTOR_IDS = [
  "patrick-haddox",
  "arnav-mishra",
  "vikram-lakhwara",
  "elliott-notrica",
  "ron-lewis",
  "rishab-veldur",
];
const NAMES = [
  "Patrick Haddox",
  "Arnav Mishra",
  "Vikram “Vik” Lakhwara",
  "Elliott Notrica",
  "Ron Lewis",
  "Rishab Veldur",
];

/** Each mentor's public links, in the order the organizers supplied them. */
const LINKS: Record<string, { label: string; url: string }[]> = {
  "patrick-haddox": [{ label: "LinkedIn", url: "https://www.linkedin.com/in/patrick-haddox/" }],
  "arnav-mishra": [{ label: "LinkedIn", url: "https://www.linkedin.com/in/arnav-mishra/" }],
  "vikram-lakhwara": [{ label: "LinkedIn", url: "https://www.linkedin.com/in/viklakhwara/" }],
  "elliott-notrica": [{ label: "LinkedIn", url: "https://www.linkedin.com/in/elliottnotrica/" }],
  "ron-lewis": [{ label: "LinkedIn", url: "https://www.linkedin.com/in/ronlewis20/" }],
  "rishab-veldur": [
    { label: "LinkedIn", url: "https://www.linkedin.com/in/rishab-veldur" },
    { label: "Auvi Labs", url: "https://www.auvilabs.com/" },
  ],
};

/** What each card's "Select mentor" action must link to (single windows preselected). */
const SELECT_HREFS: Record<string, string> = {
  "patrick-haddox": "/office-hours?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am#apply",
  "arnav-mishra": "/office-hours?mentor=arnav-mishra&window=arnav-mishra-2026-10-02-am#apply",
  "vikram-lakhwara": "/office-hours?mentor=vikram-lakhwara#apply",
  "elliott-notrica": "/office-hours?mentor=elliott-notrica#apply",
  "ron-lewis": "/office-hours?mentor=ron-lewis&window=ron-lewis-2026-10-01-pm#apply",
  "rishab-veldur": "/office-hours?mentor=rishab-veldur&window=rishab-veldur-2026-10-01#apply",
};

const RISHAB_BIO_FIRST =
  "Rishab is the co-founder and CEO of Auvi Labs, a UIUC spinout developing wearable ultrasound technology to help detect problems with dialysis access earlier.";
const RISHAB_BIO_SECOND =
  "With a background in engineering at Illinois, he helped build a company that placed second in the 2024 Cozad New Venture Challenge.";
const RISHAB_GOOD_FIT =
  "Interested in turning a technical project into a healthcare startup? Rishab’s experience spans engineering, medical-device development, and building a company through Illinois’ entrepreneurship ecosystem.";
const RISHAB_WINDOW_NOTE =
  "Rishab is free anytime during this window, from noon to 5 PM, but it isn’t a booked appointment. We’ll schedule sessions inside it.";
/** Rishab's window reads like Patrick's ("Thu, Oct 1 · 10:00–11:30 AM CT"). */
const RISHAB_LINE = "Thu, Oct 1 · 12:00–5:00 PM CT";
/** Elliott's three exact windows (organizer update, Sept 25), in order. */
const ELLIOTT_LINES = ["Wed, Sep 30 · 9:00 AM–12:00 PM CT", "Wed, Sep 30 · 2:00–5:00 PM CT", "Thu, Oct 1 · 12:00–5:00 PM CT"];
const ELLIOTT_NOTE = "Elliott is free at these times, but they aren’t booked appointments. We’ll schedule sessions inside them.";

/**
 * A synthetic mentor with one date-only window (the date is set, the time isn't), so the
 * "Exact time to be confirmed" rendering stays covered now that every real mentor with a date has a time.
 */
const TBA_WINDOW_NOTE = "Sam has time on Thursday, October 1. We’ll share the exact time once it’s set, and you can apply now.";
const TBA_APPLY_HREF = "/office-hours?mentor=fixture-tba-mentor&window=fixture-tba-2026-10-01#apply";
const tbaMentor: Mentor = {
  id: "fixture-tba-mentor",
  name: "Sam Fixture",
  firstName: "Sam",
  role: "Founder",
  company: "Fixture Co",
  headshot: null,
  bio: { status: "approved", value: "Sam is a fictional founder used only in tests. Nothing here is real." },
  expertise: null,
  askMeAbout: null,
  goodFitFor: null,
  session: { format: null, durationMinutes: null, location: null, sessionCount: null, confirmed: false },
  availability: [
    {
      id: "fixture-tba-2026-10-01",
      date: "2026-10-01",
      time: { kind: "tba" },
      label: "Exact time to be confirmed",
      note: TBA_WINDOW_NOTE,
    },
  ],
  slots: [],
  links: [],
  acceptingApplications: true,
  sources: [],
};

/**
 * A synthetic mentor with one part-of-day window ("Friday morning, before noon"), shaped like Arnav's
 * entry before his window became 10:00–11:30 AM (Sept 24), so the rough-window rendering stays covered.
 */
const ROUGH_WINDOW_NOTE = "Riley has time Friday morning. We’ll share the exact window once it’s confirmed, but you can apply now.";
const roughMentor: Mentor = {
  ...tbaMentor,
  id: "fixture-rough-mentor",
  name: "Riley Fixture",
  firstName: "Riley",
  availability: [
    {
      id: "fixture-rough-2026-10-02-am",
      date: "2026-10-02",
      time: { kind: "part-of-day", part: "morning", before: "12:00" },
      label: "Friday morning, before noon · Exact window pending",
      note: ROUGH_WINDOW_NOTE,
    },
  ],
};

const MATCHING_SENTENCE =
  "Founders will match students by interests and availability and email selected applicants to confirm.";

/** Organizer notes, unapproved drafts and removed content that must never render publicly. */
const FORBIDDEN_FRAGMENTS = [
  "Wednesday through Saturday",
  "Saturday morning",
  "commitments",
  "not available slots",
  "Startup financial planning",
  "Communicating business progress",
  "Verify title",
  // Elliott's email to the organizers, and the session total they set (organizer-only).
  "From his email",
  "anytime after 9 AM",
  "Organizers set his windows",
  "22 sessions",
  "Dan Caruso",
  "Caruso",
  // Rishab's email to the organizers (organizer-only).
  "student teams",
  "eligibility",
  "Oct 1 and 2",
  "email signature",
  "phone number",
];

/**
 * Auvi's device is investigational: nothing public may call it FDA-approved or cleared,
 * commercially available or clinically proven (or name it, or date its market entry).
 */
const MEDICAL_CLAIMS = [
  /FDA/i,
  /\bclear(ed|ance)\b/i,
  /commercially/i,
  /clinically/i,
  /on the market/i,
  /\bapproved\b/i,
  /investigational/i,
  /Beacon/,
  /\b2028\b/,
];

/** Retired from the Office Hours area: decorative numbering, glossaries, TBC tables, claims. */
const RETIRED_TEXT = [
  /\b0\d \/ 0\d\b/, // "01 / 06"
  /\bBasis\b/,
  /To be confirmed/,
  /Reading availability/i,
  /The lineup/i,
  /In priority order/i,
  /one[- ]on[- ]one/i,
  /Exact times (forthcoming|TBA)/, // availability glossary vocabulary
  /Proposed slot|Confirmed slot/,
];
const RETIRED_CLASSES = ["bg-blueprint", "font-serif", "italic", "font-mono", "font-wide", "mono-label"];

/** The conditional classes that center an odd last card at half width (lg, two columns). */
const ODD_LAST_CENTERING = [
  "lg:[&:last-child:nth-child(odd)]:col-span-2",
  "lg:[&:last-child:nth-child(odd)]:mx-auto",
  "lg:[&:last-child:nth-child(odd)]:w-[calc((100%_-_1.5rem)/2)]",
];

/** Decode the few entities React emits so assertions can use plain text. */
function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .replace(/ ([,:])/g, "$1");
}

/** Every href in the markup, entity-decoded. */
function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

/** Every <img> with its alt text and (decoded) src. */
function images(html: string): { alt: string | null; src: string }[] {
  return [...html.matchAll(/<img\b[^>]*>/g)].map(([tag]) => ({
    alt: /\balt="([^"]*)"/.exec(tag)?.[1] ?? null,
    src: (/\bsrc="([^"]*)"/.exec(tag)?.[1] ?? "").replace(/&amp;/g, "&"),
  }));
}

/** The first <a> whose href is exactly `href` (opening tag + inner HTML). */
function anchor(html: string, href: string): string | null {
  const escaped = href.replace(/&/g, "&amp;").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<a\\b[^>]*href="${escaped}"[^>]*>[\\s\\S]*?</a>`).exec(html)?.[0] ?? null;
}

/** Each `<article …>…</article>` card in the markup (cards don't nest articles). */
function cards(html: string): string[] {
  return [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map((m) => m[0]);
}

/** Class tokens of the first element matching `tag`. */
function classesOf(html: string, tag: string): string[] {
  return (new RegExp(`<${tag}\\b[^>]*class="([^"]*)"`).exec(html)?.[1] ?? "").replace(/&amp;/g, "&").split(/\s+/);
}

/** Class tokens of each grid item (`<li>` wrapping a card) of a MentorGrid, in order. */
function gridItems(html: string): string[][] {
  return [...html.matchAll(/<li\b[^>]*class="([^"]*)"[^>]*>\s*<article\b/g)].map((m) =>
    m[1].replace(/&amp;/g, "&").split(/\s+/),
  );
}

/** Class tokens of each top-level element in an HTML fragment (void elements don't nest). */
function topLevelClasses(fragment: string): string[][] {
  const out: string[][] = [];
  let depth = 0;
  for (const m of fragment.matchAll(/<(\/?)([a-z][a-z0-9]*)\b([^>]*?)(\/?)>/gi)) {
    const [, closing, tag, attrs, selfClosing] = m;
    if (closing) {
      depth--;
      continue;
    }
    if (depth === 0) {
      out.push((/\bclass="([^"]*)"/.exec(attrs)?.[1] ?? "").replace(/&amp;/g, "&").split(/\s+/));
    }
    if (!selfClosing && !/^(img|input|br|hr|source|meta|link|wbr)$/i.test(tag)) depth++;
  }
  return out;
}

/**
 * Which grid items `li:last-child:nth-child(odd)` selects (0-based) — the only item the
 * centering classes apply to. Every card is an `<li>` of the same list, so the last card is the
 * last child, and it is an odd child exactly when the card count is odd.
 */
function oddLastItems(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i).filter((i) => i === count - 1 && (i + 1) % 2 === 1);
}

/** The `<section id="…">` of a profile (sections are siblings, never nested). */
function section(html: string, id: string): string | null {
  return new RegExp(`<section\\b[^>]*\\bid="${id}"[\\s\\S]*?</section>`).exec(html)?.[0] ?? null;
}

/** Ids of every `<section>` in document order. */
function sectionIds(html: string): string[] {
  return [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
}

/** The profile header's "Office hours" block: its lines, note and the Apply action. */
function officeHoursBlock(html: string): string {
  return /<h2\b[^>]*>Office hours<\/h2>([\s\S]*?)<\/header>/.exec(html)?.[1] ?? "";
}

/** Approved headshots render as real images with the mentor's name as alt text. */
function expectHeadshots(html: string, ids: string[] = MENTOR_IDS) {
  const imgs = images(html);
  for (const id of ids) {
    const name = NAMES[MENTOR_IDS.indexOf(id)];
    const img = imgs.find((i) => i.src.includes(`url=${encodeURIComponent(`/mentors/${id}.jpg`)}`));
    expect(img, id).toBeDefined();
    expect(img!.alt, id).toBe(name);
  }
  expect(imgs.every((i) => i.alt && i.alt.trim().length > 0)).toBe(true);
}

/** The canceled Saturday Founders Week Afterparty (HERE Apartments) never appears. */
function expectNoCanceledAfterparty(html: string) {
  const t = text(html);
  expect(t).not.toMatch(/HERE Apartments/i);
  expect(t).not.toMatch(/afterparty/i);
  expect(html).not.toContain("founders-week-afterparty");
}

function expectNoMedicalClaims(html: string) {
  const t = text(html);
  for (const claim of MEDICAL_CLAIMS) expect(t, String(claim)).not.toMatch(claim);
}

function expectPublicOnly(html: string) {
  const t = text(html);
  for (const fragment of FORBIDDEN_FRAGMENTS) expect(t, fragment).not.toContain(fragment);
  for (const m of productionMentors) expect(t).not.toContain(m.organizerNotes!);
  // No expertise basis, ever (the labels are fine). A basis that merely restates the mentor's
  // verified "Role, Company" is public anyway, so it can't be told apart and is skipped.
  for (const m of productionMentors) {
    for (const item of m.expertise?.value ?? []) {
      if (item.basis === `${m.role}, ${m.company}`) continue;
      expect(t, item.basis).not.toContain(item.basis);
    }
  }
  // Internal notes on approved fields (e.g. Rishab's "never call it FDA-approved") never render.
  for (const m of productionMentors) {
    for (const field of [m.bio, m.expertise, m.goodFitFor]) {
      if (field?.status === "approved" && field.note) expect(t, m.id).not.toContain(field.note);
    }
  }
  // Ron's draft "Revenue strategy" topic (his approved highlight is "Revenue strategy and optimization").
  expect(t).not.toMatch(/Revenue strategy(?! and optimization)/);
  expect(t).not.toMatch(/draft/i);
  expectNoMedicalClaims(html);
  expectNoCanceledAfterparty(html);
  expect(hrefs(html).filter((h) => h.startsWith("/apply"))).toEqual([]);
}

function expectNothingRetired(html: string) {
  const t = text(html);
  for (const pattern of RETIRED_TEXT) expect(t).not.toMatch(pattern);
  const classTokens = new Set(
    [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].replace(/&amp;/g, "&").split(/\s+/)),
  );
  for (const cls of RETIRED_CLASSES) expect(classTokens.has(cls), cls).toBe(false);
  expect(html).not.toMatch(/<ellipse\b/); // orbit graphics
}

/**
 * No em dashes in the copy or its attributes (aria-labels, alt text). Event titles are quoted
 * verbatim from their organizers, so the titles passed in `exempt` are skipped.
 */
function expectNoEmDash(html: string, exempt: string[] = []) {
  const rest = exempt.reduce((out, title) => out.split(title).join(" "), html);
  expect(rest).not.toContain("—");
}

/** Application links always carry a mentor and land on #apply. */
function expectApplyLinksPreselect(html: string) {
  const applyLinks = hrefs(html).filter((h) => h.includes("#apply") && h !== "#apply");
  expect(applyLinks.length).toBeGreaterThan(0);
  for (const href of applyLinks) expect(href).toMatch(/^\/office-hours\?mentor=[a-z-]+(&(window|slot)=[a-z0-9-]+)?#apply$/);
}

/** The query parameters of an in-app href, as the page receives them. */
function searchParamsOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, "https://example.test").searchParams);
}

beforeEach(() => {
  vi.stubEnv("SHOW_DEMO_CONTENT", "");
  vi.stubEnv("SHOW_DRAFT_CONTENT", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("Office Hours page", () => {
  async function renderPage(searchParams: Record<string, string> = {}): Promise<string> {
    return renderToStaticMarkup(await OfficeHoursPage({ searchParams: Promise.resolve(searchParams) }));
  }

  it("reads intro → one mentor grid → how matching works → the application, in that order", async () => {
    const html = await renderPage();
    const order = [
      html.indexOf('id="office-hours-title"'),
      html.indexOf('id="mentors"'),
      html.indexOf('id="matching-heading"'),
      html.indexOf('id="apply"'),
    ];
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // Headings in order: one h1, then h2s (cards are h3s inside the grid).
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(text(html)).toContain("Founders Office Hours");
    // The intro's Apply button jumps to the application.
    expect(anchor(html, "#apply")).toContain("Apply for Office Hours");
  });

  it("introduces the opportunity with the mentor count from the data, without claiming sessions are one-on-one", async () => {
    const t = text(await renderPage());
    expect(getMentors()).toHaveLength(6);
    expect(t).toContain(
      "Six founders and investors are making time for students during Founders Week. Choose who you’d like to meet and apply once.",
    );
    expect(t).not.toMatch(/\bFive founders\b/);
    expect(t).not.toMatch(/one[- ]on[- ]one/i);
  });

  it("shows every mentor exactly once, in one grid, in content order", async () => {
    const html = await renderPage();
    const all = cards(html);
    expect(all).toHaveLength(6);
    all.forEach((card, i) => {
      expect(card, MENTOR_IDS[i]).toContain(`id="mentor-${MENTOR_IDS[i]}"`);
      expect(text(card)).toContain(NAMES[i]);
    });
    // One heading per mentor — no second lineup or per-mentor sections further down.
    const headings = [...html.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/g)].map((m) => text(m[1]).trim());
    for (const name of NAMES) expect(headings.filter((h) => h === name), name).toHaveLength(1);
    // Beyond its heading, a mentor's name appears only in the accessible names of the card's two links.
    for (const name of NAMES) expect(text(html).split(name).length - 1, name).toBe(3);
    expect(html.match(/<ul\b[^>]*lg:grid-cols-2/g)).toHaveLength(1);
  });

  it("keeps six cards in two columns: three full rows, no odd card centered", async () => {
    const html = await renderPage();
    const grid = /<ul\b[^>]*lg:grid-cols-2[\s\S]*<\/ul>/.exec(html)![0];
    // Two columns from lg only (never three across on this page).
    expect(classesOf(grid, "ul").filter((c) => c.includes("grid-cols"))).toEqual(["lg:grid-cols-2"]);
    const items = gridItems(grid);
    expect(items).toHaveLength(6);
    expect(items.length / 2).toBe(3);
    expect(oddLastItems(items.length)).toEqual([]);
  });

  it("explains matching once, in the owner's words", async () => {
    const t = text(await renderPage());
    expect(t).toContain("How matching works");
    expect(t.split(MATCHING_SENTENCE).length - 1).toBe(1);
    expect(t).toContain("applying doesn’t reserve a time");
    // Pending mentor schedules never block an application.
    expect(t).toContain("If a mentor’s times aren’t set yet, share your general availability instead.");
    // What "Select mentor" does, said once above the grid.
    expect(t).toContain("Select anyone you’d like to meet and they’ll be added to your application below.");
  });

  it("states the session rule once, in “How matching works”, from site.officeHours", async () => {
    const html = await renderPage();
    const t = text(html);
    expect(SESSION_RULE).toBe(
      `Each session is ${site.officeHours.sessionMinutes} minutes, with a ${site.officeHours.breakMinutes}-minute break between sessions.`,
    );
    expect(t.split(SESSION_RULE).length - 1).toBe(1);
    const matching = /<section\b[^>]*aria-labelledby="matching-heading"[\s\S]*?<\/section>/.exec(html)![0];
    expect(text(matching)).toContain(`${SESSION_RULE} Appointments are limited, and applying doesn’t reserve a time.`);
    // Not on the cards (the profiles say it), and never a session count or a one-on-one promise.
    for (const card of cards(html)) expect(text(card)).not.toContain("Each session is");
    expect(t).not.toMatch(/\b(one|two|three|\d+) sessions\b/i);
    expect(t).not.toMatch(/one[- ]on[- ]one/i);
  });

  it("passes the URL's prefill parameters to the application", async () => {
    const html = await renderPage({ mentor: "arnav-mishra", window: "arnav-mishra-2026-10-02-am" });
    expect(html).toContain(
      `data-prefill="${JSON.stringify({ mentor: "arnav-mishra", window: "arnav-mishra-2026-10-02-am" }).replace(/"/g, "&quot;")}"`,
    );
  });

  it("Rishab's 'Select mentor' link prefills him and his Thursday window in the application", async () => {
    const params = searchParamsOf(SELECT_HREFS["rishab-veldur"]);
    expect(params).toEqual({ mentor: "rishab-veldur", window: "rishab-veldur-2026-10-01" });
    const html = await renderPage(params);
    expect(html).toContain(
      `data-prefill="${JSON.stringify({ mentor: "rishab-veldur", window: "rishab-veldur-2026-10-01" }).replace(/"/g, "&quot;")}"`,
    );
    // The application resolves those parameters to Rishab, first choice, with his only window ticked.
    expect(resolvePrefill(buildApplicationCatalog(getMentors()), params)).toEqual({
      mentorIds: ["rishab-veldur"],
      firstChoiceMentorId: "rishab-veldur",
      availability: ["window:rishab-veldur-2026-10-01"],
      referrerMentorId: "rishab-veldur",
    });
  });

  it("keeps only public data and none of the retired decoration", async () => {
    const html = await renderPage();
    expectHeadshots(html);
    expectApplyLinksPreselect(html);
    expectPublicOnly(html);
    expectNothingRetired(html);
    expectNoEmDash(html);
  });

  it("describes the page in metadata, naming all six mentors, without a one-on-one claim", () => {
    const meta = officeHoursMetadata();
    expect(meta.description).toBe(
      "Founders Office Hours at UIUC. Meet Patrick Haddox, Arnav Mishra, Vikram “Vik” Lakhwara, Elliott Notrica, Ron Lewis and Rishab Veldur during Founders Week. Choose who you’d like to meet and apply once.",
    );
    expect(JSON.stringify(meta)).not.toMatch(/one[- ]on[- ]one/i);
    expect(JSON.stringify(meta)).not.toContain("—");
  });
});

describe("mentor cards", () => {
  function renderGrid(applicationsOpen = true, mentors = getMentors()): string {
    return renderToStaticMarkup(createElement(MentorGrid, { mentors, applicationsOpen }));
  }

  it("each card shows only portrait, name, role and company, what they can help with, one availability line and two actions", () => {
    const all = cards(renderGrid());
    expect(all).toHaveLength(6);
    const [patrick, arnav, vik, elliott, ron, rishab] = all.map(text);

    expect(patrick).toMatch(/Patrick Haddox CEO & Co-Founder\W+Samara Aerospace/);
    expect(arnav).toMatch(/Arnav Mishra Co-Founder & CTO\W+Doss/);
    expect(vik).toMatch(/Vikram “Vik” Lakhwara Founder & Managing Member\W+Stakehouse/);
    expect(elliott).toMatch(/Elliott Notrica Founder & CEO\W+Symbio Bioculinary/);
    expect(ron).toMatch(/Ron Lewis Co-Founder\W+Auctus Advisory/);
    expect(rishab).toMatch(/Rishab Veldur Co-Founder & CEO\W+Auvi Labs/);

    // Three approved "Can help with" labels — labels only.
    expect(patrick).toContain(
      "Can help with Turning university research into a startup Raising a seed round for deep-tech hardware Spacecraft engineering and testing Office hours:",
    );
    expect(vik).toContain(
      "Can help with Raising a pre-seed round What early-stage investors look for Fundraising as a Midwest university founder Office hours:",
    );
    expect(elliott).toContain("Starting a company as an undergrad");
    expect(elliott).not.toContain("Setting up a lab and making first hires"); // 4th+ items live on the profile
    // No approved topic list: the first sentence of his bio instead.
    expect(rishab).not.toContain("Can help with");
    expect(rishab).toContain(`${RISHAB_BIO_FIRST} Office hours:`);

    // One availability line each.
    expect(patrick).toContain("Office hours: Thu, Oct 1 · 10:00–11:30 AM CT");
    expect(arnav).toContain("Office hours: Fri, Oct 2 · 10:00–11:30 AM CT");
    expect(ron).toContain("Office hours: Thu, Oct 1 · 2:30–4:30 PM CT");
    expect(vik).toContain("Office hours: Scheduling in progress");
    // Elliott's first window, then how many more (the profile lists all three).
    expect(elliott).toContain(`Office hours: ${ELLIOTT_LINES[0]} · +2 more Select mentor`);
    expect(elliott).not.toContain("Scheduling in progress");
    expect(all.join(" ").split("Scheduling in progress").length - 1).toBe(1); // Vik only
    expect(rishab).toContain(`Office hours: ${RISHAB_LINE}`);
    // No real mentor has a date-only or part-of-day window any more.
    expect(all.join(" ")).not.toContain("Exact time to be confirmed");
    expect(all.join(" ")).not.toMatch(/exact window pending|before noon/i);

    // Longer copy stays on the profile.
    for (const m of getMentors()) expect(all.join(" ")).not.toContain(m.bio!.value);
    expect(rishab).not.toContain(RISHAB_BIO_SECOND);
  });

  it("'Select mentor' opens the application with the mentor (and a single window) preselected", () => {
    const html = renderGrid();
    const all = cards(html);
    expect(all).toHaveLength(6);
    all.forEach((card, i) => {
      const id = MENTOR_IDS[i];
      const select = anchor(card, SELECT_HREFS[id]);
      expect(select, id).not.toBeNull();
      expect(text(select!)).toBe(` Select mentor: ${NAMES[i]} `);
      // A quiet profile link, named for the mentor.
      expect(text(anchor(card, `/office-hours/${id}`) ?? "")).toBe(` Profile: ${NAMES[i]} `);
      // Deep-link anchor for /office-hours#mentor-<id>.
      expect(card).toContain(`id="mentor-${id}"`);
    });
    expectHeadshots(html);
    expectApplyLinksPreselect(html);
    expectPublicOnly(html);
    expectNothingRetired(html);
    expectNoEmDash(html);
  });

  it("Rishab's card: bio's first sentence as the intro, his Thursday noon–5 PM window, and 'Select mentor' with his window", () => {
    const card = cards(renderGrid())[5];
    expect(card).toContain('id="mentor-rishab-veldur"');
    expect(text(card).trim()).toBe(
      `Rishab Veldur Co-Founder & CEO, Auvi Labs ${RISHAB_BIO_FIRST} Office hours: ${RISHAB_LINE} Select mentor: Rishab Veldur Profile: Rishab Veldur`,
    );
    // Like Patrick's window, only the date is marked up: a window isn't an appointment start time.
    expect(card).toContain('<time dateTime="2026-10-01">Thu, Oct 1</time>');
    expect(card.match(/<time\b/g)).toHaveLength(1);
    const patrickCard = cards(renderGrid())[0];
    expect(patrickCard).toContain('<time dateTime="2026-10-01">Thu, Oct 1</time>');
    expect(patrickCard.match(/<time\b/g)).toHaveLength(1);
    // Exactly two links: Select mentor (mentor + window preselected) and the profile.
    expect(hrefs(card)).toEqual([SELECT_HREFS["rishab-veldur"], "/office-hours/rishab-veldur"]);
    expect(images(card)).toEqual([
      { alt: "Rishab Veldur", src: expect.stringContaining(`url=${encodeURIComponent("/mentors/rishab-veldur.jpg")}`) },
    ]);
    // Profile-only material stays off the card.
    const t = text(card);
    for (const tag of ["Medtech", "Hardware and software", "University spinouts"]) expect(t).not.toContain(tag);
    expect(t).not.toContain(RISHAB_GOOD_FIT);
    expect(t).not.toContain("Health Innovation");
    expect(t).not.toMatch(/Oct 2|Friday/);
    expectNoMedicalClaims(card);
  });

  it("a date-only mentor's card (fixture) reads 'Thu, Oct 1 · Exact time to be confirmed' and preselects the window", () => {
    const card = renderToStaticMarkup(
      createElement(MentorCard, { card: mentorCardView(tbaMentor, { applicationsOpen: true }) }),
    );
    expect(card).toContain('id="mentor-fixture-tba-mentor"');
    // No headshot, so the card falls back to the "SF" monogram.
    expect(text(card).trim()).toBe(
      "SF Sam Fixture Founder, Fixture Co Sam is a fictional founder used only in tests. Office hours: Thu, Oct 1 · Exact time to be confirmed Select mentor: Sam Fixture Profile: Sam Fixture",
    );
    expect(images(card)).toEqual([]);
    // The date is machine-readable; there is no time to mark up.
    expect(card).toContain('<time dateTime="2026-10-01">Thu, Oct 1</time>');
    expect(card.match(/<time\b/g)).toHaveLength(1);
    expect(hrefs(card)).toEqual([TBA_APPLY_HREF, "/office-hours/fixture-tba-mentor"]);
    expect(text(card)).not.toMatch(/Time TBA|Time to be announced/);
  });

  it("a part-of-day mentor's card (fixture) reads 'Fri, Oct 2 · Morning, exact window pending'", () => {
    const card = renderToStaticMarkup(
      createElement(MentorCard, { card: mentorCardView(roughMentor, { applicationsOpen: true }) }),
    );
    expect(text(card)).toContain("Office hours: Fri, Oct 2 · Morning, exact window pending");
    expect(hrefs(card)[0]).toBe("/office-hours?mentor=fixture-rough-mentor&window=fixture-rough-2026-10-02-am#apply");
  });

  it("lays six cards out as three balanced rows of two, with no odd last card to center", () => {
    const html = renderGrid();
    expect(classesOf(html, "ul")).toEqual(expect.arrayContaining(["grid", "lg:grid-cols-2"]));
    expect(classesOf(html, "ul").filter((c) => c.includes("grid-cols"))).toEqual(["lg:grid-cols-2"]);
    const items = gridItems(html);
    expect(items).toHaveLength(6);
    // Each item only carries the conditional odd-last centering — nothing that spans or centers
    // unconditionally — and with an even count that selector matches no item.
    for (const item of items) expect(item).toEqual(ODD_LAST_CENTERING);
    expect(oddLastItems(items.length)).toEqual([]);
    // Horizontal card: portrait column beside the text, stacked content below it on phones.
    for (const card of cards(html)) {
      expect(classesOf(card, "article")).toEqual(
        expect.arrayContaining(["grid-cols-[5rem_minmax(0,1fr)]", "sm:grid-cols-[7.5rem_minmax(0,1fr)]", "rounded-md", "border-line"]),
      );
    }
  });

  it("keeps the gap under the role the same in the shorter card of a row (content aligned to the top)", () => {
    // Cards in a row share its height. The name/role row keeps its own height (`auto`) and the body
    // row takes the extra space (`1fr`), so the body never drifts down in the shorter card (it
    // did with implicit auto rows: 45px under Rishab's role vs 20px under Ron's).
    for (const card of cards(renderGrid())) {
      const article = classesOf(card, "article");
      expect(article).toEqual(expect.arrayContaining(["grid", "h-full", "grid-rows-[auto_1fr]", "gap-y-5"]));
      expect(article.filter((c) => /^(sm:|lg:)?(grid-rows|content-|items-|place-)/.test(c))).toEqual(["grid-rows-[auto_1fr]"]);
      const [portrait, head, body] = [...card.matchAll(/<article\b[^>]*>([\s\S]*)<\/article>/g)].flatMap((m) =>
        topLevelClasses(m[1]),
      );
      // The portrait spans both rows beside the text from sm; the name block sits at the top of its row.
      expect(portrait).toContain("sm:row-span-2");
      expect(head).toEqual(expect.arrayContaining(["sm:self-start"]));
      // The body fills its row, with the actions pushed to the bottom.
      expect(body).toEqual(expect.arrayContaining(["flex", "flex-col"]));
      expect(card).toMatch(/<div class="mt-auto flex/);
    }
  });

  it("still centers an odd last card at half width when the count is odd (five → 2 · 2 · 1)", () => {
    const html = renderGrid(true, getMentors().slice(0, 5));
    const items = gridItems(html);
    expect(items).toHaveLength(5);
    for (const item of items) expect(item).toEqual(ODD_LAST_CENTERING);
    expect(oddLastItems(items.length)).toEqual([4]);
  });

  it("closed applications never render application links", () => {
    const html = renderGrid(false);
    expect(hrefs(html).filter((h) => h.includes("#apply"))).toEqual([]);
    expect(text(html).match(/Applications closed/g)).toHaveLength(6);
    expect(text(html)).not.toContain("Select mentor");
  });

  it("falls back to the first sentence of the bio when there are no approved labels", () => {
    const vik = getMentors().find((m) => m.id === "vikram-lakhwara")!;
    const card = mentorCardView({ ...vik, expertise: null }, { applicationsOpen: true });
    const t = text(renderToStaticMarkup(createElement(MentorCard, { card })));
    expect(t).toContain(
      "Vik Lakhwara is the founder and managing member of Stakehouse, a St. Louis venture fund that backs early-stage founders with ties to universities in Missouri and its neighboring states, including Illinois.",
    );
    expect(t).not.toContain("A former Silicon Valley venture capitalist");
    expect(t).not.toContain("Can help with");
  });
});

describe("mentor profile page", () => {
  async function renderProfile(id: string): Promise<string> {
    return renderToStaticMarkup(await MentorProfilePage({ params: Promise.resolve({ id }) }));
  }

  it("every profile: headshot, name, role and company, links, bio, what they can help with and an Apply button", async () => {
    const mentors = getMentors();
    expect(mentors.map((m) => m.id)).toEqual(MENTOR_IDS);
    for (const mentor of mentors) {
      const html = await renderProfile(mentor.id);
      const t = text(html);
      expect(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]).toBe(mentor.name);
      expect(t).toContain(`${mentor.name} ${mentor.role}, ${mentor.company} LinkedIn`);
      expect(images(html)[0]).toEqual({
        alt: mentor.name,
        src: expect.stringContaining(`url=${encodeURIComponent(`/mentors/${mentor.id}.jpg`)}`),
      });
      // Exactly the supplied links, in order, each opening in a new tab.
      const linkList = new RegExp(`<ul\\b[^>]*aria-label="${mentor.firstName}’s links"[^>]*>([\\s\\S]*?)</ul>`).exec(html);
      expect(linkList, mentor.id).not.toBeNull();
      expect(hrefs(linkList![1]), mentor.id).toEqual(LINKS[mentor.id].map((l) => l.url));
      for (const link of LINKS[mentor.id]) {
        const a = anchor(html, link.url);
        expect(a, `${mentor.id} ${link.label}`).not.toBeNull();
        expect(a).toContain('target="_blank"');
        expect(a).toContain('rel="noopener noreferrer"');
        expect(text(a!).trim()).toBe(`${link.label} (opens in new tab)`);
      }
      expect(t).toContain(mentor.bio!.value);
      if (mentor.expertise) {
        expect(t).toContain(`Can help with ${mentor.expertise.value.map((e) => e.label).join(" ")}`);
      } else {
        // No approved topic list: the good-fit paragraph speaks for them instead.
        expect(mentor.goodFitFor?.status).toBe("approved");
        expect(t).not.toContain("Can help with");
      }
      expect(anchor(html, SELECT_HREFS[mentor.id])).toContain(`Apply to meet ${mentor.firstName}`);
      expect(anchor(html, "/office-hours#mentors")).toContain("All mentors");
      // The action again at the end of the profile.
      expect(hrefs(html).filter((h) => h === SELECT_HREFS[mentor.id])).toHaveLength(2);
      expectApplyLinksPreselect(html);
      expectPublicOnly(html);
      expectNothingRetired(html);
      // Session titles and program names come verbatim from the calendar.
      const titles = mentorAppearanceViews(getScheduleEntries(), mentor.id).flatMap((a) => [a.title, a.context ?? ""]);
      expectNoEmDash(html, titles.filter(Boolean));
    }
  });

  it("Patrick's profile shows his window as a window, not a booking", async () => {
    const t = text(await renderProfile("patrick-haddox"));
    expect(t).toContain(
      `Office hours Thu, Oct 1 · 10:00–11:30 AM CT ${SESSION_RULE} Espresso Royale at Grainger Library, 1301 W Springfield Ave, Urbana, IL 61801 Patrick is free during this window`,
    );
    expect(t).toContain(
      "Patrick is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.",
    );
    expect(t).toContain("Speaking Fri, Oct 2 · 2:40–2:55 PM CT Next Generation Industrial, Manufacturing and Space Tech");
    // His window fits three sessions on the grid (he's open to all three), but a session count is
    // never published: no computed count, and no count of his own (content sets none).
    expect(t).not.toMatch(/\b(one|two|three|\d+) sessions\b/i);
    expect(t).not.toMatch(/one or two/i);
  });

  it("Arnav's profile: Friday 10:00–11:30 AM window in the Siebel Center atrium, then his Siebel talk, happy hour, panel and Showcase talk in date order", async () => {
    const html = await renderProfile("arnav-mishra");
    const t = text(html);
    // The window, the session rule, the place (building, then street address), the window's note
    // and the Apply action.
    expect(text(officeHoursBlock(html)).replace(/\s+/g, " ").trim()).toBe(
      `Fri, Oct 2 · 10:00–11:30 AM CT ${SESSION_RULE} Atrium, Siebel Center for Computer Science, 201 N. Goodwin Ave., Urbana, IL 61801 Arnav is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it. Apply to meet Arnav`,
    );
    expect(t).toContain(
      `Office hours Fri, Oct 2 · 10:00–11:30 AM CT ${SESSION_RULE} Atrium, Siebel Center for Computer Science, 201 N. Goodwin Ave., Urbana, IL 61801 Arnav is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.`,
    );
    expect(t).not.toMatch(/exact window pending|before noon|still setting the location/i);
    // His window fits three sessions on the grid; the count is organizer-only.
    expect(t).not.toMatch(/\b(three|3) sessions\b/i);
    const appearances = section(html, "at-founders-week")!;
    expect(text(/<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(appearances)![1]).trim()).toBe("Arnav at Founders Week");
    expect(hrefs(appearances)).toEqual([
      "/schedule/building-an-ai-native-company",
      "/schedule/happy-hour-at-legends-with-arnav-mishra",
      "/schedule/entrepreneurial-impact-launching-from-illinois",
      "/schedule/founders-showcase-day-sessions",
    ]);
    // The Siebel School listing gives a 3:30 PM start and no end: the start alone, labeled CT. It's
    // outside the official program, so it carries the calendar's "Related event" label.
    expect(text(anchor(appearances, "/schedule/building-an-ai-native-company")!).trim()).toBe(
      "Speaking Wed, Sep 30 · 3:30 PM CT Building an AI-Native Company: Databases, Distributed Systems, and Other Founder Stories Siebel Center for Computer Science Related event",
    );
    expect(appearances).toContain('<time dateTime="2026-09-30T15:30">');
    // His happy hour: supported by Founders and a related event, labeled as on the calendar.
    expect(text(anchor(appearances, "/schedule/happy-hour-at-legends-with-arnav-mishra")!).trim()).toBe(
      "Hosting Wed, Sep 30 · 5:00–7:00 PM CT Happy Hour with Arnav Mishra at Legends Legends Supported by Founders Related event",
    );
    expect(text(anchor(appearances, "/schedule/entrepreneurial-impact-launching-from-illinois")!).trim()).toBe(
      "Speaking Thu, Oct 1 · 3:00–5:00 PM CT Entrepreneurial Impact: Launching From Illinois Beckman Institute",
    );
    // Arnav's session title comes from the calendar (content/events.ts), punctuated either way.
    expect(text(anchor(html, "/schedule/founders-showcase-day-sessions")!)).toMatch(
      /Speaking Fri, Oct 2 · 1:55–2:25 PM CT From Idea to Scale(?: — |: )Building Doss[:,] Lessons from an Illini Founder Founders Showcase Day Sessions · Illinois Conference Center/,
    );
    const order = [
      "Speaking Wed, Sep 30 · 3:30 PM CT",
      "Hosting Wed, Sep 30 · 5:00–7:00 PM CT",
      "Speaking Thu, Oct 1 · 3:00–5:00 PM CT",
      "Speaking Fri, Oct 2 · 1:55–2:25 PM CT",
    ].map((label) => text(appearances).indexOf(label));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // His office hours stay in the header, not in the appearances.
    expect(text(appearances)).not.toMatch(/Office hours|Atrium/);
  });

  it("Elliott's profile: his three windows (Wed, Sep 30 twice; Thu, Oct 1), apply without preselecting one, and his TechRise panel", async () => {
    const html = await renderProfile("elliott-notrica");
    const t = text(html);
    const block = officeHoursBlock(html);
    // All three windows, then the session rule, his windows' shared note (shown once) and the Apply
    // action. No place yet (still being set).
    expect(text(block).replace(/\s+/g, " ").trim()).toBe(
      `${ELLIOTT_LINES.join(" ")} ${SESSION_RULE} ${ELLIOTT_NOTE} Apply to meet Elliott`,
    );
    expect(text(block).split(ELLIOTT_NOTE)).toHaveLength(2);
    expect(block.match(/<li\b/g)).toHaveLength(3);
    expect([...block.matchAll(/<time dateTime="([^"]+)">([^<]+)<\/time>/g)].map((m) => [m[1], m[2]])).toEqual([
      ["2026-09-30", "Wed, Sep 30"],
      ["2026-09-30", "Wed, Sep 30"],
      ["2026-10-01", "Thu, Oct 1"],
    ]);
    expect(t).not.toContain("Scheduling in progress");
    expect(t).not.toContain(INTEREST_COPY.followUp);
    expect(t).not.toContain("Express interest");
    expect(anchor(html, "/schedule/techrise-pitch-competition")).toContain("Speaking Thu, Oct 1 · 6:30–6:50 PM CT");
    expect(t).toContain("TechRise × University of Illinois Founders Week Cohort 2: Where Are They Now?");
    expect(hrefs(html)).toContain("/office-hours?mentor=elliott-notrica#apply");
    // Three windows: the student picks one in the application, so none is preselected.
    expect(hrefs(html).filter((h) => h.includes("mentor=elliott-notrica&"))).toEqual([]);
    // Organizer-only details (his email, the session total) never render.
    expect(t).not.toMatch(/\b(22|twenty-two) sessions\b/i);
    expect(t).not.toMatch(/anytime after 9/i);
  });

  it("Vik's profile never shows his organizer-only constraints", async () => {
    const html = await renderProfile("vikram-lakhwara");
    const t = text(html);
    // Scheduling in progress: the rule and the follow-up promise, and Apply without a time to preselect.
    expect(t).toContain(`Office hours Scheduling in progress ${SESSION_RULE} ${INTEREST_COPY.followUp}`);
    expect(hrefs(html)).toContain("/office-hours?mentor=vikram-lakhwara#apply");
    expect(hrefs(html).filter((h) => h.includes("mentor=vikram-lakhwara&"))).toEqual([]);
    expect(t).not.toMatch(/Wednesday|commitments|through Saturday/);
    expect(t).toContain("Speaking Fri, Oct 2 · 2:55–3:35 PM CT Funding Start-ups in the Midwest");
  });

  it("states the session rule once under the office-hours lines for exact windows and scheduling, never a session count", async () => {
    const expected: Record<string, boolean> = {
      "patrick-haddox": true, // exact window
      "arnav-mishra": true, // exact window (Fri 10:00–11:30 AM since Sept 24)
      "vikram-lakhwara": true, // scheduling in progress
      "elliott-notrica": true, // exact windows (Wed Sep 30 and Thu Oct 1 since Sept 25)
      "ron-lewis": true, // exact window (Thu 2:30–4:30 PM since Sept 24)
      "rishab-veldur": true, // exact window
    };
    for (const mentor of getMentors()) {
      const html = await renderProfile(mentor.id);
      const t = text(html);
      const block = text(officeHoursBlock(html));
      expect(sessionRuleLine(mentor, site.officeHours) !== null, mentor.id).toBe(expected[mentor.id]);
      expect(t.split(SESSION_RULE).length - 1, mentor.id).toBe(expected[mentor.id] ? 1 : 0);
      expect(t.split("Each session is").length - 1, mentor.id).toBe(expected[mentor.id] ? 1 : 0);
      if (expected[mentor.id]) {
        // Right under the time lines (after the last one), before the public note and the Apply button.
        const lines = availabilityLines(mentor).map((l) => l.text);
        const lastLine = lines.at(-1) ?? "Scheduling in progress";
        expect(block.indexOf(lastLine), mentor.id).toBeGreaterThanOrEqual(0);
        expect(block.indexOf(lastLine), mentor.id).toBeLessThan(block.indexOf(SESSION_RULE));
        // Every mentor has one public note (Elliott's three windows share his), after the rule.
        const note = availabilityNote(mentor);
        expect(note, mentor.id).not.toBeNull();
        expect(block.indexOf(SESSION_RULE), mentor.id).toBeLessThan(block.indexOf(note ?? `Apply to meet ${mentor.firstName}`));
        expect(block.indexOf(SESSION_RULE), mentor.id).toBeLessThan(block.indexOf(`Apply to meet ${mentor.firstName}`));
      }
      // No session count, computed from the grid or from content, ever appears.
      expect(block, mentor.id).not.toMatch(
        /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+) sessions\b/i,
      );
      expect(t, mentor.id).not.toMatch(/one[- ]on[- ]one/i);
    }
  });

  it("renders the rule as a short, indented line under the times, or nothing", () => {
    const patrick = getMentors().find((m) => m.id === "patrick-haddox")!;
    const withRule = renderToStaticMarkup(
      createElement(OfficeHoursLines, {
        lines: availabilityLines(patrick),
        sessionRule: sessionRuleLine(patrick, site.officeHours),
        note: null,
      }),
    );
    expect(text(withRule).trim()).toBe(`Thu, Oct 1 · 10:00–11:30 AM CT ${SESSION_RULE}`);
    expect(/<p class="([^"]*)">Each session is/.exec(withRule)?.[1].split(" ")).toEqual(
      expect.arrayContaining(["pl-6", "text-sm", "text-text-muted"]),
    );
    // Built from the rule it's given.
    const other = renderToStaticMarkup(
      createElement(OfficeHoursLines, {
        lines: availabilityLines(patrick),
        sessionRule: sessionRuleLine(patrick, { sessionMinutes: 20, breakMinutes: 10 }),
        note: null,
      }),
    );
    expect(text(other)).toContain("Each session is 20 minutes, with a 10-minute break between sessions.");
    const without = renderToStaticMarkup(
      createElement(OfficeHoursLines, { lines: availabilityLines(tbaMentor), note: null }),
    );
    expect(text(without)).not.toContain("Each session is");
    // A rough window has no sessions yet, so no rule line either.
    expect(sessionRuleLine(roughMentor, site.officeHours)).toBeNull();
    const rough = renderToStaticMarkup(
      createElement(OfficeHoursLines, {
        lines: availabilityLines(roughMentor),
        sessionRule: sessionRuleLine(roughMentor, site.officeHours),
        note: availabilityNote(roughMentor),
      }),
    );
    expect(text(rough).trim()).toBe(`Fri, Oct 2 · Morning, exact window pending ${ROUGH_WINDOW_NOTE}`);
  });

  it("Ron's profile: his Thursday 2:30–4:30 PM window at BIF, Apply with it preselected, no Founders Week section", async () => {
    const html = await renderProfile("ron-lewis");
    const t = text(html);
    const block = text(officeHoursBlock(html)).replace(/\s+/g, " ").trim();
    expect(block).toBe(
      `Thu, Oct 1 · 2:30–4:30 PM CT ${SESSION_RULE} Business Instructional Facility (BIF), 515 E. Gregory Drive, Champaign, IL 61820 Ron is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it. Apply to meet Ron`,
    );
    expect(hrefs(html)).toContain(SELECT_HREFS["ron-lewis"]);
    expect(t).not.toContain("Scheduling in progress");
    expect(t).not.toContain("Ron at Founders Week");
    // Anything else he offered (another day) is organizer-only until it's set.
    expect(t).not.toMatch(/\bOct(ober)?\.? 4\b|Sunday/);
  });

  it("shows the place only once it's set (building, then street address)", () => {
    const patrick = getMentors().find((m) => m.id === "patrick-haddox")!;
    const ron = getMentors().find((m) => m.id === "ron-lewis")!;
    const arnav = getMentors().find((m) => m.id === "arnav-mishra")!;
    expect(officeHoursPlace(patrick)).toEqual({ venue: "Espresso Royale at Grainger Library", address: "1301 W Springfield Ave, Urbana, IL 61801" });
    expect(officeHoursPlace(ron)).toEqual({
      venue: "Business Instructional Facility (BIF)",
      address: "515 E. Gregory Drive, Champaign, IL 61820",
    });
    // From Arnav (Sept 25); the street address is abbreviated like the event addresses.
    expect(officeHoursPlace(arnav)).toEqual({
      venue: "Atrium, Siebel Center for Computer Science",
      address: "201 N. Goodwin Ave., Urbana, IL 61801",
    });
    // Elliott's and Rishab's places are still being set, so no place renders for them.
    expect(officeHoursPlace(getMentors().find((m) => m.id === "elliott-notrica")!)).toBeNull();
    expect(officeHoursPlace(getMentors().find((m) => m.id === "rishab-veldur")!)).toBeNull();
    const buildingOnly = renderToStaticMarkup(
      createElement(OfficeHoursLines, {
        lines: availabilityLines(patrick),
        place: { venue: "Siebel Center", address: null },
        note: null,
      }),
    );
    expect(text(buildingOnly).replace(/\s+/g, " ").trim()).toBe("Thu, Oct 1 · 10:00–11:30 AM CT Siebel Center");
  });

  it("a date-only window (fixture mentor) reads 'Exact time to be confirmed' in the profile's office-hours lines", () => {
    const html = renderToStaticMarkup(
      createElement(OfficeHoursLines, { lines: availabilityLines(tbaMentor), note: availabilityNote(tbaMentor) }),
    );
    expect(text(html).trim()).toBe(`Thu, Oct 1 · Exact time to be confirmed ${TBA_WINDOW_NOTE}`);
    expect(html).toContain('<time dateTime="2026-10-01">Thu, Oct 1</time>');
    expect(html.match(/<time\b/g)).toHaveLength(1);
    expect(html.match(/<li\b/g)).toHaveLength(1);
    expect(text(html)).not.toMatch(/Time TBA|Time to be announced|Scheduling in progress/);
  });

  describe("Rishab's profile", () => {
    it("reads header → About → Background → Good fit for → Rishab at Founders Week, with no 'Can help with'", async () => {
      const html = await renderProfile("rishab-veldur");
      expect(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1]).toBe("Rishab Veldur");
      expect(sectionIds(html)).toEqual(["about", "background", "useful-for", "at-founders-week"]);
      const h2s = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => text(m[1]).trim());
      expect(h2s).toEqual(["Office hours", "About", "Background", "Good fit for", "Rishab at Founders Week"]);
      const t = text(html);
      expect(t).not.toContain("Can help with");
      expect(t).not.toContain("Useful for");
      expect(t).not.toContain("Ask Rishab about");
      expect(t).not.toContain("We’re still confirming topics");
      // The full approved bio, as one paragraph.
      expect(text(section(html, "about")!).trim()).toBe(`About ${RISHAB_BIO_FIRST} ${RISHAB_BIO_SECOND}`);
    });

    it("links his LinkedIn and Auvi Labs, in that order, each opening in a new tab", async () => {
      const html = await renderProfile("rishab-veldur");
      const list = /<ul\b[^>]*aria-label="Rishab’s links"[^>]*>([\s\S]*?)<\/ul>/.exec(html)![1];
      expect(hrefs(list)).toEqual(["https://www.linkedin.com/in/rishab-veldur", "https://www.auvilabs.com/"]);
      expect([...list.matchAll(/<a\b[\s\S]*?<\/a>/g)].map((m) => text(m[0]).trim())).toEqual([
        "LinkedIn (opens in new tab)",
        "Auvi Labs (opens in new tab)",
      ]);
      for (const url of ["https://www.linkedin.com/in/rishab-veldur", "https://www.auvilabs.com/"]) {
        expect(anchor(list, url)).toMatch(/target="_blank" rel="noopener noreferrer"/);
      }
      expect(text(html)).toContain(
        "Rishab Veldur Co-Founder & CEO, Auvi Labs LinkedIn (opens in new tab) Auvi Labs (opens in new tab) Office hours",
      );
    });

    it("shows his background as three chips", async () => {
      const background = section(await renderProfile("rishab-veldur"), "background")!;
      expect(background).toContain('<h2 id="background-heading"');
      const list = /<ul\b[^>]*aria-label="Rishab’s background"[^>]*>([\s\S]*?)<\/ul>/.exec(background);
      expect(list).not.toBeNull();
      expect(classesOf(background, "ul")).toEqual(expect.arrayContaining(["flex", "flex-wrap"]));
      const chips = [...list![1].matchAll(/<li\b[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/li>/g)];
      expect(chips.map((m) => text(m[2]).trim())).toEqual(["Medtech", "Hardware and software", "University spinouts"]);
      for (const [, cls] of chips) expect(cls.split(/\s+/)).toEqual(expect.arrayContaining(["rounded-full", "border"]));
    });

    it("shows his good fit as a paragraph under 'Good fit for', not a list", async () => {
      const fit = section(await renderProfile("rishab-veldur"), "useful-for")!;
      expect(text(/<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(fit)![1]).trim()).toBe("Good fit for");
      expect([...fit.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[1]).trim())).toEqual([RISHAB_GOOD_FIT]);
      expect(fit).not.toMatch(/<ul\b|<li\b/);
    });

    it("shows Thu, Oct 1 office hours, noon to 5 PM CT, as a window (not a booking), and never Oct 2 office hours", async () => {
      const html = await renderProfile("rishab-veldur");
      const block = officeHoursBlock(html);
      expect(text(block).trim()).toBe(`${RISHAB_LINE} ${SESSION_RULE} ${RISHAB_WINDOW_NOTE} Apply to meet Rishab`);
      expect(block).toContain('<time dateTime="2026-10-01">Thu, Oct 1</time>');
      expect(block.match(/<time\b/g)).toHaveLength(1);
      expect(block.match(/<li\b/g)).toHaveLength(1);
      expect(text(block)).not.toMatch(/Oct(ober)? 2|Fri(day)?/);
      // The time is set now: no date-only wording anywhere on his profile.
      const t = text(html);
      expect(t).not.toContain("Exact time to be confirmed");
      // The only Friday on the page is his Showcase panel, never a second office-hours line.
      expect(t.match(/Oct 2/g)).toEqual(["Oct 2"]);
      expect(t).toContain("Speaking Fri, Oct 2 · 1:20–1:55 PM CT");
      expect(t).not.toContain("October 2");
      expect(availabilityLines(getMentors().find((m) => m.id === "rishab-veldur")!).map((l) => l.text)).toEqual([
        RISHAB_LINE,
      ]);
    });

    it("'Apply to meet Rishab' preselects him and his Thursday window, at the top and the end", async () => {
      const html = await renderProfile("rishab-veldur");
      const href = SELECT_HREFS["rishab-veldur"];
      expect(text(anchor(html, href)!).trim()).toBe("Apply to meet Rishab");
      expect(hrefs(html).filter((h) => h === href)).toHaveLength(2);
      expect(hrefs(html).filter((h) => h.includes("#apply"))).toEqual([href, href]);
      expect(text(html)).not.toContain("Express interest");
    });

    it("lists the Health Innovation panel as a separate Founders Week appearance", async () => {
      const html = await renderProfile("rishab-veldur");
      const appearances = section(html, "at-founders-week")!;
      expect(text(/<h2\b[^>]*>([\s\S]*?)<\/h2>/.exec(appearances)![1]).trim()).toBe("Rishab at Founders Week");
      expect(hrefs(appearances)).toEqual(["/schedule/founders-showcase-day-sessions"]);
      expect(text(anchor(appearances, "/schedule/founders-showcase-day-sessions")!).trim()).toBe(
        "Speaking Fri, Oct 2 · 1:20–1:55 PM CT Health Innovation: From Therapeutics to Devices Founders Showcase Day Sessions · Illinois Conference Center",
      );
      expect(appearances).toContain('<time dateTime="2026-10-02T13:20">');
      // His office hours stay in the header, not in the appearances.
      expect(text(appearances)).not.toMatch(/Office hours|Thu, Oct 1/);
      expect(officeHoursBlock(html)).not.toContain("Health Innovation");
    });

    it("never shows organizer notes, his email's preferences or medical-device claims", async () => {
      const html = await renderProfile("rishab-veldur");
      const t = text(html);
      const raw = productionMentors.find((m) => m.id === "rishab-veldur")!;
      expect(t).not.toContain(raw.organizerNotes!);
      expect(t).not.toMatch(/student teams|\bteams?\b|individuals|eligib/i);
      expect(t).not.toMatch(/phone|email/i);
      expect(t).not.toContain(raw.bio!.note!);
      expect(t).not.toContain(raw.goodFitFor!.note!);
      expectNoMedicalClaims(html);
      expect(t).not.toMatch(/medical or regulatory advice|syllabus/i);
      expectPublicOnly(html);
      expectNothingRetired(html);
      expectNoEmDash(html);
    });

    it("describes his profile in metadata from verified facts, with no medical claims", async () => {
      const meta = await profileMetadata({ params: Promise.resolve({ id: "rishab-veldur" }) });
      expect(meta.title).toBe("Rishab Veldur · Office Hours");
      expect(meta.description).toBe(
        "Founders Office Hours with Rishab Veldur (Co-Founder & CEO, Auvi Labs) during Founders Week at UIUC. Availability: Thu, Oct 1 · 12:00–5:00 PM CT. Apply to request a time.",
      );
      const json = JSON.stringify(meta);
      expect(json).not.toMatch(/Oct 2|Friday/);
      for (const claim of MEDICAL_CLAIMS) expect(json, String(claim)).not.toMatch(claim);
      expect(json).not.toMatch(/one[- ]on[- ]one/i);
      expect(json).not.toContain("—");
    });
  });

  it("an unknown mentor id is a 404", async () => {
    await expect(renderProfile("dan-caruso")).rejects.toThrow();
  });

  it("the not-found page links to every mentor's profile and the application", () => {
    const html = renderToStaticMarkup(createElement(MentorNotFound));
    const t = text(html);
    expect(t).toContain("We couldn’t find that mentor.");
    expect(hrefs(html).filter((h) => /^\/office-hours\/[a-z-]+$/.test(h))).toEqual(MENTOR_IDS.map((id) => `/office-hours/${id}`));
    expect(hrefs(html)).toEqual(expect.arrayContaining(["/office-hours#apply", "/office-hours#mentors"]));
    expectPublicOnly(html);
    expectNothingRetired(html);
    expectNoEmDash(html);
  });
});

describe("mentor profile page (draft preview)", () => {
  beforeEach(() => vi.stubEnv("SHOW_DRAFT_CONTENT", "true"));

  it("labels unapproved topics as drafts instead of presenting them as confirmed", async () => {
    const html = renderToStaticMarkup(await MentorProfilePage({ params: Promise.resolve({ id: "ron-lewis" }) }));
    const t = text(html);
    expect(t).toContain("Ask Ron about Draft");
    expect(t).toContain("Startup financial planning");
    expect(t).toContain("Communicating business progress to stakeholders");
    // Organizer notes stay out even in preview.
    expect(t).not.toContain(productionMentors.find((m) => m.id === "ron-lewis")!.organizerNotes!);
  });

  it("Rishab's approved fields carry no Draft label, and his organizer notes stay out", async () => {
    const html = renderToStaticMarkup(await MentorProfilePage({ params: Promise.resolve({ id: "rishab-veldur" }) }));
    const t = text(html);
    expect(t).not.toMatch(/draft/i);
    expect(t).toContain(`Good fit for ${RISHAB_GOOD_FIT}`);
    expect(t).not.toContain(productionMentors.find((m) => m.id === "rishab-veldur")!.organizerNotes!);
    expectNoMedicalClaims(html);
  });
});
