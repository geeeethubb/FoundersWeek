/**
 * Renders the calendar's building blocks to static HTML with the public (default-env) data and
 * checks what students would see: the office-hours card (every mentor, one Apply button), a strictly
 * chronological agenda with accurate labels, mentor photos on office-hours rows, program-block
 * disclosure wiring, that Dan Caruso's fireside chat never offers any application or booking, that
 * Arnav hosts (not speaks at) his Wednesday happy hour with an external RSVP, that Rishab's
 * Thursday window reads 12:00–5:00 PM CT (and a date-only window never invents a time), and that
 * the canceled Founders Week Afterparty (HERE Apartments) never appears.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventPage, { generateMetadata } from "@/app/schedule/[id]/page";
import { getMentors, getScheduleEntries, getSite } from "@/content";
import type { Mentor } from "@/content/types";
import { Agenda } from "@/components/schedule/agenda";
import { AgendaPreview } from "@/components/schedule/agenda-preview";
import { AgendaRow } from "@/components/schedule/agenda-row";
import {
  EventCallout,
  EventFacts,
  EventPrimaryAction,
  ProgramTimeline,
  speakersHeading,
} from "@/components/schedule/event-detail";
import { OfficeHoursCard, officeHoursCardLede } from "@/components/schedule/office-hours-card";
import { PendingMentors } from "@/components/schedule/pending-mentors";
import { officeHoursToEntries } from "@/lib/schedule/entries";
import { groupByDay } from "@/lib/schedule/filter";
import { mentorHeadshots } from "@/lib/schedule/headshots";
import { pendingMentors } from "@/lib/schedule/pending-mentors";

const DAN = "dan-caruso-fireside-chat";
const PANEL = "how-to-make-10k-a-month-in-college";
const SHOWCASE = "founders-showcase-day-sessions";
const TECHRISE = "techrise-pitch-competition";
const HAPPY_HOUR = "happy-hour-at-legends-with-arnav-mishra";
const HAPPY_HOUR_TITLE = "Happy Hour with Arnav Mishra at Legends";
const PATRICK_OH = "office-hours-patrick-haddox-2026-10-01-am";
const RISHAB_OH = "office-hours-rishab-veldur-2026-10-01";
const RISHAB_APPLY = "/office-hours?mentor=rishab-veldur&window=rishab-veldur-2026-10-01#apply";
const PITCHING = "science-and-practice-of-pitching";
const IMPACT = "entrepreneurial-impact-launching-from-illinois";

/**
 * A synthetic mentor whose only window is date-only (time still to be confirmed). No real mentor
 * has one now that Rishab's Thursday window is set, but the code path stays for future mentors.
 */
const DATE_ONLY_MENTOR: Mentor = {
  id: "fixture-date-only",
  name: "Fixture Mentor",
  firstName: "Fixture",
  role: "Founder",
  company: "Fixture Labs",
  headshot: null,
  bio: null,
  expertise: null,
  askMeAbout: null,
  goodFitFor: null,
  session: {
    format: null,
    durationMinutes: null,
    location: null,
    sessionCount: null,
    confirmed: false,
    note: "Fixture has time for office hours on Thursday, October 1. We’re still confirming the exact time, length and location.",
  },
  availability: [
    { id: "fixture-date-only-2026-10-01", date: "2026-10-01", time: { kind: "tba" }, label: "Exact time to be confirmed" },
  ],
  slots: [],
  links: [],
  acceptingApplications: true,
  sources: [{ label: "Test fixture" }],
};
const FIXTURE_OH = "office-hours-fixture-date-only-2026-10-01";
const FIXTURE_APPLY = "/office-hours?mentor=fixture-date-only&window=fixture-date-only-2026-10-01#apply";
const PARTIFUL = "https://partiful.com/e/bUDJZTuCJyBqSeXAsfrN";
const DAN_LINKEDIN = "https://www.linkedin.com/in/danielpcaruso";
const MENTOR_NAMES = [
  "Patrick Haddox",
  "Arnav Mishra",
  "Vikram “Vik” Lakhwara",
  "Elliott Notrica",
  "Ron Lewis",
  "Rishab Veldur",
];
const MENTOR_IDS = ["patrick-haddox", "arnav-mishra", "vikram-lakhwara", "elliott-notrica", "ron-lewis", "rishab-veldur"];

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .replace(/ ([,:;.])/g, "$1");
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

/** Alt text of every rendered <img> (mentor headshots), in document order. */
function imageAlts(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\balt="([^"]*)"/g)].map((m) => m[1]);
}

/** No application, interest, waitlist or booking affordance of any kind. */
function expectNoApplication(html: string) {
  expect(text(html)).not.toMatch(/apply|express interest|waitlist|book(ing)?\b|reserve a/i);
  expect(hrefs(html).filter((h) => h.includes("#apply") || h.startsWith("/apply") || h.includes("mentor="))).toEqual([]);
}

