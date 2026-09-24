/**
 * Renders the mentor components to static HTML with the public (default-env) data and checks
 * what students would actually see — including that nothing private leaks into markup and that
 * every mentor CTA lands on the application (#apply) with that mentor preselected.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMentors, getScheduleEntries } from "@/content";
import { AvailabilityLegend } from "@/components/mentors/availability-legend";
import { HowItWorks } from "@/components/mentors/how-it-works";
import { MentorLineup } from "@/components/mentors/mentor-lineup";
import { MentorPreviewList } from "@/components/mentors/mentor-preview-list";
import { AvailabilityBlocks, SessionDetailsList } from "@/components/mentors/mentor-profile";
import { MentorSections } from "@/components/mentors/mentor-sections";
import { OtherMentors } from "@/components/mentors/other-mentors";
import { APPLICATION_COPY } from "@/lib/applications/constants";
import { INTEREST_COPY } from "@/lib/mentors";
import { appearancesByMentor } from "@/lib/mentors-view";

const NAMES = ["Patrick Haddox", "Arnav Mishra", "Vikram “Vik” Lakhwara", "Ron Lewis"];

/** Organizer-only notes, unapproved drafts and removed content that must never render publicly. */
const FORBIDDEN_FRAGMENTS = [
  "Wednesday",
  "Saturday morning",
  "commitments",
  "Revenue strategy",
  "Startup financial planning",
  "Communicating business progress",
  "Verify title",
  "Dan Caruso",
  "Caruso",
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

function expectPublicOnly(html: string) {
  const t = text(html);
  for (const fragment of FORBIDDEN_FRAGMENTS) expect(t).not.toContain(fragment);
  expect(t).not.toMatch(/draft/i);
  expect(t).not.toMatch(/afterparty|HERE Apartments/i);
  // The application lives on /office-hours now — no links to the old /apply page.
  expect(hrefs(html).filter((h) => h.startsWith("/apply"))).toEqual([]);
}

/** Application links must always carry a mentor and land on the #apply section. */
function expectApplyLinksPreselect(html: string) {
  const applyLinks = hrefs(html).filter((h) => h.includes("#apply"));
  expect(applyLinks.length).toBeGreaterThan(0);
  for (const href of applyLinks) expect(href).toMatch(/^\/office-hours\?mentor=[a-z-]+(&(window|slot)=[a-z0-9-]+)?#apply$/);
}

describe("mentor components (public data)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("lineup shows all four mentors at equal weight with preselecting CTAs", () => {
    const html = renderToStaticMarkup(createElement(MentorLineup, { mentors: getMentors() }));
    const t = text(html);
    let last = -1;
    for (const name of NAMES) {
      const at = t.indexOf(name);
      expect(at).toBeGreaterThan(last); // content order
      last = at;
    }
    for (const caption of ["01 / 04", "02 / 04", "03 / 04", "04 / 04"]) expect(t).toContain(caption);
    expect(t).toContain("CEO & Co-Founder, Samara Aerospace");
    expect(t).toContain("Co-Founder & CTO, Doss");
    expect(t).toContain("Co-Founder, Auctus Advisory");
    // Availability: window vs. forthcoming vs. in progress
    expect(t).toContain("Availability window Thu, Oct 1 10:00–11:30 AM CT");
    expect(t).toContain("Exact times forthcoming Fri, Oct 2 Morning, before noon CT");
    expect(t.match(/Scheduling in progress/g)).toHaveLength(2);
    // Verified expertise line
    expect(t).toContain("Funding start-ups in the Midwest");
    // CTAs
    expect(hrefs(html)).toEqual(
      expect.arrayContaining([
        "/office-hours?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am#apply",
        "/office-hours?mentor=arnav-mishra&window=arnav-mishra-2026-10-02-am#apply",
        "/office-hours?mentor=vikram-lakhwara#apply",
        "/office-hours?mentor=ron-lewis#apply",
        "/office-hours/patrick-haddox",
      ]),
    );
    expect(t).toContain("Apply to meet Patrick");
    expect(t).toContain("Apply to meet Arnav");
    expect(t.match(/Express interest/g)).toHaveLength(2);
    expectApplyLinksPreselect(html);
    expectPublicOnly(html);
  });

  it("mentor sections show background, expertise with basis, appearances and session details", () => {
    const mentors = getMentors();
    const html = renderToStaticMarkup(
      createElement(MentorSections, {
        mentors,
        appearances: appearancesByMentor(getScheduleEntries(), mentors),
        applicationsOpen: true,
      }),
    );
    const t = text(html);
    for (const name of NAMES) expect(t).toContain(name);
    for (const id of mentors.map((m) => m.id)) expect(html).toContain(`id="mentor-${id}"`);
    // Background (approved bios only)
    expect(t).toContain("Ron is a repeat entrepreneur");
    expect(t).toContain("Vik Lakhwara is with Stakehouse");
    // Expertise with its basis
    expect(t).toContain("Building an aerospace company");
    expect(t).toContain("Basis — CEO & Co-Founder, Samara Aerospace");
    expect(t).toContain("Basis — Advises on this at Auctus Advisory");
    // Founders Week appearances link to the calendar
    expect(t).toContain("From Idea to Scale — Building Doss: Lessons from an Illini Founder");
    expect(t).toContain("1:55–2:25 PM CT");
    expect(hrefs(html)).toContain("/schedule/founders-showcase-day-sessions");
    // Availability + honest unknowns
    expect(t).toContain("10:00–11:30 AM CT");
    expect(t).toContain(INTEREST_COPY.followUp);
    expect(t).toContain("One or two sessions");
    expect(t).toContain("To be confirmed");
    expect(t).toContain("Preselects Thu, Oct 1 · 10:00–11:30 AM CT.");
    // Unapproved "Ask me about" topics never render
    expect(t).not.toContain("Ask me about");
    expectApplyLinksPreselect(html);
    expectPublicOnly(html);
  });

  it("in-progress availability explains follow-up and no reservation", () => {
    const vik = getMentors().find((m) => m.id === "vikram-lakhwara")!;
    const t = text(renderToStaticMarkup(createElement(AvailabilityBlocks, { mentor: vik })));
    expect(t).toContain("Scheduling in progress");
    expect(t).toContain("Vik’s availability isn’t finalized yet");
    expect(t).toContain(INTEREST_COPY.followUp);
    expect(t).toContain(INTEREST_COPY.noReservation);
    expect(t).not.toMatch(/Wed|Thu|Fri|Sat/);
  });

  it("windows render as windows, never as booked slots", () => {
    const patrick = getMentors().find((m) => m.id === "patrick-haddox")!;
    const html = renderToStaticMarkup(createElement(AvailabilityBlocks, { mentor: patrick }));
    const t = text(html);
    expect(t).toContain("10:00–11:30 AM CT");
    expect(t).toContain("Availability window");
    expect(t).not.toContain("Confirmed slot");
    expect(html).toContain("border-dashed");
    expect(html).toContain('dateTime="2026-10-01"');
  });

  it("session details say 'To be confirmed' for unknowns", () => {
    const patrick = getMentors().find((m) => m.id === "patrick-haddox")!;
    const t = text(renderToStaticMarkup(createElement(SessionDetailsList, { session: patrick.session })));
    expect(t.match(/To be confirmed/g)).toHaveLength(3);
    expect(t).toContain("One or two sessions");
  });

  it("home preview list renders every mentor with portraits, CTAs and appearances", () => {
    const mentors = getMentors();
    const html = renderToStaticMarkup(
      createElement(MentorPreviewList, { mentors, appearances: appearancesByMentor(getScheduleEntries(), mentors) }),
    );
    const t = text(html);
    for (const name of NAMES) expect(t).toContain(name);
    expect(t).toContain("01 / 04");
    expect(t).toContain("Apply to meet Patrick");
    expect(t).toContain("Express interest");
    expect(t).toContain("Speaking Fri, Oct 2 · 1:55 PM");
    expectApplyLinksPreselect(html);
    expectPublicOnly(html);
  });

  it("other-mentors strip on a profile links to each mentor's application", () => {
    const [, ...others] = getMentors();
    const html = renderToStaticMarkup(createElement(OtherMentors, { mentors: others, applicationsOpen: true }));
    expect(text(html)).not.toContain("Patrick Haddox");
    expect(hrefs(html)).toContain("/office-hours?mentor=ron-lewis#apply");
    expectApplyLinksPreselect(html);
    expectPublicOnly(html);
  });

  it("closed applications never render application links", () => {
    const html = renderToStaticMarkup(createElement(MentorLineup, { mentors: getMentors(), applicationsOpen: false }));
    expect(hrefs(html).filter((h) => h.includes("#apply"))).toEqual([]);
    expect(text(html).match(/Applications closed/g)).toHaveLength(4);
  });

  it("process copy uses the shared application wording", () => {
    const t = text(renderToStaticMarkup(createElement(HowItWorks)));
    expect(t).toContain(APPLICATION_COPY.limited);
    expect(t).toContain("Submitting an application does not reserve a time slot.");
    const legend = text(renderToStaticMarkup(createElement(AvailabilityLegend)));
    for (const label of [
      "Availability window",
      "Exact times forthcoming",
      "Scheduling in progress",
      "Proposed slot",
      "Confirmed slot",
    ]) {
      expect(legend).toContain(label);
    }
  });
});

describe("mentor components (draft preview)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "true");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("labels unapproved topics as drafts instead of presenting them as confirmed", () => {
    const mentors = getMentors();
    const t = text(
      renderToStaticMarkup(createElement(MentorSections, { mentors, appearances: {}, applicationsOpen: true })),
    );
    expect(t).toContain("Ask me about");
    expect(t).toContain("Revenue strategy");
    expect(t).toContain("Draft");
  });
});
