import { describe, expect, it } from "vitest";
import { demoEvents, demoMentors } from "@/content/demo";
import { events } from "@/content/events";
import { mentors } from "@/content/mentors";
import { site } from "@/content/site";
import type { Mentor, ScheduleEvent } from "@/content/types";
import { buildScheduleEntries, eventToEntry, featuredEntries, scheduleDays } from "@/lib/schedule/entries";
import {
  agendaBlocks,
  dayCounts,
  entriesOverlap,
  filterEntries,
  groupByDay,
  matchesQuery,
  normalizeSearchText,
  overlapsFor,
  relaxations,
  typeFacets,
} from "@/lib/schedule/filter";
import {
  agendaTime,
  apMonthDay,
  calendarIntro,
  dateRangeLabel,
  entryStartText,
  entryTimeText,
  locationLines,
  locationSummary,
} from "@/lib/schedule/format";
import { mentorHeadshots } from "@/lib/schedule/headshots";
import { pendingMentorMatches, pendingMentors } from "@/lib/schedule/pending-mentors";
import {
  defaultProgramOpen,
  hasProgram,
  isLogistics,
  matchingSessionIndexes,
  mentorProfileHref,
  programMentors,
  sessionAnchorId,
  sessionCountLabel,
  sessionLineText,
  sessionPeopleText,
  sessionTimeLabel,
  splitSessionPeople,
} from "@/lib/schedule/program";
import {
  DEFAULT_SCHEDULE_FILTERS,
  parseScheduleFilters,
  scheduleHref,
  scheduleQuery,
  type ScheduleFilters,
} from "@/lib/schedule/url";

/** Public mentors as pages see them (organizer notes stripped; drafts removed). */
const publicMentors = mentors.map((m) => ({
  ...m,
  organizerNotes: undefined,
  askMeAbout: m.askMeAbout?.status === "approved" ? m.askMeAbout : null,
  goodFitFor: m.goodFitFor?.status === "approved" ? m.goodFitFor : null,
}));
const production = buildScheduleEntries({ events, mentors: publicMentors, site });
const demo = buildScheduleEntries({
  events: [...events, ...demoEvents],
  mentors: [...publicMentors, ...demoMentors],
  site,
});
const f = (patch: Partial<ScheduleFilters> = {}): ScheduleFilters => ({ ...DEFAULT_SCHEDULE_FILTERS, ...patch });
const ids = (list: { id: string }[]) => list.map((e) => e.id);
const byId = (id: string, list = production) => list.find((e) => e.id === id)!;

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
const withDateOnly = buildScheduleEntries({ events, mentors: [...publicMentors, DATE_ONLY_MENTOR], site });

const DAN = "dan-caruso-fireside-chat";
const PANEL = "how-to-make-10k-a-month-in-college";
const SHOWCASE = "founders-showcase-day-sessions";
const PATRICK_OH = "office-hours-patrick-haddox-2026-10-01-am";
const ARNAV_OH = "office-hours-arnav-mishra-2026-10-02-am";
const RISHAB_OH = "office-hours-rishab-veldur-2026-10-01";
const HEALTH_PANEL = "Health Innovation: From Therapeutics to Devices";
const HAPPY_HOUR = "happy-hour-at-legends-with-arnav-mishra";
const FAILURE_LAB = "founder-failure-lab";
const HAPPY_HOUR_TITLE = "Happy Hour with Arnav Mishra at Legends";
const TECHRISE = "techrise-pitch-competition";

/**
 * The Founders Week Afterparty (Sat Oct 3, HERE Apartments) was canceled and must never appear.
 * (Arnav's Wednesday happy hour at Legends is a separate, real event.)
 */
function expectNoCanceledAfterparty(s: string) {
  expect(s).not.toMatch(/HERE Apartments/i);
  expect(s).not.toContain("founders-week-afterparty");
  expect(s).not.toMatch(/Founders Week Afterparty/i);
}