/** The canceled Founders Week Afterparty (Sat Oct 3, HERE Apartments) must never appear. */
function expectNoCanceledAfterparty(s: string) {
  expect(s).not.toMatch(/HERE Apartments/i);
  expect(s).not.toContain("founders-week-afterparty");
  expect(s).not.toMatch(/Founders Week Afterparty/i);
}

/** The retired "technical" styling: HUD numerals, certainty line styles, mono metadata, grids. */
function expectCalmStyling(html: string) {
  expect(html).not.toMatch(/border-(dashed|dotted)|font-mono|mono-label|bg-blueprint|font-serif|font-wide/);
  expect(text(html)).not.toMatch(/\b0[1-9]\b\s*(·|—|Featured)|In priority order|Featured/);
  // Plain punctuation: no em dashes in anything students read (visible or screen-reader text).
  expect(text(html)).not.toContain("—");
}

/** Organizer-only notes and Ron's draft topics (his approved "Revenue strategy and optimization" is public). */
const PRIVATE =
  /Wednesday through Saturday|commitments|Revenue strategy(?! and optimization)|Startup financial planning|much more available/i;

/** Rishab's email details stay organizer-only; Auvi's device claims and 1:1 meetings are never made. */
const RISHAB_PRIVATE = /student teams|phone|eligibility|FDA|\bcleared\b|commercially available|clinically proven|one-on-one/i;

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("calendar components (public data)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  const entry = (id: string) => getScheduleEntries().find((e) => e.id === id)!;
  const headshots = () => mentorHeadshots(getMentors());

  it("the office-hours card shows every mentor with their photo and one Apply button", () => {
    const html = render(createElement(OfficeHoursCard, { mentors: getMentors() }));
    const t = text(html);
    expect(t).toContain("Hosted by Founders");
    expect(t).toContain("Founders Office Hours");
    expect(t).toContain(
      "One application covers all six mentors. Appointments are limited. Times for Vik, Elliott and Ron are still being set.",
    );
    // Full lineup (sm and up), in display order, each with company and a profile link.
    const positions = MENTOR_NAMES.map((name) => t.indexOf(name));
    expect(positions.every((i) => i >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(t).toContain("Elliott Notrica Symbio Bioculinary");
    expect(t).toContain("Ron Lewis Auctus Advisory Rishab Veldur Auvi Labs");
    // Phones get the same faces (decorative) plus first names.
    expect(t).toContain("Patrick, Arnav, Vik, Elliott, Ron and Rishab");
    expect(imageAlts(html)).toEqual([...MENTOR_NAMES, ...MENTOR_NAMES]);
    const links = hrefs(html);
    expect(links.filter((h) => h.includes("#apply"))).toEqual(["/office-hours#apply"]);
    expect(links).toContain("/office-hours");
    expect(links.filter((h) => h.startsWith("/office-hours/"))).toEqual(MENTOR_IDS.map((id) => `/office-hours/${id}`));
    // Six mentors balance into three across at lg (two rows of three), two columns from sm.
    const lineup = html.match(/<ul aria-label="Office-hours mentors" class="([^"]+)"/)![1].split(" ");
    expect(lineup).toEqual(expect.arrayContaining(["sm:grid", "sm:grid-cols-2", "lg:grid-cols-3"]));
    expect(lineup.filter((c) => /^lg:grid-cols-/.test(c))).toEqual(["lg:grid-cols-3"]);
    expect(t).not.toMatch(/one-on-one|Dan Caruso/i);
    expect(t).not.toMatch(PRIVATE);
    expect(t).not.toMatch(RISHAB_PRIVATE);
    expectCalmStyling(html);
  });

  it("the office-hours card lede only names mentors who are still scheduling", () => {
    const m = (firstName: string, scheduled: boolean) => ({
      firstName,
      availability: scheduled ? [{ id: "w", date: "2026-10-01", time: { kind: "tba" as const } }] : [],
      slots: [],
    });
    expect(officeHoursCardLede([m("A", true), m("B", true), m("C", true)])).toBe(
      "One application covers all three mentors. Appointments are limited.",
    );
    expect(officeHoursCardLede([m("A", true), m("B", false)])).toBe(
      "One application covers both mentors. Appointments are limited. Times for B are still being set.",
    );
    // A date-only window (time still to be confirmed) counts as scheduled: only mentors with no
    // published times are named.
    expect(
      officeHoursCardLede([m("A", true), m("B", true), m("C", false), m("D", false), m("E", false), m("F", true)]),
    ).toBe("One application covers all six mentors. Appointments are limited. Times for C, D and E are still being set.");
    expect(officeHoursCardLede(getMentors())).toBe(
      "One application covers all six mentors. Appointments are limited. Times for Vik, Elliott and Ron are still being set.",
    );
  });

  it("the agenda is chronological by day, with calm labels only where they carry meaning", () => {
    const html = render(createElement(Agenda, { groups: groupByDay(getScheduleEntries()), headshots: headshots() }));
    const t = text(html);
    const days = [...html.matchAll(/<h2 id="day-(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]);
    expect(days).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
    const titles = [...html.matchAll(/<h3[^>]*><a[^>]*>([^<]+)<\/a><\/h3>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    expect(titles).toEqual([
      "Fireside Chat with Dan Caruso",
      "How to Make $10K/Month in College",
      "Founders Week Kickoff Reception",
      HAPPY_HOUR_TITLE,
      "Founder Failure Lab",
      "Office hours with Patrick Haddox",
      "The Science and Practice of Pitching",
      // Rishab's noon–5 PM window sorts by its start, and is listed once (not repeated per overlap).
      "Office hours with Rishab Veldur",
      "Entrepreneurial Impact: Launching From Illinois",
      "TechRise Pitch Competition and Panel Discussion",
      "Office hours with Arnav Mishra",
      "Founders Showcase Day Sessions",
      "Founders Evening Showcase and Reception",
      "Tailgate and EnterpriseWorks Tour",
      "Illinois Football Game vs. Purdue",
    ]);
    // Labels: Founders' involvement and related events; the official program needs no badge.
    expect(t.match(/Supported by Founders/g)).toHaveLength(2); // Dan Caruso, Arnav's happy hour
    expect(t.match(/Co-hosted by Founders(?!\.)/g)).toHaveLength(1);
    // Office hours (Patrick, Rishab, Arnav) + Founder Failure Lab (badge, not its summary).
    expect(t.match(/Hosted by Founders(?!\.)/g)).toHaveLength(4);
    expect(t.match(/Related event/g)).toHaveLength(3);
    expect(t).not.toContain("Part of Founders Week");
    // Office-hours windows: Patrick's and Rishab's are exact; Arnav's (morning) isn't.
    expect(t.match(/Availability window/g)).toHaveLength(2);
    expect(t.match(/Exact times TBA/g)).toHaveLength(1);
    // Overlaps are named on each row: Wednesday evening (both ways), and Rishab's window with the
    // two Thursday program blocks it runs through (never with Patrick's window or TechRise).
    const overlapNotes = [...html.matchAll(/Overlaps with.*?<\/p>/g)].map((m) => text(m[0]).trim());
    expect(overlapNotes).toEqual([
      "Overlaps with Founder Failure Lab", // Arnav's happy hour
      "Overlaps with Happy Hour with Arnav Mishra at Legends", // Founder Failure Lab
      "Overlaps with Office hours with Rishab Veldur", // The Science and Practice of Pitching
      "Overlaps with The Science and Practice of Pitching and Entrepreneurial Impact: Launching From Illinois", // Rishab
      "Overlaps with Office hours with Rishab Veldur", // Entrepreneurial Impact
    ]);
    expect(t).toContain(
      "12:00 PM to 5:00 PM Office hours with Rishab Veldur Location to be announced Rishab Veldur Co-Founder & CEO, Auvi Labs (mentor profile) Hosted by Founders Availability window Overlaps with The Science and Practice of Pitching and Entrepreneurial Impact: Launching From Illinois Apply to meet Rishab",
    );
    // Office-hours rows carry the mentor's photo; so do mentors on stage in program blocks.
    expect(imageAlts(html)).toEqual([
      "Patrick Haddox", // Thu: office hours
      "Rishab Veldur", // Thu: office hours (noon–5 PM)
      "Elliott Notrica", // Thu: TechRise, on stage
      "Arnav Mishra", // Fri: office hours
      "Rishab Veldur", // Fri: Founders Showcase, on stage (Health Innovation)
      "Arnav Mishra",
      "Patrick Haddox",
      "Vikram “Vik” Lakhwara",
    ]);
    expectNoCanceledAfterparty(html);
    expect(t).not.toMatch(PRIVATE);
    expect(t).not.toMatch(RISHAB_PRIVATE);
    expect(t).not.toMatch(/one-on-one/i);
    expectCalmStyling(html);
  });

  it("Dan Caruso's row is information only: 4:00 PM at the Beckman Institute, supported by Founders", () => {
    const row = render(createElement(AgendaRow, { entry: entry(DAN) }));
    expectNoApplication(row);
    const t = text(row);
    expect(t).toContain("4:00 PM");
    expect(t).not.toMatch(/4:00 PM to/); // no end time was announced — none is invented
    expect(t).toContain("Beckman Institute · Auditorium (Room 1025)");
    expect(t).toContain("Supported by Founders");
    expect(t).toContain("Related event");
    expect(hrefs(row)).toEqual([`/schedule/${DAN}`, DAN_LINKEDIN]);
    expectCalmStyling(row);
  });

  it("the private-session callout is informational — no links or buttons", () => {
    const html = render(createElement(EventCallout, { callout: entry(DAN).callout! }));
    expect(text(html)).toContain("Private session with Dan Caruso");
    expect(html).not.toMatch(/<a |<button/);
    expectNoApplication(html);
  });

  it("Dan Caruso's event page: when, where, callout, speaker, LinkedIn — and no application anywhere", async () => {
    const html = render(await EventPage({ params: Promise.resolve({ id: DAN }) }));
    const t = text(html);
    expect(html).toMatch(/<h1[^>]*>Fireside Chat with Dan Caruso<\/h1>/);
    expect(t).toContain("Supported by Founders Related event");
    expect(t).toContain("When Monday, September 28 4:00 PM CT");
    expect(t).toContain("Where Beckman Institute Auditorium (Room 1025) 405 N. Mathews Ave., Urbana, IL 61801");
    expect(t).toContain("Dan Caruso is one of the most successful entrepreneurs among Illinois alumni.");
    expect(t).toContain("Private session with Dan Caruso");
    expect(t).toMatch(/Speaker Dan Caruso Founder, Caruso Ventures · Founding CEO, Zayo Group/);
    expect(t).toContain("Dan Caruso on LinkedIn");
    expect(hrefs(html)).toContain(DAN_LINKEDIN);
    // No end time yet: no calendar file, and it says why.
    expect(t).toContain("Calendar export opens once an end time is announced.");
    expect(hrefs(html).some((h) => h.endsWith(".ics") || h.startsWith("https://calendar.google.com/"))).toBe(false);
    expectNoApplication(html);
    expectNoCanceledAfterparty(html);
    expectCalmStyling(html);
  });

  it("the Sep 29 panel row shows its co-hosted label, times and official event information link", () => {
    const html = render(createElement(AgendaRow, { entry: entry(PANEL) }));
    const t = text(html);
    expect(t).toContain("Co-hosted by Founders");
    expect(t).toContain("6:00 PM to 8:00 PM");
    expect(t).toContain("Materials Science and Engineering Building · Room 100");
    expect(html).toMatch(/href="https:\/\/www\.austnkennedy\.com\/how-to-make-10k-a-month-in-college" target="_blank" rel="noopener noreferrer"/);
    expectNoApplication(html);
  });

  it("Arnav's happy hour row: a related Founders pick on Wednesday at 5 PM, no application", () => {
    const html = render(createElement(AgendaRow, { entry: entry(HAPPY_HOUR) }));
    const t = text(html);
    expect(t).toContain("5:00 PM to 7:00 PM");
    expect(t).toContain(HAPPY_HOUR_TITLE);
    expect(t).toContain("Related event");
    expect(t).toContain("Founders pick");
    expect(t).toContain("Legends");
    expect(t).toContain("Supported by Founders");
    expect(t).not.toMatch(/Hosted by Founders|Co-hosted by Founders|Part of Founders Week/);
    expect(hrefs(html)).toEqual([`/schedule/${HAPPY_HOUR}`]);
    expectNoApplication(html);
    expectNoCanceledAfterparty(html);
  });

  it("Arnav's happy hour facts and primary action: RSVP on Partiful (external), never an application", () => {
    const facts = render(createElement(EventFacts, { entry: entry(HAPPY_HOUR) }));
    const t = text(facts);
    expect(t).toContain("When Wednesday, September 30 5:00–7:00 PM CT");
    expect(t).toContain("Where Legends 6th & Green");
    // The organizer line would only repeat the host listed on the page.
    expect(t).not.toContain("Organizer");
    expectNoApplication(facts);

    const action = render(createElement(EventPrimaryAction, { entry: entry(HAPPY_HOUR) }));
    expect(text(action)).toContain("RSVP on Partiful");
    expect(hrefs(action)).toEqual([PARTIFUL]);
    expect(action).toContain('target="_blank" rel="noopener noreferrer"');
    expectNoApplication(action);
  });

  it("Founder Failure Lab page: hosted by Founders, three speakers linked to LinkedIn, register on Luma", async () => {
    const html = render(await EventPage({ params: Promise.resolve({ id: "founder-failure-lab" }) }));
    const t = text(html);
    expect(html).toMatch(/<h1[^>]*>Founder Failure Lab<\/h1>/);
    expect(t).toContain("Hosted by Founders");
    expect(t).toContain("Wednesday, September 30");
    expect(t).toContain("6:30–8:30 PM CT");
    expect(t).toContain("Campus Instructional Facility (CIF)");
    expect(t).toContain("Room 1038");
    expect(t).toContain("1405 Springfield Ave., Urbana, IL 61801");
    expect(t).toContain("The setbacks. The hard lessons. The next attempt.");
    // Registration is on Luma (external, new tab); no "coming soon" note any more.
    expect(t).not.toContain("Registration coming soon");
    expect(html).toContain('href="https://luma.com/hyoeuqh1" target="_blank" rel="noopener noreferrer"');
    expect(t).toContain("Register on Luma");
    expect(html).toMatch(/<h2 id="speakers-heading"[^>]*>Speakers<\/h2>/);
    for (const [name, url] of [
      ["Manu Edakara", "https://www.linkedin.com/in/manuedakara/"],
      ["Sharan Mehta", "https://www.linkedin.com/in/sharanmehta/"],
      ["Nick Militello", "https://www.linkedin.com/in/nickdymondmilitello/"],
    ]) {
      expect(html).toContain(`href="${url}" target="_blank" rel="noopener noreferrer"`);
      expect(t).toContain(`${name}`);
    }
    expect(t).toContain("Director, iVenture Accelerator · Forbes 30 Under 30");
    expect(t).not.toContain("Edakkara");
    // The organizers' statistics, credited to their source.
    expect(t).toContain(
      "In a CB Insights analysis of hundreds of startup shutdowns, 70% ran out of capital, 43% struggled with product-market fit, and 29% suffered from bad timing.",
    );
    expect(t).toContain("At Founder Failure Lab, you’ll guess what caused real companies to fail");
    expect(t).toContain("Founder, NoshBox · iVenture 11");
    expect(t).toContain("Founder, VORO and PromoPigeon · iVenture 10 and 12");
    expect(t.match(/on LinkedIn \(opens in new tab\)/g)).toHaveLength(3);
    // It overlaps Arnav's happy hour, and says so.
    expect(hrefs(html)).toContain(`/schedule/${HAPPY_HOUR}`);
    expect(hrefs(html)).toContain("/schedule/founder-failure-lab/calendar.ics");
    expectNoApplication(html);
  });

  it("Arnav's happy hour page: Arnav is the Host (not a speaker), RSVP, calendar export", async () => {
    const html = render(await EventPage({ params: Promise.resolve({ id: HAPPY_HOUR }) }));
    const t = text(html);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${HAPPY_HOUR_TITLE}</h1>`));
    expect(t).toContain("Related event Founders pick");
    expect(t).toContain("invited the Founders community to his happy hour at Legends (6th & Green)");
    expect(t).toContain("Food and drinks are covered by the host. RSVP on Partiful is required.");
    // Host: Arnav, with his photo, linked to his office-hours profile.
    expect(html).toMatch(/<h2 id="speakers-heading"[^>]*>Host<\/h2>/);
    expect(t).not.toMatch(/\bSpeakers?\b/);
    expect(t).toMatch(/Host Arnav Mishra Office-hours mentor Co-Founder & CTO, Doss/);
    expect(imageAlts(html)).toContain("Arnav Mishra");
    const links = hrefs(html);
    expect(links).toContain("/office-hours/arnav-mishra");
    expect(links).toContain(PARTIFUL);
    // Confirmed with exact times: .ics and Google Calendar are both offered.
    expect(links).toContain(`/schedule/${HAPPY_HOUR}/calendar.ics`);
    const google = links.find((h) => h.startsWith("https://calendar.google.com/"))!;
    expect(new URL(google).searchParams.get("dates")).toBe("20260930T170000/20260930T190000");
    // Same-day context: the kickoff reception and Founder Failure Lab (which overlaps).
    expect(t).toContain("Also on Wednesday, September 30");
    expect(links).toContain("/schedule/founders-week-kickoff-reception");
    expect(links).toContain("/schedule/founder-failure-lab");
    // Supported by Founders; never an application or the canceled afterparty.
    expectNoApplication(html);
    expect(t).toContain("Supported by Founders");
    expect(t).not.toMatch(/Co-hosted by Founders|Part of Founders Week/);
    expectNoCanceledAfterparty(html);
    expect(t).not.toMatch(PRIVATE);
    expectCalmStyling(html);
  });

  it("labels hosts and moderators accurately", () => {
    expect(speakersHeading([{ role: "host" }])).toBe("Host");
    expect(speakersHeading([{ role: "host" }, { role: "host" }])).toBe("Hosts");
    expect(speakersHeading([{}])).toBe("Speaker");
    expect(speakersHeading([{}, { role: "moderator" }])).toBe("Speakers");
  });

  it("office-hours rows show the mentor's photo and open the application with mentor and window preselected", () => {
    const html = render(createElement(AgendaRow, { entry: entry(PATRICK_OH), headshots: headshots() }));
    const t = text(html);
    expect(t).toContain("10:00 AM to 11:30 AM");
    expect(t).toContain("Apply to meet Patrick");
    expect(t).toContain("CEO & Co-Founder, Samara Aerospace");
    expect(t).toContain("Hosted by Founders Availability window");
    expect(imageAlts(html)).toEqual(["Patrick Haddox"]);
    expect(hrefs(html)).toEqual([
      `/schedule/${PATRICK_OH}`,
      "/office-hours/patrick-haddox",
      "/office-hours?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am#apply",
    ]);
  });

  it("the office-hours page for a window: mentor, apply, honest notes, no calendar file", async () => {
    const html = render(await EventPage({ params: Promise.resolve({ id: PATRICK_OH }) }));
    const t = text(html);
    expect(t).toContain("When Thursday, October 1 10:00–11:30 AM CT Availability window, not a booked appointment.");
    expect(t).toContain("Hosted by Founders – Illinois Entrepreneurs");
    expect(t).toContain("Submitting an application doesn’t reserve a time slot.");
    expect(t).toContain("Appointments are limited.");
    expect(imageAlts(html)).toContain("Patrick Haddox");
    expect(hrefs(html)).toContain("/office-hours?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am#apply");
    expect(hrefs(html).some((h) => h.endsWith(".ics"))).toBe(false);
    expect(t).not.toMatch(/one-on-one/i);
    expect(t).not.toMatch(PRIVATE);
  });

  it("Rishab's office-hours row: Thursday 12:00 to 5:00 PM, an availability window, apply with his window preselected", () => {
    const html = render(createElement(AgendaRow, { entry: entry(RISHAB_OH), headshots: headshots() }));
    const t = text(html);
    // Reads like Patrick's row ("10:00 AM to 11:30 AM").
    expect(t).toContain("12:00 PM to 5:00 PM Office hours with Rishab Veldur Location to be announced");
    expect([...html.matchAll(/<time dateTime="([^"]+)"/g)].map((m) => m[1])).toEqual(["2026-10-01T12:00"]);
    expect(t).not.toMatch(/Time to be announced|Time TBA|Exact times TBA/);
    expect(t).toContain("Rishab Veldur Co-Founder & CEO, Auvi Labs");
    expect(t).toContain("Hosted by Founders Availability window");
    expect(t).toContain("Apply to meet Rishab");
    expect(imageAlts(html)).toEqual(["Rishab Veldur"]);
    expect(hrefs(html)).toEqual([`/schedule/${RISHAB_OH}`, "/office-hours/rishab-veldur", RISHAB_APPLY]);
    expect(t).not.toMatch(/October 2|Oct 2\b|Friday/i);
    expect(t).not.toMatch(RISHAB_PRIVATE);
    expectCalmStyling(html);
  });

  it("a date-only office-hours row (a future mentor's): time to be announced, nothing invented", () => {
    const [dateOnly] = officeHoursToEntries(DATE_ONLY_MENTOR, getSite());
    expect(dateOnly.id).toBe(FIXTURE_OH);
    const html = render(createElement(AgendaRow, { entry: dateOnly, headshots: headshots() }));
    const t = text(html);
    expect(t).toContain("Time to be announced Office hours with Fixture Mentor Location to be announced");
    // No time is invented: no <time> element, no "to …" line.
    expect(html).not.toMatch(/<time\b/);
    expect(t).not.toMatch(/\d:\d\d [AP]M/);
    expect(t).toContain("Fixture Mentor Founder, Fixture Labs");
    expect(t).toContain("Hosted by Founders Exact times TBA");
    expect(t).not.toContain("Availability window");
    expect(t).toContain("Apply to meet Fixture");
    expect(imageAlts(html)).toEqual([]); // no approved photo
    expect(hrefs(html)).toEqual([`/schedule/${FIXTURE_OH}`, "/office-hours/fixture-date-only", FIXTURE_APPLY]);
    expectCalmStyling(html);

    // Its facts say the window is still to be confirmed; the primary action is the application.
    const facts = text(render(createElement(EventFacts, { entry: dateOnly })));
    expect(facts).toContain("When Thursday, October 1 Time to be announced Exact window to be confirmed.");
    expect(facts).toContain("Where Location to be announced Location is shared with selected students once confirmed.");
    expect(facts).not.toMatch(/\d:\d\d|Availability window, not a booked appointment/);
    const action = render(createElement(EventPrimaryAction, { entry: dateOnly }));
    expect(text(action)).toContain("Apply to meet Fixture");
    expect(hrefs(action)).toEqual([FIXTURE_APPLY]);
  });

  it("Rishab's office-hours page: Thu Oct 1, 12:00–5:00 PM CT, apply, honest notes, overlaps, no calendar file", async () => {
    const html = render(await EventPage({ params: Promise.resolve({ id: RISHAB_OH }) }));
    const t = text(html);
    expect(html).toMatch(/<h1[^>]*>Office hours with Rishab Veldur<\/h1>/);
    expect(t).toContain("Hosted by Founders Availability window Office hours with Rishab Veldur");
    expect(t).toContain("When Thursday, October 1 12:00–5:00 PM CT Availability window, not a booked appointment.");
    expect(t).not.toMatch(/Time to be announced|Exact window to be confirmed|Exact times TBA/);
    expect(t).toContain("Where Location to be announced Location is shared with selected students once confirmed.");
    expect(t).toContain("Hosted by Founders – Illinois Entrepreneurs");
    expect(t).toContain("Rishab Veldur Co-Founder & CEO, Auvi Labs More about Rishab");
    expect(t).toContain(
      "Rishab is holding office hours on Thursday, October 1, anytime from noon to 5 PM. We’re still setting session length and location.",
    );
    expect(t).toContain("Submitting an application doesn’t reserve a time slot.");
    expect(t).toContain("Appointments are limited.");
    // Office hours never export to calendars, and the page says why.
    expect(t).toContain("Office hours are by application. Selected students get their confirmed time by email.");
    const links = hrefs(html);
    expect(links.some((h) => h.endsWith(".ics") || h.startsWith("https://calendar.google.com/"))).toBe(false);
    expect(links.filter((h) => h.includes("#apply"))).toEqual([RISHAB_APPLY]);
    expect(links).toContain("/office-hours/rishab-veldur");
    expect(imageAlts(html)).toEqual(["Rishab Veldur"]);
    // His window runs through two Thursday program blocks, and the page says so.
    expect(t).toContain(
      "Overlaps with This time overlaps with other listings. 11:45 AM The Science and Practice of Pitching Gies Business Instructional Facility · 3 sessions 3:00 PM Entrepreneurial Impact: Launching From Illinois Beckman Institute",
    );
    // The rest of Thursday (overlaps aren't repeated there); his Friday Showcase panel is a different day.
    expect(t).toContain("Also on Thursday, October 1");
    const sameDay = t.slice(t.indexOf("Also on Thursday, October 1"));
    expect(sameDay).toContain("10:00 AM Office hours with Patrick Haddox");
    expect(sameDay).toContain("5:00 PM TechRise Pitch Competition and Panel Discussion");
    expect(sameDay).not.toMatch(/Science and Practice of Pitching|Entrepreneurial Impact/);
    for (const id of [PATRICK_OH, PITCHING, IMPACT, TECHRISE]) {
      expect(links.filter((h) => h === `/schedule/${id}`), id).toHaveLength(1);
    }
    expect(links).not.toContain(`/schedule/${SHOWCASE}`);
    expect(t).not.toMatch(/October 2|Oct 2\b|Friday/i);
    expect(t).not.toMatch(RISHAB_PRIVATE);
    expect(t).not.toMatch(PRIVATE);
    expectCalmStyling(html);

    const meta = await generateMetadata({ params: Promise.resolve({ id: RISHAB_OH }) });
    expect(meta.title).toBe("Office hours with Rishab Veldur");
    expect(meta.description).toBe(
      "Thursday, October 1 · 12:00–5:00 PM CT. By application. Meet Rishab of Auvi Labs during Founders Week. Appointments are limited.",
    );
  });

  it("program blocks: collapsed disclosure wired with aria-expanded/aria-controls, mentors on stage", () => {
    const html = render(createElement(AgendaRow, { entry: entry(SHOWCASE), programOpen: false, headshots: headshots() }));
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(`aria-controls="program-${SHOWCASE}"`);
    expect(html).toMatch(new RegExp(`id="program-${SHOWCASE}" hidden=""`));
    const t = text(html);
    expect(t).toContain("Show 11 sessions");
    expect(t).toContain("Office-hours mentors on stage");
    expect(t).toContain(
      "Rishab Veldur speaks at 1:20 PM Arnav Mishra speaks at 1:55 PM Patrick Haddox speaks at 2:40 PM Vik Lakhwara speaks at 2:55 PM",
    );
    for (const id of ["rishab-veldur", "arnav-mishra", "patrick-haddox", "vikram-lakhwara"]) {
      expect(hrefs(html)).toContain(`/office-hours/${id}`);
    }
    expect(imageAlts(html)).toEqual(["Rishab Veldur", "Arnav Mishra", "Patrick Haddox", "Vikram “Vik” Lakhwara"]);
    // The full list is in the (hidden) panel, with each mentor marked.
    expect(t.match(/Office-hours mentor\b/g)).toHaveLength(4);
    expect(t).toContain(
      "1:20–1:55 PM Health Innovation: From Therapeutics to Devices Marty Burke, Carol Curtis, Steve Boppart, Rishab Veldur Office-hours mentor and Rohit Bhargava",
    );
    expect(t).toContain("Moderators: Scott Rose and Susan Martinis");
    expect(t).toContain("Fireside Chat with Chancellor Charles Isbell");
    expectCalmStyling(html);
  });

  it("program blocks: Elliott is on stage at the TechRise Cohort 2 panel", () => {
    const html = render(createElement(AgendaRow, { entry: entry(TECHRISE), programOpen: false }));
    const t = text(html);
    expect(t).toContain("Show 4 sessions");
    expect(t).toContain("Office-hours mentors on stage");
    expect(t).toContain("Elliott Notrica speaks at 6:30 PM");
    expect(hrefs(html)).toContain("/office-hours/elliott-notrica");
    expect(t.match(/Office-hours mentor\b/g)).toHaveLength(1);
    expect(t).toContain("Mehmet Gunal and Elliott Notrica Office-hours mentor Additional participants to be announced.");
  });

  it("program blocks: open state and search matches", () => {
    const html = render(createElement(AgendaRow, { entry: entry(SHOWCASE), programOpen: true, sessionMatches: [3] }));
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toMatch(new RegExp(`id="program-${SHOWCASE}" hidden`));
    expect(text(html)).toContain("Hide 11 sessions");
    expect(text(html)).toContain("1 match");
    expect(text(html).match(/Matches your search/g)).toHaveLength(1);
  });

  it("the detail program lists every session with anchors and per-mentor CTAs", () => {
    const html = render(
      createElement(ProgramTimeline, { entry: entry(SHOWCASE), headingId: "program-heading", mentors: getMentors() }),
    );
    expect(html.match(/<li[^>]*id="session-\d{4}"/g)).toHaveLength(11);
    const t = text(html);
    expect(t).toContain("11 sessions · 8:00 AM–5:30 PM CT");
    expect(t).toContain("Office-hours mentors in this program");
    expect(t).toContain("Rishab Veldur Co-Founder & CEO, Auvi Labs 1:20–1:55 PM Apply to meet Rishab");
    expect(t).toContain("Apply to meet Arnav");
    expect(t).toContain("Apply to meet Patrick");
    expect(t).toContain("Express interest in office hours with Vikram “Vik” Lakhwara");
    expect(t.match(/Express interest/g)).toHaveLength(1); // Vik only: Rishab has a published window
    expect(t).not.toMatch(/one-on-one/i);
    expect(t).not.toMatch(RISHAB_PRIVATE);
    expect(imageAlts(html)).toEqual(["Rishab Veldur", "Arnav Mishra", "Patrick Haddox", "Vikram “Vik” Lakhwara"]);
    const links = hrefs(html);
    expect(links.filter((h) => h.includes("#apply"))).toEqual([
      "/office-hours?mentor=rishab-veldur#apply",
      "/office-hours?mentor=arnav-mishra#apply",
      "/office-hours?mentor=patrick-haddox#apply",
      "/office-hours?mentor=vikram-lakhwara#apply",
    ]);
    expect(links).toContain("/office-hours/rishab-veldur");
    expect(links).toContain("#session-1320");
    expect(links).toContain("#session-1355");
    expectCalmStyling(html);
  });

  it("the detail program counts the mentors on stage in words (four, Rishab included)", () => {
    const html = render(
      createElement(ProgramTimeline, { entry: entry(SHOWCASE), headingId: "program-heading", mentors: getMentors() }),
    );
    const t = text(html);
    expect(t).toContain("Four speakers here are also holding Founders Office Hours this week. Appointments are limited.");
    expect(t).not.toMatch(/\b\d+ speakers here\b/);
  });

  it("the TechRise detail program offers Elliott's 'Express interest' CTA", () => {
    const html = render(
      createElement(ProgramTimeline, { entry: entry(TECHRISE), headingId: "program-heading", mentors: getMentors() }),
    );
    expect(html.match(/<li[^>]*id="session-\d{4}"/g)).toHaveLength(4);
    const t = text(html);
    expect(t).toContain("One speaker here is also holding Founders Office Hours this week.");
    expect(t).toContain("Elliott Notrica Founder & CEO, Symbio Bioculinary 6:30–6:50 PM");
    expect(t).toContain("Express interest in office hours with Elliott Notrica");
    expect(t).not.toMatch(/Apply to meet Elliott/);
    expect(imageAlts(html)).toEqual(["Elliott Notrica"]);
    const links = hrefs(html);
    expect(links).toContain("/office-hours/elliott-notrica");
    expect(links).toContain("/office-hours?mentor=elliott-notrica#apply");
    expect(links).toContain("#session-1830");
    expect(links.some((h) => h.startsWith("/apply"))).toBe(false);
  });

  it("the agenda preview and pending-mentor block stay public and link correctly", () => {
    const preview = render(createElement(AgendaPreview, { entries: getScheduleEntries().slice(0, 4) }));
    expect(text(preview)).toContain("Mon Sep 28 4:00 PM Fireside Chat with Dan Caruso");
    expect(text(preview)).toContain(`Wed Sep 30 5:00 PM ${HAPPY_HOUR_TITLE} Legends Supported by Founders Related event Founders pick`);
    expect(hrefs(preview)).toContain(`/schedule/${HAPPY_HOUR}`);
    expectNoCanceledAfterparty(preview);
    expectCalmStyling(preview);
    const pending = render(createElement(PendingMentors, { mentors: pendingMentors(getMentors()) }));
    expect(hrefs(pending)).toEqual([
      "/office-hours/vikram-lakhwara",
      "/office-hours?mentor=vikram-lakhwara#apply",
      "/office-hours/elliott-notrica",
      "/office-hours?mentor=elliott-notrica#apply",
      "/office-hours/ron-lewis",
      "/office-hours?mentor=ron-lewis#apply",
    ]);
    // Rishab has a published window (Thu Oct 1, noon to 5 PM), so he isn't listed as still scheduling.
    expect(imageAlts(pending)).toEqual(["Vikram “Vik” Lakhwara", "Elliott Notrica", "Ron Lewis"]);
    expect(text(pending)).toContain("Elliott Notrica Founder & CEO, Symbio Bioculinary Express interest");
    expect(text(pending)).not.toMatch(PRIVATE);
    expect(text(pending)).not.toMatch(/Wednesday/i);
  });
});
