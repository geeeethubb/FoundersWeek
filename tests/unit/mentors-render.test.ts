/**
 * Renders the Office Hours page, the mentor cards and the mentor profile pages to static HTML
 * with the public (default-env) data and checks what students would actually see: all six
 * mentors in one balanced grid, approved headshots, one availability line each, "Select mentor"
 * actions that land on the application (#apply) with the mentor preselected — and that nothing
 * private (organizer notes, drafts, the internal "basis" of expertise items) or retired (decorative
 * numbering, "To be confirmed" tables, the availability glossary, "one-on-one" claims) renders.
 * Rishab Veldur (Auvi Labs) has a date-only window, background chips and a good-fit paragraph
 * instead of a topic list, and his profile never makes medical-device claims.
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
import { MentorCard, MentorGrid } from "@/components/mentors/mentor-card";
import { buildApplicationCatalog } from "@/lib/applications/catalog";
import { resolvePrefill } from "@/lib/applications/prefill";
import { INTEREST_COPY } from "@/lib/mentors";
import { availabilityLines, mentorAppearanceViews, mentorCardView } from "@/lib/mentors-view";

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
  "ron-lewis": "/office-hours?mentor=ron-lewis#apply",
  "rishab-veldur": "/office-hours?mentor=rishab-veldur&window=rishab-veldur-2026-10-01#apply",
};

const RISHAB_BIO_FIRST =
  "Rishab is the co-founder and CEO of Auvi Labs, a UIUC spinout developing wearable ultrasound technology to help detect problems with dialysis access earlier.";
const RISHAB_BIO_SECOND =
  "With a background in engineering at Illinois, he helped build a company that placed second in the 2024 Cozad New Venture Challenge.";
const RISHAB_GOOD_FIT =
  "Interested in turning a technical project into a healthcare startup? Rishab’s experience spans engineering, medical-device development, and building a company through Illinois’ entrepreneurship ecosystem.";
const RISHAB_WINDOW_NOTE =
  "Rishab has time on Thursday, October 1. We’ll share the exact time once it’s set, and you can apply now.";

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
  "Much more available",
  "extra sessions",
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
    expect(arnav).toContain("Office hours: Fri, Oct 2 · Morning, exact window pending");
    for (const t of [vik, elliott, ron]) expect(t).toContain("Office hours: Scheduling in progress");
    expect(rishab).toContain("Office hours: Thu, Oct 1 · Exact time to be confirmed");

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

  it("Rishab's card: bio's first sentence as the intro, his Thursday date, and 'Select mentor' with his window", () => {
    const card = cards(renderGrid())[5];
    expect(card).toContain('id="mentor-rishab-veldur"');
    expect(text(card).trim()).toBe(
      `Rishab Veldur Co-Founder & CEO, Auvi Labs ${RISHAB_BIO_FIRST} Office hours: Thu, Oct 1 · Exact time to be confirmed Select mentor: Rishab Veldur Profile: Rishab Veldur`,
    );
    // The date is machine-readable; there is no time to mark up.
    expect(card).toContain('<time dateTime="2026-10-01">Thu, Oct 1</time>');
    expect(card.match(/<time\b/g)).toHaveLength(1);
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
    expect(t).toContain("Office hours Thu, Oct 1 · 10:00–11:30 AM CT");
    expect(t).toContain("Patrick is free during this window, but it isn’t a booked appointment.");
    expect(t).toContain("Speaking Fri, Oct 2 · 2:40 PM Next Generation Industrial, Manufacturing and Space Tech");
  });

  it("Arnav's profile: Friday morning pending, hosting his Wednesday happy hour, then speaking", async () => {
    const html = await renderProfile("arnav-mishra");
    const t = text(html);
    expect(t).toContain("Office hours Fri, Oct 2 · Morning, exact window pending");
    expect(t).toContain("We’ll share the exact window once it’s confirmed, but you can apply now.");
    expect(t).toContain("Arnav at Founders Week");
    expect(anchor(html, "/schedule/happy-hour-at-legends-with-arnav-mishra")).toMatch(
      /Hosting Wed, Sep 30 · 5:00 PM[\s\S]*Happy Hour with Arnav Mishra at Legends/,
    );
    // Arnav's session title comes from the calendar (content/events.ts), punctuated either way.
    expect(text(anchor(html, "/schedule/founders-showcase-day-sessions")!)).toMatch(
      /Speaking Fri, Oct 2 · 1:55 PM From Idea to Scale(?: — |: )Building Doss[:,] Lessons from an Illini Founder Founders Showcase Day Sessions · Illinois Conference Center/,
    );
    expect(t.indexOf("Hosting Wed, Sep 30")).toBeLessThan(t.indexOf("Speaking Fri, Oct 2"));
  });

  it("Elliott's profile: scheduling in progress, apply without a time, and his TechRise panel", async () => {
    const html = await renderProfile("elliott-notrica");
    const t = text(html);
    expect(t).toContain("Office hours Scheduling in progress");
    expect(t).toContain(INTEREST_COPY.followUp);
    expect(anchor(html, "/schedule/techrise-pitch-competition")).toContain("Speaking Thu, Oct 1 · 6:30 PM");
    expect(t).toContain("TechRise × University of Illinois Founders Week Cohort 2: Where Are They Now?");
    expect(hrefs(html)).toContain("/office-hours?mentor=elliott-notrica#apply");
    expect(hrefs(html).filter((h) => h.includes("mentor=elliott-notrica&"))).toEqual([]); // no time to preselect
  });

  it("Vik's profile never shows his organizer-only constraints", async () => {
    const t = text(await renderProfile("vikram-lakhwara"));
    expect(t).toContain("Office hours Scheduling in progress");
    expect(t).not.toMatch(/Wednesday|commitments|through Saturday/);
    expect(t).toContain("Speaking Fri, Oct 2 · 2:55 PM Funding Start-ups in the Midwest");
  });

  it("Ron's profile has no Founders Week section (he has no listed appearances)", async () => {
    const t = text(await renderProfile("ron-lewis"));
    expect(t).not.toContain("Ron at Founders Week");
    expect(t).toContain("Apply to meet Ron");
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

    it("shows Thu, Oct 1 office hours with the exact time to be confirmed, and never Oct 2 office hours", async () => {
      const html = await renderProfile("rishab-veldur");
      const block = officeHoursBlock(html);
      expect(text(block).trim()).toBe(`Thu, Oct 1 · Exact time to be confirmed ${RISHAB_WINDOW_NOTE} Apply to meet Rishab`);
      expect(block).toContain('<time dateTime="2026-10-01">Thu, Oct 1</time>');
      expect(block.match(/<li\b/g)).toHaveLength(1);
      expect(text(block)).not.toMatch(/Oct(ober)? 2|Fri(day)?/);
      // The only Friday on the page is his Showcase panel, never a second office-hours line.
      const t = text(html);
      expect(t.match(/Oct 2/g)).toEqual(["Oct 2"]);
      expect(t).toContain("Speaking Fri, Oct 2 · 1:20 PM");
      expect(t).not.toContain("October 2");
      expect(availabilityLines(getMentors().find((m) => m.id === "rishab-veldur")!).map((l) => l.text)).toEqual([
        "Thu, Oct 1 · Exact time to be confirmed",
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
        "Speaking Fri, Oct 2 · 1:20 PM Health Innovation: From Therapeutics to Devices Founders Showcase Day Sessions · Illinois Conference Center",
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
      expect(meta.description).toContain("Founders Office Hours with Rishab Veldur (Co-Founder & CEO, Auvi Labs)");
      expect(meta.description).toContain("Thu, Oct 1");
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