describe("production calendar", () => {
  it("lists the full week (Mon Sep 28 – Sat Oct 3) in chronological order", () => {
    expect(ids(production)).toEqual([
      DAN,
      PANEL,
      "founders-week-kickoff-reception",
      // Arnav's happy hour starts as the kickoff reception ends (5:00 PM).
      HAPPY_HOUR,
      FAILURE_LAB,
      PATRICK_OH,
      "science-and-practice-of-pitching",
      // Rishab's Thursday window (noon–5 PM) sorts by its start, after the 11:45 AM workshop.
      RISHAB_OH,
      "entrepreneurial-impact-launching-from-illinois",
      "techrise-pitch-competition",
      ARNAV_OH,
      SHOWCASE,
      "founders-evening-showcase-and-reception",
      // Both Saturday items have no time yet: they keep the agenda order (tailgate first).
      "tailgate-and-enterpriseworks-tour",
      "illinois-football-vs-purdue",
    ]);
    expect(production).toHaveLength(15);
    const days = scheduleDays(production);
    expect(days).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(dateRangeLabel(days[0], days[days.length - 1])).toBe("Mon Sep 28 – Sat Oct 3");
  });

  it("no longer lists the canceled afterparty, but keeps the university's Friday evening showcase", () => {
    expectNoCanceledAfterparty(JSON.stringify(production));
    expect(production.some((e) => e.id === "founders-week-afterparty")).toBe(false);
    // No Saturday afterparty: Saturday is the tailgate and the game only.
    expect(ids(production.filter((e) => e.date === "2026-10-03"))).toEqual([
      "tailgate-and-enterpriseworks-tour",
      "illinois-football-vs-purdue",
    ]);
    const evening = byId("founders-evening-showcase-and-reception");
    expect(evening).toMatchObject({ date: "2026-10-02", status: "confirmed" });
  });

  it("lists Arnav's happy hour as a confirmed related pick with an external RSVP, exportable to calendars", () => {
    expect(byId(HAPPY_HOUR)).toMatchObject({
      kind: "event",
      title: HAPPY_HOUR_TITLE,
      date: "2026-09-30",
      time: { kind: "exact", start: "17:00", end: "19:00" },
      status: "confirmed",
      types: ["social", "networking"],
      involvement: "supported",
      related: true,
      foundersPick: true,
      featuredRank: 4,
      location: { kind: "in-person", venue: "Legends", address: "6th & Green" },
      registration: { label: "RSVP on Partiful", url: "https://partiful.com/e/bUDJZTuCJyBqSeXAsfrN", internal: false },
      calendar: { available: true },
      mentor: null,
      startsAt: "2026-09-30T22:00:00.000Z",
      endsAt: "2026-10-01T00:00:00.000Z",
    });
    expect(byId(HAPPY_HOUR).speakers).toEqual([
      expect.objectContaining({ name: "Arnav Mishra", role: "host", mentorId: "arnav-mishra" }),
    ]);
  });

  it("only creates office-hours entries for mentors with published windows", () => {
    expect(production.filter((e) => e.kind === "office-hours").map((e) => e.mentor!.id)).toEqual([
      "patrick-haddox",
      "rishab-veldur",
      "arnav-mishra",
    ]);
    // Vik, Elliott and Ron are "Scheduling in progress": no schedule entries, no invented windows.
    for (const id of ["vikram-lakhwara", "elliott-notrica", "ron-lewis"]) {
      expect(production.some((e) => e.mentor?.id === id)).toBe(false);
    }
  });

  it("lists Rishab's office hours once, on Thu Oct 1, anytime from noon to 5 PM", () => {
    const mine = production.filter((e) => e.mentor?.id === "rishab-veldur");
    expect(ids(mine)).toEqual([RISHAB_OH]);
    // He only has time for office hours on Oct 1: nothing on Friday.
    expect(production.filter((e) => e.date === "2026-10-02" && e.kind === "office-hours").map((e) => e.id)).toEqual([
      ARNAV_OH,
    ]);
    expect(byId(RISHAB_OH)).toEqual({
      id: RISHAB_OH,
      kind: "office-hours",
      title: "Office hours with Rishab Veldur",
      date: "2026-10-01",
      time: { kind: "exact", start: "12:00", end: "17:00" },
      // An exact window needs no label: its time is shown as "12:00–5:00 PM CT".
      timeLabel: null,
      // A window, not a confirmed session: length and location are still being set.
      status: "planned",
      statusNote:
        "Rishab is holding office hours on Thursday, October 1, anytime from noon to 5 PM. We’re still setting session length and location.",
      types: ["office-hours"],
      involvement: "hosted",
      foundersPick: true,
      organizer: "Founders – Illinois Entrepreneurs",
      location: { kind: "tba", note: "Location is shared with selected students once confirmed." },
      summary: "By application. Meet Rishab of Auvi Labs during Founders Week. Appointments are limited.",
      // His note already says it isn't a booked appointment, so that line isn't repeated.
      description:
        "Rishab Veldur (Co-Founder & CEO, Auvi Labs) is available for office hours: Thursday, October 1, 12:00–5:00 PM CT.\n\n" +
        "Rishab is free anytime from noon to 5 PM, but it isn’t a booked appointment. We’ll schedule sessions inside this window.\n\n" +
        "Appointments are limited. Founders will match applicants by interests and availability, then email selected students to confirm.",
      // No approved topic list: nothing is inferred from his background tags.
      speakers: [],
      topics: [],
      registration: {
        url: "/office-hours?mentor=rishab-veldur&window=rishab-veldur-2026-10-01#apply",
        label: "Apply to meet Rishab",
        internal: true,
      },
      links: [],
      sessions: [],
      featuredRank: 1,
      related: false,
      callout: null,
      sources: mentors.find((m) => m.id === "rishab-veldur")!.sources,
      mentor: {
        id: "rishab-veldur",
        name: "Rishab Veldur",
        firstName: "Rishab",
        role: "Co-Founder & CEO",
        company: "Auvi Labs",
        windowId: "rishab-veldur-2026-10-01",
      },
      demo: false,
      sortMinutes: 12 * 60,
      // Noon and 5 PM CDT (UTC−5).
      startsAt: "2026-10-01T17:00:00.000Z",
      endsAt: "2026-10-01T22:00:00.000Z",
      // Office hours are never exported to calendars, even with an exact window.
      calendar: {
        available: false,
        reason: "Office hours are by application. Selected students get their confirmed time by email.",
      },
    });
    // Displayed and searchable text (sources are citations for organizers, not rendered).
    const text = JSON.stringify({ ...byId(RISHAB_OH), sources: [] });
    expect(text).not.toMatch(/October 2|Oct 2\b|Friday|student teams|phone/i);
    expect(text).not.toMatch(/FDA|\bcleared\b|commercially available|clinically proven|one-on-one/i);
    // The old date-only wording is gone.
    expect(text).not.toMatch(/to be confirmed|to be announced|Time TBA/i);
  });

  it("still sorts a date-only window (a future mentor's) after the day's timed entries, time to be announced", () => {
    const thursday = withDateOnly.filter((e) => e.date === "2026-10-01");
    expect(ids(thursday)).toEqual([
      PATRICK_OH,
      "science-and-practice-of-pitching",
      RISHAB_OH,
      "entrepreneurial-impact-launching-from-illinois",
      TECHRISE,
      FIXTURE_OH,
    ]);
    expect(withDateOnly).toHaveLength(16);
    expect(byId(FIXTURE_OH, withDateOnly)).toMatchObject({
      kind: "office-hours",
      title: "Office hours with Fixture Mentor",
      date: "2026-10-01",
      time: { kind: "tba" },
      timeLabel: "Exact time to be confirmed",
      status: "planned",
      statusNote:
        "Fixture has time for office hours on Thursday, October 1. We’re still confirming the exact time, length and location.",
      location: { kind: "tba", note: "Location is shared with selected students once confirmed." },
      registration: {
        url: "/office-hours?mentor=fixture-date-only&window=fixture-date-only-2026-10-01#apply",
        label: "Apply to meet Fixture",
        internal: true,
      },
      featuredRank: 1,
      mentor: { id: "fixture-date-only", windowId: "fixture-date-only-2026-10-01" },
      sortMinutes: 24 * 60,
      startsAt: null,
      endsAt: null,
      calendar: {
        available: false,
        reason: "Office hours are by application. Selected students get their confirmed time by email.",
      },
    });
    // No time is invented anywhere in its copy.
    expect(byId(FIXTURE_OH, withDateOnly).description).not.toMatch(/\d:\d\d|\b(AM|PM)\b/);
    // Without an exact interval it can't clash with anything.
    expect(overlapsFor(byId(FIXTURE_OH, withDateOnly), withDateOnly)).toEqual([]);
  });

  it("links Rishab on the Friday Showcase's Health Innovation session, not as office hours", () => {
    const showcase = byId(SHOWCASE);
    const session = showcase.sessions[6];
    expect(session).toMatchObject({ start: "13:20", end: "13:55", title: HEALTH_PANEL });
    expect(session.people).toContainEqual({ name: "Rishab Veldur", verified: true, mentorId: "rishab-veldur" });
    expect(sessionPeopleText(session)).toBe("Marty Burke, Carol Curtis, Steve Boppart, Rishab Veldur and Rohit Bhargava");
    expect(sessionLineText(session)).toBe(
      "1:20–1:55 PM: Health Innovation: From Therapeutics to Devices (Marty Burke, Carol Curtis, Steve Boppart, Rishab Veldur and Rohit Bhargava)",
    );
    expect(sessionAnchorId(session)).toBe("session-1320");
  });

  it("never surfaces organizer-only notes or draft topics in searchable or displayed text", () => {
    const text = JSON.stringify(production);
    expect(text).not.toMatch(/Wednesday through Saturday/i);
    expect(text).not.toMatch(/commitments/i);
    expect(text).not.toMatch(/Revenue strategy|Startup financial planning|Communicating business progress/i);
    // Elliott's organizer note ("much more available… extra sessions") stays organizer-only too.
    expect(text).not.toMatch(/much more available|extra sessions/i);
    // So do Rishab's email details (Oct 2 attendance, preference for student teams, phone number).
    expect(text).not.toMatch(/student teams|eligibility rule|phone number|Oct 1 and 2/i);
  });

  it("never offers an application or booking for anything but office hours (Dan Caruso included)", () => {
    for (const e of production.filter((x) => x.kind === "event")) {
      expect(e.registration?.internal ?? false).toBe(false);
      expect(e.registration?.url ?? "").not.toMatch(/^\/|#apply|mentor=/);
    }
    const dan = byId(DAN);
    expect(dan.registration).toBeNull();
    expect(dan.callout?.title).toBe("Private session with Dan Caruso");
    expect(production.flatMap((e) => (e.mentor ? [e.mentor.id] : []))).not.toContain("dan-caruso");
  });
});

describe("search", () => {
  const find = (q: string, list = production) => ids(list.filter((e) => matchesQuery(e, q)));

  it("normalizes case, accents and punctuation", () => {
    expect(normalizeSearchText("  Café  CRÈME—Brûlée ")).toBe("cafe creme brulee");
    expect(normalizeSearchText("Founders’ Week")).toBe("founders week");
  });

  it("matches program sub-session titles and people", () => {
    expect(find("Isbell")).toEqual([SHOWCASE]);
    // Dan Caruso's bio mentions Caruso Ventures' quantum investments; Friday has a quantum session.
    expect(find("quantum")).toEqual([DAN, SHOWCASE]);
    expect(find("Hannah")).toEqual(["science-and-practice-of-pitching"]);
    expect(find("where are they now")).toEqual([TECHRISE]);
    expect(find("Martinis")).toEqual(["science-and-practice-of-pitching", TECHRISE, SHOWCASE]);
    expect(find("Elliott Notrica")).toEqual([TECHRISE]);
  });

  it("matches speakers, mentors and companies across events and office hours", () => {
    expect(find("Kennedy")).toEqual([PANEL]);
    expect(find("doss")).toEqual([HAPPY_HOUR, ARNAV_OH, SHOWCASE]);
    expect(find("arnav")).toEqual([HAPPY_HOUR, ARNAV_OH, SHOWCASE]);
    expect(find("aerospace")).toEqual([PATRICK_OH, SHOWCASE]);
    expect(find("caruso ventures")).toEqual([DAN]);
    expect(find("zayo")).toEqual([DAN]);
    expect(find("room 1025")).toEqual([DAN]);
    expect(find("beckman")).toEqual([DAN, "entrepreneurial-impact-launching-from-illinois"]);
    expect(find("materials science")).toEqual([PANEL]);
    expect(find("1304 W. Green")).toEqual([PANEL]);
    expect(find("legends")).toEqual([HAPPY_HOUR]);
    expect(find("6th green")).toEqual([HAPPY_HOUR]);
    expect(find("happy hour")).toEqual([HAPPY_HOUR]);
    // Rishab (and Auvi Labs): his Thursday office hours, and Friday's Showcase, whose blurb names him and Auvi Labs.
    expect(find("rishab")).toEqual([RISHAB_OH, SHOWCASE]);
    expect(find("Rishab Veldur")).toEqual([RISHAB_OH, SHOWCASE]);
    expect(find("auvi")).toEqual([RISHAB_OH, SHOWCASE]);
    expect(find("Auvi Labs")).toEqual([RISHAB_OH, SHOWCASE]);
    expect(find("health innovation")).toEqual([SHOWCASE]);
    expect(ids(filterEntries(production, f({ types: ["office-hours"], q: "rishab" })))).toEqual([RISHAB_OH]);
  });

  it("returns nothing for unknown terms or the canceled afterparty", () => {
    expect(find("zzz")).toEqual([]);
    expect(find("here apartments")).toEqual([]);
    expect(find("founders week afterparty")).toEqual([]);
    expect(ids(filterEntries(production, f({ day: "2026-10-03", q: "party" })))).toEqual([]);
  });

  it("finds demo content and ignores unverified speakers", () => {
    expect(find("casey", demo)).toEqual(["demo-customer-discovery-workshop"]);
    expect(find("demo finance society", demo)).toEqual(["demo-funding-panel"]);
    expect(demo.filter((e) => matchesQuery(e, "Unverified Speaker"))).toHaveLength(0);
  });

  it("does not match unverified session people", () => {
    const base = events.find((e) => e.id === SHOWCASE)!;
    const withHidden: ScheduleEvent = {
      ...base,
      id: "hidden-person-test",
      sessions: [{ start: "09:00", end: "09:30", title: "Opening", people: [{ name: "Secret Guest", verified: false }] }],
    };
    expect(matchesQuery(eventToEntry(withHidden), "Secret Guest")).toBe(false);
  });

  it("is accent-insensitive in both directions", () => {
    const cafe: ScheduleEvent = { ...demoEvents[0], id: "cafe-talk", title: "Café Founders Talk", demo: true };
    const entry = eventToEntry(cafe);
    expect(matchesQuery(entry, "cafe")).toBe(true);
    expect(matchesQuery(entry, "CAFÉ")).toBe(true);
  });

  it("marks which sub-sessions matched (3+ character words)", () => {
    const showcase = byId(SHOWCASE);
    expect(matchingSessionIndexes(showcase, "Isbell")).toEqual([3]);
    expect(showcase.sessions[3].title).toMatch(/^Fireside Chat with Chancellor Charles Isbell/);
    expect(matchingSessionIndexes(showcase, "quantum")).toEqual([2]);
    expect(matchingSessionIndexes(showcase, "Doss")).toEqual([7]);
    expect(matchingSessionIndexes(showcase, "Rishab")).toEqual([6]);
    expect(matchingSessionIndexes(showcase, "veldur health")).toEqual([6]);
    expect(matchingSessionIndexes(showcase, "charles isbell")).toEqual([3]);
    // Matched through the block's venue: no session is singled out (one title says "Illinois’").
    expect(matchingSessionIndexes(showcase, "Illinois Conference Center")).toEqual([]);
    expect(matchingSessionIndexes(showcase, "Isbell quantum")).toEqual([]);
    expect(matchingSessionIndexes(showcase, "ai")).toEqual([]);
    expect(matchingSessionIndexes(showcase, "")).toEqual([]);
  });
});

describe("filters and facets", () => {
  const days = scheduleDays(production);

  it("filters by day, picks, types (any of) and query together", () => {
    expect(ids(filterEntries(production, f({ day: "2026-10-01" })))).toEqual([
      PATRICK_OH,
      "science-and-practice-of-pitching",
      RISHAB_OH,
      "entrepreneurial-impact-launching-from-illinois",
      TECHRISE,
    ]);
    expect(ids(filterEntries(production, f({ day: "2026-09-30" })))).toEqual([
      "founders-week-kickoff-reception",
      HAPPY_HOUR,
      FAILURE_LAB,
    ]);
    expect(ids(filterEntries(production, f({ view: "picks" })))).toEqual([
      DAN,
      PANEL,
      HAPPY_HOUR,
      FAILURE_LAB,
      PATRICK_OH,
      RISHAB_OH,
      ARNAV_OH,
      SHOWCASE,
    ]);
    expect(ids(filterEntries(production, f({ types: ["office-hours"] })))).toEqual([PATRICK_OH, RISHAB_OH, ARNAV_OH]);
    expect(ids(filterEntries(production, f({ day: "2026-10-01", types: ["office-hours"] })))).toEqual([
      PATRICK_OH,
      RISHAB_OH,
    ]);
    expect(ids(filterEntries(production, f({ day: "2026-10-02", types: ["office-hours"] })))).toEqual([ARNAV_OH]);
    expect(ids(filterEntries(production, f({ types: ["office-hours"], q: "Auvi" })))).toEqual([RISHAB_OH]);
    expect(ids(filterEntries(production, f({ types: ["social"], view: "picks" })))).toEqual([HAPPY_HOUR]);
    expect(ids(filterEntries(production, f({ types: ["panel"], q: "Kennedy" })))).toEqual([PANEL]);
    expect(ids(filterEntries(production, f({ day: "2026-10-02", q: "Isbell" })))).toEqual([SHOWCASE]);
  });

  it("counts every facet under the other active filters", () => {
    const facets = typeFacets(production, f());
    // Office hours lead, then the core types, then the other types present in content.
    expect(facets.map((x) => [x.type, x.count])).toEqual([
      ["office-hours", 3],
      ["talk", 2],
      ["panel", 7],
      ["networking", 6],
      ["pitch", 2],
      ["social", 5],
    ]);

    const panels = dayCounts(production, days, f({ types: ["panel"] }));
    expect(panels.all).toBe(7);
    expect(panels.byDay).toEqual({
      "2026-09-28": 0,
      "2026-09-29": 1,
      "2026-09-30": 1,
      "2026-10-01": 3,
      "2026-10-02": 2,
      "2026-10-03": 0,
    });

    expect(filterEntries(production, f({ view: "picks" }))).toHaveLength(8);
    expect(filterEntries(production, f({ day: "2026-09-30", view: "picks" }))).toHaveLength(2);
    expect(filterEntries(production, f({ day: "2026-10-01", view: "picks" }))).toHaveLength(2);
    expect(filterEntries(production, f({ day: "2026-10-02", view: "picks" }))).toHaveLength(2);
    const all = dayCounts(production, days, f());
    expect(all.all).toBe(15);
    expect(all.byDay).toEqual({
      "2026-09-28": 1,
      "2026-09-29": 1,
      "2026-09-30": 3,
      "2026-10-01": 5,
      "2026-10-02": 3,
      "2026-10-03": 2,
    });

    const officeHours = dayCounts(production, days, f({ types: ["office-hours"] }));
    expect(officeHours.all).toBe(3);
    expect(officeHours.byDay).toEqual({
      "2026-09-28": 0,
      "2026-09-29": 0,
      "2026-09-30": 0,
      "2026-10-01": 2,
      "2026-10-02": 1,
      "2026-10-03": 0,
    });

    // Facet counts follow the other filters: Thursday has two office-hours windows (Patrick, Rishab).
    expect(typeFacets(production, f({ day: "2026-10-01" })).map((x) => [x.type, x.count])).toEqual([
      ["office-hours", 2],
      ["talk", 0],
      ["panel", 3],
      ["networking", 2],
      ["pitch", 1],
      ["social", 0],
    ]);
  });

  it("explains empty results with one-filter-at-a-time relaxations", () => {
    const filters = f({ day: "2026-09-28", types: ["panel"] });
    expect(filterEntries(production, filters)).toHaveLength(0);
    const r = relaxations(production, filters);
    expect(r.map((x) => [x.dimension, x.count])).toEqual([
      ["day", 7],
      ["types", 1],
    ]);
    const search = relaxations(production, f({ q: "zzz" }));
    expect(search).toEqual([{ dimension: "q", count: 15, filters: f() }]);
    // No office hours on Saturday: clearing the day brings back all three windows.
    const saturday = f({ day: "2026-10-03", types: ["office-hours"] });
    expect(filterEntries(production, saturday)).toHaveLength(0);
    expect(relaxations(production, saturday).map((x) => [x.dimension, x.count])).toEqual([
      ["day", 3],
      ["types", 2],
    ]);
    // Rishab only has Thursday office hours: a Friday search for him finds the Showcase alone.
    expect(ids(filterEntries(production, f({ day: "2026-10-02", q: "rishab" })))).toEqual([SHOWCASE]);
    const friday = f({ day: "2026-10-02", types: ["office-hours"], q: "rishab" });
    expect(relaxations(production, friday).map((x) => [x.dimension, x.count])).toEqual([
      ["day", 1],
      ["types", 1],
      ["q", 1],
    ]);
  });
});

describe("overlaps", () => {
  it("the production calendar's clashes: Wednesday evening, and Rishab's Thursday window over two program blocks", () => {
    for (const group of groupByDay(production)) {
      const blocks = agendaBlocks(group.entries);
      if (group.date === "2026-09-30" || group.date === "2026-10-01") {
        expect(blocks.filter((b) => b.kind !== "single"), group.date).toHaveLength(1);
      } else {
        expect(blocks.every((b) => b.kind === "single"), group.date).toBe(true);
      }
    }
    expect(entriesOverlap(byId(HAPPY_HOUR), byId(FAILURE_LAB))).toBe(true);
    // Back-to-back blocks (Thu 3–5 PM, then 5–7 PM) are not overlaps.
    expect(entriesOverlap(byId("entrepreneurial-impact-launching-from-illinois"), byId(TECHRISE))).toBe(false);
    // Nor are Wednesday's kickoff reception (3:30–5 PM) and Arnav's happy hour (5–7 PM).
    expect(entriesOverlap(byId("founders-week-kickoff-reception"), byId(HAPPY_HOUR))).toBe(false);
    expect(ids(overlapsFor(byId(HAPPY_HOUR), production))).toEqual([FAILURE_LAB]);
    // Rishab's Thursday window (noon–5 PM) runs through the pitching workshop (11:45 AM–2:15 PM)
    // and Entrepreneurial Impact (3–5 PM). Patrick's window ends at 11:30 AM, and TechRise starts
    // as Rishab's window ends (5 PM): neither is an overlap.
    const IMPACT = "entrepreneurial-impact-launching-from-illinois";
    const PITCHING = "science-and-practice-of-pitching";
    expect(ids(overlapsFor(byId(RISHAB_OH), production))).toEqual([PITCHING, IMPACT]);
    expect(entriesOverlap(byId(RISHAB_OH), byId(PATRICK_OH))).toBe(false);
    expect(entriesOverlap(byId(RISHAB_OH), byId(TECHRISE))).toBe(false);
    // The two program blocks don't overlap each other: they're linked only through his window.
    expect(entriesOverlap(byId(PITCHING), byId(IMPACT))).toBe(false);
    const thursday = groupByDay(production).find((g) => g.date === "2026-10-01")!;
    const blocks = agendaBlocks(thursday.entries);
    expect(blocks.map((b) => (b.kind === "single" ? b.entry.id : "overlap"))).toEqual([PATRICK_OH, "overlap", TECHRISE]);
    const cluster = blocks[1];
    expect(cluster.kind).toBe("overlap");
    if (cluster.kind !== "overlap") return;
    expect(ids(cluster.entries)).toEqual([PITCHING, RISHAB_OH, IMPACT]);
    // Never more than two at once: his window plus one program block.
    expect(cluster.maxConcurrent).toBe(2);
    expect(cluster.start).toBe("11:45");
    expect(cluster.end).toBe("17:00");
    expect(cluster.overlapsWith).toEqual({
      [PITCHING]: [{ id: RISHAB_OH, title: "Office hours with Rishab Veldur" }],
      [RISHAB_OH]: [
        { id: PITCHING, title: "The Science and Practice of Pitching" },
        { id: IMPACT, title: "Entrepreneurial Impact: Launching From Illinois" },
      ],
      [IMPACT]: [{ id: RISHAB_OH, title: "Office hours with Rishab Veldur" }],
    });
    // Every clash in the calendar, as pairs: Wednesday evening, then Rishab's window twice.
    const pairs = production.flatMap((a) => overlapsFor(a, production).filter((b) => a.id < b.id).map((b) => [a.id, b.id]));
    expect(pairs).toEqual([
      [FAILURE_LAB, HAPPY_HOUR],
      [RISHAB_OH, PITCHING],
      [IMPACT, RISHAB_OH],
    ]);
  });

  it("clusters entries whose exact intervals intersect, in chronological order", () => {
    const day = groupByDay(demo).find((g) => g.date === "2026-10-01")!.entries;
    const blocks = agendaBlocks(day);
    // Every entry appears exactly once, in chronological order.
    expect(blocks.flatMap((b) => (b.kind === "single" ? [b.entry.id] : ids(b.entries)))).toEqual(ids(day));
    const clusters = blocks.filter((b) => b.kind === "overlap");
    const morning = clusters.find((c) => c.kind === "overlap" && c.entries[0].id === PATRICK_OH)!;
    expect(morning.kind === "overlap" && morning.overlapsWith[PATRICK_OH]).toEqual([
      { id: "demo-customer-discovery-workshop", title: "Demo: Customer Discovery Sprint" },
    ]);
  });

  it("ignores canceled, TBA and part-of-day entries", () => {
    const sat = groupByDay(demo).find((g) => g.date === "2026-10-03")!.entries;
    const clusters = agendaBlocks(sat).filter((b) => b.kind === "overlap");
    expect(clusters).toHaveLength(1);
    expect(clusters[0].kind === "overlap" && ids(clusters[0].entries)).toEqual(["demo-pitch-practice", "demo-funding-panel"]);
    // Arnav's window ("Friday morning, before noon") has no exact interval, so it never clusters.
    expect(overlapsFor(byId(ARNAV_OH), production)).toEqual([]);
  });

  it("measures peak concurrency, not cluster size, for chained overlaps", () => {
    const mk = (id: string, start: string, end: string) =>
      eventToEntry({ ...demoEvents[0], id, title: id, time: { kind: "exact", start, end } });
    const chain = [mk("a", "09:00", "10:00"), mk("b", "09:30", "11:00"), mk("c", "10:30", "12:00")];
    const [block] = agendaBlocks(chain);
    expect(block.kind).toBe("overlap");
    if (block.kind !== "overlap") return;
    expect(block.entries).toHaveLength(3);
    expect(block.maxConcurrent).toBe(2);
    expect(block.start).toBe("09:00");
    expect(block.end).toBe("12:00");
    expect(block.overlapsWith.b.map((o) => o.id)).toEqual(["a", "c"]);
  });

  it("finds overlaps for the detail page", () => {
    expect(ids(overlapsFor(byId(PATRICK_OH, demo), demo))).toContain("demo-customer-discovery-workshop");
  });
});

describe("featured placement", () => {
  it("orders priorities: office hours, then Dan Caruso, the Sep 29 panel, Arnav's happy hour and Failure Lab", () => {
    // Office hours share rank 1 and keep chronological order among themselves.
    expect(ids(featuredEntries(production))).toEqual([
      PATRICK_OH,
      RISHAB_OH,
      ARNAV_OH,
      DAN,
      PANEL,
      HAPPY_HOUR,
      FAILURE_LAB,
    ]);
    expect(
      featuredEntries(production)
        .filter((e) => e.kind === "event")
        .map((e) => [e.featuredRank, e.involvement, e.related]),
    ).toEqual([
      [2, "supported", true],
      [3, "cohosted", true],
      [4, "supported", true],
      [5, "hosted", false],
    ]);
  });

  it("keeps the agenda chronological regardless of featured rank", () => {
    const featuredIds = new Set(ids(featuredEntries(production)));
    expect(ids(production.filter((e) => featuredIds.has(e.id)))).toEqual([
      DAN,
      PANEL,
      HAPPY_HOUR,
      FAILURE_LAB,
      PATRICK_OH,
      RISHAB_OH,
      ARNAV_OH,
    ]);
  });

  it("never features a canceled entry", () => {
    const canceled = eventToEntry({ ...events[0], id: "canceled-feature", status: "canceled", featured: { rank: 2 } });
    expect(ids(featuredEntries([...production, canceled]))).not.toContain("canceled-feature");
  });
});

describe("mentor headshots", () => {
  it("maps every public mentor to their approved photo (alt text = their name)", () => {
    const map = mentorHeadshots(publicMentors);
    expect(Object.keys(map)).toEqual([
      "patrick-haddox",
      "arnav-mishra",
      "vikram-lakhwara",
      "elliott-notrica",
      "ron-lewis",
      "rishab-veldur",
    ]);
    expect(map["rishab-veldur"]).toEqual({ src: "/mentors/rishab-veldur.jpg", alt: "Rishab Veldur", width: 800, height: 800 });
    for (const m of publicMentors) expect(map[m.id]).toMatchObject({ src: `/mentors/${m.id}.jpg`, alt: m.name });
    expect(mentorHeadshots([{ id: "no-photo", headshot: null }])).toEqual({});
  });
});

describe("program blocks", () => {
  const showcase = byId(SHOWCASE);
  const techrise = byId(TECHRISE);

  it("identifies blocks and labels their sessions", () => {
    expect(hasProgram(showcase)).toBe(true);
    expect(hasProgram(byId("founders-week-kickoff-reception"))).toBe(false);
    expect(sessionCountLabel(showcase.sessions.length)).toBe("11 sessions");
    expect(sessionCountLabel(1)).toBe("1 session");
    expect(sessionTimeLabel({ start: "11:45", end: "13:00" })).toBe("11:45 AM–1:00 PM");
    expect(sessionTimeLabel(showcase.sessions[7])).toBe("1:55–2:25 PM");
    expect(sessionAnchorId(showcase.sessions[7])).toBe("session-1355");
  });

  it("separates moderators, keeps people notes and quiets logistics", () => {
    const isbell = showcase.sessions[3];
    const split = splitSessionPeople(isbell);
    expect(split.speakers.map((p) => p.name)).toEqual(["Charles Isbell"]);
    expect(split.moderators.map((p) => p.name)).toEqual(["Scott Rose", "Susan Martinis"]);
    expect(sessionPeopleText(isbell)).toBe("Charles Isbell (Chancellor); moderated by Scott Rose and Susan Martinis");
    const cohort = techrise.sessions[2];
    expect(sessionPeopleText(cohort)).toBe("Mehmet Gunal and Elliott Notrica; Additional participants to be announced");
    expect(isLogistics(showcase.sessions[0])).toBe(true);
    expect(isLogistics(cohort)).toBe(false);
    expect(sessionLineText(showcase.sessions[0])).toBe("8:00–8:45 AM: Check-In and Breakfast Networking");
  });

  it("links office-hours mentors who speak, in program order", () => {
    expect(programMentors(showcase)).toEqual([
      {
        mentorId: "rishab-veldur",
        name: "Rishab Veldur",
        sessionTitle: HEALTH_PANEL,
        start: "13:20",
        end: "13:55",
        anchor: "session-1320",
        role: "speaker",
      },
      {
        mentorId: "arnav-mishra",
        name: "Arnav Mishra",
        sessionTitle: "From Idea to Scale: Building Doss, Lessons from an Illini Founder",
        start: "13:55",
        end: "14:25",
        anchor: "session-1355",
        role: "speaker",
      },
      expect.objectContaining({ mentorId: "patrick-haddox", start: "14:40", role: "speaker" }),
      expect.objectContaining({ mentorId: "vikram-lakhwara", start: "14:55", role: "speaker" }),
    ]);
    // Elliott speaks on the TechRise Cohort 2 panel.
    expect(programMentors(techrise)).toEqual([
      {
        mentorId: "elliott-notrica",
        name: "Elliott Notrica",
        sessionTitle: "TechRise × University of Illinois Founders Week Cohort 2: Where Are They Now?",
        start: "18:30",
        end: "18:50",
        anchor: "session-1830",
        role: "speaker",
      },
    ]);
    // A plain event (no program) links its host through speakers, not programMentors.
    expect(programMentors(byId(HAPPY_HOUR))).toEqual([]);
    expect(mentorProfileHref("vikram-lakhwara")).toBe("/office-hours/vikram-lakhwara");
    expect(mentorProfileHref("elliott-notrica")).toBe("/office-hours/elliott-notrica");
    expect(mentorProfileHref("rishab-veldur")).toBe("/office-hours/rishab-veldur");
  });

  it("starts collapsed on All days, open for a single day or a matching search", () => {
    expect(defaultProgramOpen(showcase, { day: null, q: "" })).toBe(false);
    expect(defaultProgramOpen(showcase, { day: "2026-10-02", q: "" })).toBe(true);
    expect(defaultProgramOpen(showcase, { day: null, q: "Isbell" })).toBe(true);
    expect(defaultProgramOpen(showcase, { day: null, q: "Illinois Conference Center" })).toBe(false);
    expect(defaultProgramOpen(byId("founders-week-kickoff-reception"), { day: "2026-09-30", q: "" })).toBe(false);
  });
});

describe("shareable URLs", () => {
  const days = scheduleDays(production);

  it("round-trips filters through the query string", () => {
    const cases: ScheduleFilters[] = [
      f(),
      f({ day: "2026-09-29" }),
      f({ view: "picks" }),
      f({ types: ["panel", "office-hours"] }),
      f({ day: "2026-10-02", view: "picks", types: ["talk"], q: "charles isbell" }),
    ];
    for (const c of cases) {
      expect(parseScheduleFilters(new URLSearchParams(scheduleQuery(c)), days)).toEqual(c);
    }
    expect(scheduleHref(f())).toBe("/schedule");
    expect(scheduleHref(f({ day: "2026-10-01", view: "picks" }))).toBe("/schedule?day=2026-10-01&view=picks");
  });

  it("drops invalid values from shared links", () => {
    const parsed = parseScheduleFilters({ day: "2026-12-25", view: "nope", type: "talk,bogus" }, days);
    expect(parsed).toEqual(f({ types: ["talk"] }));
  });
});

describe("display helpers", () => {
  it("formats the agenda's time column for exact, part-of-day and forthcoming times", () => {
    expect(agendaTime(byId(PATRICK_OH))).toEqual({ main: "10:00 AM", sub: "to 11:30 AM", start: "10:00", end: "11:30" });
    expect(agendaTime(byId(ARNAV_OH))).toEqual({ main: "Morning", sub: "before noon", start: null, end: null });
    // Dan Caruso: a 4 p.m. start and no announced end — no end time is invented.
    expect(agendaTime(byId(DAN))).toEqual({ main: "4:00 PM", sub: null, start: "16:00", end: null });
    expect(agendaTime(byId("tailgate-and-enterpriseworks-tour"))).toEqual({
      main: "Time to be announced",
      sub: null,
      start: null,
      end: null,
    });
    expect(entryStartText(byId(PANEL))).toEqual({ text: "6:00 PM", dateTime: "18:00" });
    expect(entryTimeText(byId(DAN))).toBe("4:00 PM CT");
    expect(entryTimeText(byId(PANEL))).toBe("6:00–8:00 PM CT");
    expect(entryTimeText(byId("tailgate-and-enterpriseworks-tour"))).toBe("Time to be announced");
    // Rishab's window reads like Patrick's.
    expect(agendaTime(byId(RISHAB_OH))).toEqual({ main: "12:00 PM", sub: "to 5:00 PM", start: "12:00", end: "17:00" });
    expect(entryStartText(byId(RISHAB_OH))).toEqual({ text: "12:00 PM", dateTime: "12:00" });
    expect(entryTimeText(byId(RISHAB_OH))).toBe("12:00–5:00 PM CT");
    expect(entryTimeText(byId(PATRICK_OH))).toBe("10:00–11:30 AM CT");
    expect(locationSummary(byId(RISHAB_OH).location)).toBe("Location to be announced");
    // A date-only window (a future mentor's): the time is still to be announced (nothing is invented).
    const dateOnly = byId(FIXTURE_OH, withDateOnly);
    expect(agendaTime(dateOnly)).toEqual({ main: "Time to be announced", sub: null, start: null, end: null });
    expect(entryStartText(dateOnly)).toEqual({ text: "Time to be announced", dateTime: null });
    expect(entryTimeText(dateOnly)).toBe("Time to be announced");
    expect(locationSummary(dateOnly.location)).toBe("Location to be announced");
  });

  it("summarizes locations honestly", () => {
    expect(locationSummary(byId(PANEL).location)).toBe("Materials Science and Engineering Building · Room 100");
    expect(locationSummary(byId(DAN).location)).toBe("Beckman Institute · Auditorium (Room 1025)");
    expect(locationLines(byId(DAN).location)).toEqual([
      "Beckman Institute",
      "Auditorium (Room 1025)",
      "405 N. Mathews Ave., Urbana, IL 61801",
    ]);
    expect(locationLines(byId(HAPPY_HOUR).location)).toEqual(["Legends", "6th & Green"]);
    expect(locationSummary(byId(PATRICK_OH).location)).toBe("Location to be announced");
    expect(locationSummary({ kind: "virtual", platform: "Zoom" })).toBe("Virtual · Zoom");
  });

  it("introduces the calendar with the official dates and when related events begin", () => {
    const days = scheduleDays(production);
    expect(calendarIntro(site.week.name, site.week.dates, days[0])).toBe(
      "Founders Week runs Sept 30 – Oct 3, and related events begin Sept 28. All times Central Time.",
    );
    expect(calendarIntro("Founders Week", { start: "2026-09-30", end: "2026-10-03" }, "2026-09-30")).toBe(
      "Founders Week runs Sept 30 – Oct 3. All times Central Time.",
    );
    expect(calendarIntro("Founders Week", null, "2026-09-28")).toBe("The Founders Week calendar. All times Central Time.");
    expect(apMonthDay("2026-08-04")).toBe("Aug 4");
    expect(apMonthDay("2026-06-01")).toBe("June 1");
  });
});

describe("pending mentors", () => {
  it("lists scheduling-in-progress mentors with public fields and an application link", () => {
    const list = pendingMentors(publicMentors);
    // Rishab has a published window (Thu Oct 1, noon to 5 PM), so he isn't "Scheduling in progress".
    expect(list.map((m) => m.id)).toEqual(["vikram-lakhwara", "elliott-notrica", "ron-lewis"]);
    const [vik, elliott, ron] = list;
    expect(ron).toMatchObject({
      affiliation: "Co-Founder, Auctus Advisory",
      ctaLabel: "Express interest",
      href: "/office-hours?mentor=ron-lewis#apply",
    });
    expect(elliott).toMatchObject({
      name: "Elliott Notrica",
      firstName: "Elliott",
      affiliation: "Founder & CEO, Symbio Bioculinary",
      ctaLabel: "Express interest",
      href: "/office-hours?mentor=elliott-notrica#apply",
      headshot: { src: "/mentors/elliott-notrica.jpg", alt: "Elliott Notrica" },
    });
    expect(vik.affiliation).toBe("Founder & Managing Member, Stakehouse");
    expect(JSON.stringify(list)).not.toMatch(/Wednesday|commitments|Revenue strategy|much more available/i);
    expect(pendingMentorMatches(ron, "auctus")).toBe(true);
    expect(pendingMentorMatches(vik, "stakehouse")).toBe(true);
    expect(pendingMentorMatches(vik, "managing member")).toBe(true);
    expect(pendingMentorMatches(vik, "aerospace")).toBe(false);
    expect(pendingMentorMatches(elliott, "symbio")).toBe(true);
    expect(pendingMentorMatches(elliott, "notrica")).toBe(true);
  });
});
