import { describe, expect, it } from "vitest";
import { demoEvents, demoMentors } from "@/content/demo";
import { events } from "@/content/events";
import { mentors } from "@/content/mentors";
import { site } from "@/content/site";
import type { Mentor, ScheduleEvent } from "@/content/types";
import {
  buildScheduleEntries,
  eventToEntry,
  featuredEntries,
  officeHoursToEntries,
  scheduleDays,
} from "@/lib/schedule/entries";
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
import { sessionRuleText } from "@/lib/schedule/sessions";
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

/**
 * A synthetic mentor whose only window is part of a day ("Friday morning, before noon"), like
 * Arnav's until it became 10:00–11:30 AM on Sept 24. No real mentor has one now.
 */
const PART_OF_DAY_MENTOR: Mentor = {
  ...DATE_ONLY_MENTOR,
  id: "fixture-morning",
  name: "Fixture Morning",
  firstName: "Morning",
  session: { ...DATE_ONLY_MENTOR.session, note: undefined },
  availability: [
    { id: "fixture-morning-2026-10-02-am", date: "2026-10-02", time: { kind: "part-of-day", part: "morning", before: "12:00" } },
  ],
};
const MORNING_OH = "office-hours-fixture-morning-2026-10-02-am";
const withMorning = buildScheduleEntries({ events, mentors: [...publicMentors, PART_OF_DAY_MENTOR], site });

const DAN = "dan-caruso-fireside-chat";
const PANEL = "how-to-make-10k-a-month-in-college";
const SHOWCASE = "founders-showcase-day-sessions";
const PATRICK_OH = "office-hours-patrick-haddox-2026-10-01-am";
const ARNAV_OH = "office-hours-arnav-mishra-2026-10-02-am";
const RISHAB_OH = "office-hours-rishab-veldur-2026-10-01";
const RON_OH = "office-hours-ron-lewis-2026-10-01-pm";
const ELLIOTT_WED_AM_OH = "office-hours-elliott-notrica-2026-09-30-am";
const ELLIOTT_WED_PM_OH = "office-hours-elliott-notrica-2026-09-30-pm";
const ELLIOTT_THU_OH = "office-hours-elliott-notrica-2026-10-01-pm";
const KICKOFF = "founders-week-kickoff-reception";
const HEALTH_PANEL = "Health Innovation: From Therapeutics to Devices";
const HAPPY_HOUR = "happy-hour-at-legends-with-arnav-mishra";
const FAILURE_LAB = "founder-failure-lab";
const HAPPY_HOUR_TITLE = "Happy Hour with Arnav Mishra at Legends";
const TECHRISE = "techrise-pitch-competition";
const IMPACT = "entrepreneurial-impact-launching-from-illinois";
/** Arnav's Siebel School Speaker Series talk (Wed Sep 30): the listing gives a 3:30 PM start and no end. */
const SIEBEL_TALK = "building-an-ai-native-company";
const SIEBEL_TALK_TITLE = "Building an AI-Native Company: Databases, Distributed Systems, and Other Founder Stories";
const SIEBEL_CALENDAR = "https://calendars.illinois.edu/detail/7046?eventId=33563773";
const ARNAV_VENUE = "Atrium, Siebel Center for Computer Science";
const ARNAV_ADDRESS = "201 N. Goodwin Ave., Urbana, IL 61801";

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
      // Elliott's two Wednesday windows (9 AM–noon, 2–5 PM) start before the 3:30 PM kickoff reception.
      ELLIOTT_WED_AM_OH,
      ELLIOTT_WED_PM_OH,
      KICKOFF,
      // Arnav's Siebel talk also starts at 3:30 PM: the tie keeps content order (the kickoff
      // reception is listed first).
      SIEBEL_TALK,
      // Arnav's happy hour starts as the kickoff reception ends (5:00 PM).
      HAPPY_HOUR,
      FAILURE_LAB,
      PATRICK_OH,
      "science-and-practice-of-pitching",
      // Elliott's and Rishab's Thursday windows (both noon–5 PM) sort by their start, after the
      // 11:45 AM workshop; the tie keeps content order (Elliott is listed before Rishab).
      ELLIOTT_THU_OH,
      RISHAB_OH,
      // Ron's Thursday window (2:30–4:30 PM) starts before Entrepreneurial Impact (3:00 PM).
      RON_OH,
      IMPACT,
      "techrise-pitch-competition",
      // Arnav's Friday window (10:00–11:30 AM) starts after the Showcase opens (8:00 AM).
      SHOWCASE,
      ARNAV_OH,
      "founders-evening-showcase-and-reception",
      // Both Saturday items have no time yet: they keep the agenda order (tailgate first).
      "tailgate-and-enterpriseworks-tour",
      "illinois-football-vs-purdue",
    ]);
    expect(production).toHaveLength(20);
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

  it("lists Arnav's Siebel School talk as a related talk with a 3:30 PM start only, no Founders label and no calendar export", () => {
    const talk = byId(SIEBEL_TALK);
    expect(talk).toMatchObject({
      kind: "event",
      title: SIEBEL_TALK_TITLE,
      date: "2026-09-30",
      status: "confirmed",
      statusNote: null,
      types: ["talk"],
      // A Siebel School Speaker Series talk: nothing ties it to Founders or the Founders Week program.
      involvement: null,
      related: true,
      foundersPick: false,
      featuredRank: null,
      organizer: "Siebel School of Computing and Data Science",
      location: {
        kind: "in-person",
        venue: "Siebel Center for Computer Science",
        room: "Room 2405",
        address: "201 N. Goodwin Ave., Urbana, IL 61801",
      },
      summary:
        "A Siebel School Speaker Series talk by Arnav Mishra, co-founder and CTO of Doss, on the engineering behind an AI-native company.",
      registration: null,
      links: [{ label: "Event information", url: SIEBEL_CALENDAR }],
      sessions: [],
      callout: null,
      sessionRule: null,
      mentor: null,
      sortMinutes: 15 * 60 + 30,
    });
    // The Siebel School listing (and its calendar file) gives a start and no end: none is invented,
    // so there is no interval and no calendar export yet.
    expect(talk.time).toEqual({ kind: "exact", start: "15:30" });
    expect(talk.startsAt).toBeNull();
    expect(talk.endsAt).toBeNull();
    expect(talk.calendar).toEqual({ available: false, reason: "Calendar export opens once an end time is announced." });
    // The description doesn't restate the time; the When line and the calendar note cover it.
    expect(talk.description).not.toMatch(/\d{1,2}:\d\d/);
    // Arnav is the speaker, linked to his office-hours profile.
    expect(talk.speakers).toEqual([
      { name: "Arnav Mishra", title: "Co-Founder & CTO, Doss", verified: true, mentorId: "arnav-mishra" },
    ]);
    // Displayed text never implies Founders runs or supports it, and uses plain punctuation.
    const shown = [talk.title, talk.summary, talk.description, talk.organizer].join(" ");
    expect(shown).not.toMatch(/Founders/);
    expect(shown).not.toContain("—");
  });

  it("lists every Arnav appearance in date order: Siebel talk, happy hour host, Impact panelist, Showcase speaker, office hours", () => {
    const arnav = production.filter(
      (e) =>
        e.mentor?.id === "arnav-mishra" ||
        e.speakers.some((s) => s.mentorId === "arnav-mishra") ||
        e.sessions.some((s) => s.people.some((p) => p.mentorId === "arnav-mishra")),
    );
    expect(arnav.map((e) => [e.id, e.date])).toEqual([
      [SIEBEL_TALK, "2026-09-30"],
      [HAPPY_HOUR, "2026-09-30"],
      [IMPACT, "2026-10-01"],
      [SHOWCASE, "2026-10-02"],
      [ARNAV_OH, "2026-10-02"],
    ]);
    const role = (id: string) => byId(id).speakers.find((s) => s.mentorId === "arnav-mishra")?.role ?? "speaker";
    expect([SIEBEL_TALK, HAPPY_HOUR, IMPACT].map(role)).toEqual(["speaker", "host", "speaker"]);
    // Entrepreneurial Impact (Thu Oct 1, 3–5 PM, Beckman Institute) now names him as a panelist; no
    // other panelists were supplied.
    expect(byId(IMPACT)).toMatchObject({
      time: { kind: "exact", start: "15:00", end: "17:00" },
      involvement: "week",
      related: false,
      location: { kind: "in-person", venue: "Beckman Institute", address: "Urbana" },
      summary: "A panel discussion and networking at the Beckman Institute. Arnav Mishra of Doss is on the panel.",
      calendar: { available: true },
    });
    expect(byId(IMPACT).speakers).toEqual([
      { name: "Arnav Mishra", title: "Co-Founder & CTO, Doss", verified: true, mentorId: "arnav-mishra" },
    ]);
    expect(byId(IMPACT).description).toBe(
      "A panel discussion on launching from Illinois at the Beckman Institute in Urbana, followed by networking.\n\n" +
        "Arnav Mishra, co-founder and CTO of Doss and one of this week’s office-hours mentors, is on the panel.",
    );
  });

  it("lists Arnav's office hours once, on Fri Oct 2, 10:00–11:30 AM in the Siebel Center atrium, confirmed", () => {
    const mine = production.filter((e) => e.mentor?.id === "arnav-mishra");
    expect(ids(mine)).toEqual([ARNAV_OH]);
    expect(byId(ARNAV_OH)).toEqual({
      id: ARNAV_OH,
      kind: "office-hours",
      title: "Office hours with Arnav Mishra",
      date: "2026-10-02",
      time: { kind: "exact", start: "10:00", end: "11:30" },
      timeLabel: null,
      // Time and place are confirmed (the place from Arnav, Sept 25), so there's no status note.
      status: "confirmed",
      statusNote: null,
      types: ["office-hours"],
      involvement: "hosted",
      foundersPick: true,
      organizer: "Founders – Illinois Entrepreneurs",
      location: { kind: "in-person", venue: ARNAV_VENUE, address: ARNAV_ADDRESS },
      summary: "By application. Meet Arnav of Doss during Founders Week. Appointments are limited.",
      // His window note already says it isn't a booked appointment, so that line isn't repeated.
      description:
        "Arnav Mishra (Co-Founder & CTO, Doss) is available for office hours: Friday, October 2, 10:00–11:30 AM CT.\n\n" +
        "Arnav is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.\n\n" +
        "Each session is 25 minutes, with a 5-minute break between sessions. " +
        "Appointments are limited. Founders will match applicants by interests and availability, then email selected students to confirm.",
      speakers: [],
      topics: [],
      registration: {
        url: "/office-hours?mentor=arnav-mishra&window=arnav-mishra-2026-10-02-am#apply",
        label: "Apply to meet Arnav",
        internal: true,
      },
      links: [],
      sessions: [],
      featuredRank: 1,
      related: false,
      callout: null,
      sessionRule: "Each session is 25 minutes, with a 5-minute break between sessions.",
      sources: mentors.find((m) => m.id === "arnav-mishra")!.sources,
      mentor: {
        id: "arnav-mishra",
        name: "Arnav Mishra",
        firstName: "Arnav",
        role: "Co-Founder & CTO",
        company: "Doss",
        windowId: "arnav-mishra-2026-10-02-am",
      },
      demo: false,
      sortMinutes: 10 * 60,
      // 10:00 and 11:30 AM CDT (UTC−5).
      startsAt: "2026-10-02T15:00:00.000Z",
      endsAt: "2026-10-02T16:30:00.000Z",
      // Confirmed, and still never exported: selected students get their time by email.
      calendar: {
        available: false,
        reason: "Office hours are by application. Selected students get their confirmed time by email.",
      },
    });
    const text = JSON.stringify({ ...byId(ARNAV_OH), sources: [] });
    expect(text).not.toMatch(/to be confirmed|to be announced|still setting the location|Scheduling in progress|Express interest/i);
  });

  it("only creates office-hours entries for mentors with published windows", () => {
    expect(production.filter((e) => e.kind === "office-hours").map((e) => e.mentor!.id)).toEqual([
      "elliott-notrica",
      "elliott-notrica",
      "patrick-haddox",
      "elliott-notrica",
      "rishab-veldur",
      "ron-lewis",
      "arnav-mishra",
    ]);
    // Vik is "Scheduling in progress": no schedule entries, no invented windows.
    expect(production.some((e) => e.mentor?.id === "vikram-lakhwara")).toBe(false);
    // Elliott gets one entry per published window, and nothing else.
    expect(ids(production.filter((e) => e.mentor?.id === "elliott-notrica"))).toEqual([
      ELLIOTT_WED_AM_OH,
      ELLIOTT_WED_PM_OH,
      ELLIOTT_THU_OH,
    ]);
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
      // A window, not a confirmed session: the location is still being set.
      status: "planned",
      statusNote:
        "Rishab is holding office hours on Thursday, October 1, anytime from noon to 5 PM. We’re still setting the location.",
      types: ["office-hours"],
      involvement: "hosted",
      foundersPick: true,
      organizer: "Founders – Illinois Entrepreneurs",
      location: { kind: "tba", note: "Location is shared with selected students once confirmed." },
      summary: "By application. Meet Rishab of Auvi Labs during Founders Week. Appointments are limited.",
      // His note already says it isn't a booked appointment, so that line isn't repeated. The
      // session rule comes from site.officeHours.
      description:
        "Rishab Veldur (Co-Founder & CEO, Auvi Labs) is available for office hours: Thursday, October 1, 12:00–5:00 PM CT.\n\n" +
        "Rishab is free anytime during this window, from noon to 5 PM, but it isn’t a booked appointment. We’ll schedule sessions inside it.\n\n" +
        "Each session is 25 minutes, with a 5-minute break between sessions. " +
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
      sessionRule: "Each session is 25 minutes, with a 5-minute break between sessions.",
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

  it("lists Ron's office hours once, on Thu Oct 1, 2:30–4:30 PM at BIF, confirmed", () => {
    const mine = production.filter((e) => e.mentor?.id === "ron-lewis");
    expect(ids(mine)).toEqual([RON_OH]);
    expect(byId(RON_OH)).toEqual({
      id: RON_OH,
      kind: "office-hours",
      title: "Office hours with Ron Lewis",
      date: "2026-10-01",
      time: { kind: "exact", start: "14:30", end: "16:30" },
      timeLabel: null,
      // Time and place are confirmed, so there's no status note.
      status: "confirmed",
      statusNote: null,
      types: ["office-hours"],
      involvement: "hosted",
      foundersPick: true,
      organizer: "Founders – Illinois Entrepreneurs",
      location: {
        kind: "in-person",
        venue: "Business Instructional Facility (BIF)",
        address: "515 E. Gregory Drive, Champaign, IL 61820",
      },
      summary: "By application. Meet Ron of Auctus Advisory during Founders Week. Appointments are limited.",
      // His window note already says it isn't a booked appointment, so that line isn't repeated.
      description:
        "Ron Lewis (Co-Founder, Auctus Advisory) is available for office hours: Thursday, October 1, 2:30–4:30 PM CT.\n\n" +
        "Ron is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.\n\n" +
        "Each session is 25 minutes, with a 5-minute break between sessions. " +
        "Appointments are limited. Founders will match applicants by interests and availability, then email selected students to confirm.",
      speakers: [],
      // His suggested topics are still a draft: never public.
      topics: [],
      registration: {
        url: "/office-hours?mentor=ron-lewis&window=ron-lewis-2026-10-01-pm#apply",
        label: "Apply to meet Ron",
        internal: true,
      },
      links: [],
      sessions: [],
      featuredRank: 1,
      related: false,
      callout: null,
      sessionRule: "Each session is 25 minutes, with a 5-minute break between sessions.",
      sources: mentors.find((m) => m.id === "ron-lewis")!.sources,
      mentor: {
        id: "ron-lewis",
        name: "Ron Lewis",
        firstName: "Ron",
        role: "Co-Founder",
        company: "Auctus Advisory",
        windowId: "ron-lewis-2026-10-01-pm",
      },
      demo: false,
      sortMinutes: 14 * 60 + 30,
      // 2:30 and 4:30 PM CDT (UTC−5).
      startsAt: "2026-10-01T19:30:00.000Z",
      endsAt: "2026-10-01T21:30:00.000Z",
      // Confirmed, and still never exported: selected students get their time by email.
      calendar: {
        available: false,
        reason: "Office hours are by application. Selected students get their confirmed time by email.",
      },
    });
    // His openness to Oct 4 is organizer-only: never in displayed or searchable text.
    const text = JSON.stringify({ ...byId(RON_OH), sources: [] });
    expect(text).not.toMatch(/Oct(ober)?\.? 4\b|Sunday/i);
    expect(text).not.toMatch(/Revenue strategy|Startup financial planning|Communicating business progress/i);
    expect(text).not.toMatch(/to be confirmed|to be announced|Scheduling in progress|Express interest/i);
  });

  it("states the session rule (from site.officeHours) on exact office-hours windows, never a session count", () => {
    const rule = sessionRuleText(site.officeHours);
    expect(rule).toBe("Each session is 25 minutes, with a 5-minute break between sessions.");
    const oh = production.filter((e) => e.kind === "office-hours");
    // Elliott (Wed 9 AM–noon and 2–5 PM, Thu noon–5 PM), Patrick (Thu 10:00–11:30), Rishab (Thu
    // noon–5 PM), Ron (Thu 2:30–4:30 PM) and Arnav (Fri 10:00–11:30) have exact windows.
    expect(oh.map((e) => [e.mentor!.id, e.sessionRule])).toEqual([
      ["elliott-notrica", rule],
      ["elliott-notrica", rule],
      ["patrick-haddox", rule],
      ["elliott-notrica", rule],
      ["rishab-veldur", rule],
      ["ron-lewis", rule],
      ["arnav-mishra", rule],
    ]);
    // A part-of-day window (fixture) has no sessions yet, so no rule.
    expect(byId(MORNING_OH, withMorning).sessionRule).toBeNull();
    expect(byId(MORNING_OH, withMorning).description).not.toContain("Each session is");
    for (const e of oh) {
      // Said once in the entry's description, and only when it applies.
      expect(e.description.split(rule).length - 1, e.id).toBe(e.sessionRule ? 1 : 0);
      // Never how many sessions fit or are offered (Patrick's window fits three; the count is never published).
      expect(`${e.description} ${e.summary} ${e.sessionRule ?? ""}`, e.id).not.toMatch(
        /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten) sessions\b/i,
      );
    }
    // Events never carry it.
    expect(production.filter((e) => e.kind === "event").every((e) => e.sessionRule === null)).toBe(true);

    // The numbers come from the site settings, not the code.
    const patrick = publicMentors.find((m) => m.id === "patrick-haddox")!;
    const [custom] = officeHoursToEntries(patrick, { ...site, officeHours: { sessionMinutes: 20, breakMinutes: 10 } });
    expect(custom.sessionRule).toBe("Each session is 20 minutes, with a 10-minute break between sessions.");
    expect(custom.description).toContain("Each session is 20 minutes, with a 10-minute break between sessions.");
    expect(custom.description).not.toContain("25 minutes");
  });

  it("still sorts a date-only window (a future mentor's) after the day's timed entries, time to be announced", () => {
    const thursday = withDateOnly.filter((e) => e.date === "2026-10-01");
    expect(ids(thursday)).toEqual([
      PATRICK_OH,
      "science-and-practice-of-pitching",
      ELLIOTT_THU_OH,
      RISHAB_OH,
      RON_OH,
      "entrepreneurial-impact-launching-from-illinois",
      TECHRISE,
      FIXTURE_OH,
    ]);
    expect(withDateOnly).toHaveLength(21);
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
    // Elliott's organizer note (what his email offered, the session total) stays organizer-only too.
    expect(text).not.toMatch(/anytime after 9 AM|Organizers set his windows|22 sessions|sessions in all/i);
    // So do Rishab's email details (Oct 2 attendance, preference for student teams, phone number).
    expect(text).not.toMatch(/student teams|eligibility rule|phone number|Oct 1 and 2/i);
    // And Ron's openness to Oct 4.
    expect(text).not.toMatch(/Oct(ober)?\.? 4\b/i);
    // And Arnav's organizer note (where his location and extra listings came from).
    expect(text).not.toMatch(/Location from Arnav|Added to the calendar at his suggestion|now listed on it|Siebel 2405/i);
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
    // Elliott: his three office-hours windows, and the TechRise panel he speaks on.
    expect(find("Elliott Notrica")).toEqual([ELLIOTT_WED_AM_OH, ELLIOTT_WED_PM_OH, ELLIOTT_THU_OH, TECHRISE]);
  });

  it("matches speakers, mentors and companies across events and office hours", () => {
    expect(find("Kennedy")).toEqual([PANEL]);
    // Arnav (and Doss), in date order: his Siebel talk, his happy hour, the Entrepreneurial Impact
    // panel, the Showcase (his 1:55 PM talk) and his Friday office hours.
    expect(find("doss")).toEqual([SIEBEL_TALK, HAPPY_HOUR, IMPACT, SHOWCASE, ARNAV_OH]);
    expect(find("arnav")).toEqual([SIEBEL_TALK, HAPPY_HOUR, IMPACT, SHOWCASE, ARNAV_OH]);
    expect(ids(filterEntries(production, f({ types: ["talk"], q: "arnav" })))).toEqual([SIEBEL_TALK, SHOWCASE]);
    expect(ids(filterEntries(production, f({ types: ["panel"], q: "arnav" })))).toEqual([IMPACT, SHOWCASE]);
    // The Siebel Center: the talk (Room 2405) and Arnav's office hours (the atrium), by venue and
    // street (written "201 N. Goodwin Ave." in both places).
    expect(find("siebel")).toEqual([SIEBEL_TALK, ARNAV_OH]);
    expect(find("goodwin")).toEqual([SIEBEL_TALK, ARNAV_OH]);
    expect(find("atrium")).toEqual([ARNAV_OH]);
    expect(find("room 2405")).toEqual([SIEBEL_TALK]);
    expect(find("siebel school")).toEqual([SIEBEL_TALK]);
    expect(find("distributed systems")).toEqual([SIEBEL_TALK]);
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
    // Ron (and Auctus Advisory): his Thursday office hours at BIF, found by venue and address too.
    expect(find("ron lewis")).toEqual([RON_OH]);
    expect(find("auctus")).toEqual([RON_OH]);
    expect(find("BIF")).toEqual([RON_OH]);
    expect(find("business instructional facility")).toEqual(["science-and-practice-of-pitching", RON_OH]);
    expect(find("515 E. Gregory Drive")).toEqual([RON_OH]);
    // Elliott's company finds his office-hours windows only (the TechRise program names him, not Symbio).
    expect(find("symbio")).toEqual([ELLIOTT_WED_AM_OH, ELLIOTT_WED_PM_OH, ELLIOTT_THU_OH]);
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
      ELLIOTT_THU_OH,
      RISHAB_OH,
      RON_OH,
      "entrepreneurial-impact-launching-from-illinois",
      TECHRISE,
    ]);
    expect(ids(filterEntries(production, f({ day: "2026-09-30" })))).toEqual([
      ELLIOTT_WED_AM_OH,
      ELLIOTT_WED_PM_OH,
      KICKOFF,
      SIEBEL_TALK,
      HAPPY_HOUR,
      FAILURE_LAB,
    ]);
    // Talks: Dan Caruso's fireside chat, Arnav's Siebel talk and the Showcase day program.
    expect(ids(filterEntries(production, f({ types: ["talk"] })))).toEqual([DAN, SIEBEL_TALK, SHOWCASE]);
    expect(ids(filterEntries(production, f({ day: "2026-09-30", types: ["talk"] })))).toEqual([SIEBEL_TALK]);
    // It's a related event, not a Founders pick.
    expect(ids(filterEntries(production, f({ day: "2026-09-30", types: ["talk"], view: "picks" })))).toEqual([]);
    expect(ids(filterEntries(production, f({ view: "picks" })))).toEqual([
      DAN,
      PANEL,
      ELLIOTT_WED_AM_OH,
      ELLIOTT_WED_PM_OH,
      HAPPY_HOUR,
      FAILURE_LAB,
      PATRICK_OH,
      ELLIOTT_THU_OH,
      RISHAB_OH,
      RON_OH,
      SHOWCASE,
      ARNAV_OH,
    ]);
    expect(ids(filterEntries(production, f({ types: ["office-hours"] })))).toEqual([
      ELLIOTT_WED_AM_OH,
      ELLIOTT_WED_PM_OH,
      PATRICK_OH,
      ELLIOTT_THU_OH,
      RISHAB_OH,
      RON_OH,
      ARNAV_OH,
    ]);
    expect(ids(filterEntries(production, f({ day: "2026-09-30", types: ["office-hours"] })))).toEqual([
      ELLIOTT_WED_AM_OH,
      ELLIOTT_WED_PM_OH,
    ]);
    expect(ids(filterEntries(production, f({ day: "2026-10-01", types: ["office-hours"] })))).toEqual([
      PATRICK_OH,
      ELLIOTT_THU_OH,
      RISHAB_OH,
      RON_OH,
    ]);
    expect(ids(filterEntries(production, f({ day: "2026-10-02", types: ["office-hours"] })))).toEqual([ARNAV_OH]);
    expect(ids(filterEntries(production, f({ types: ["office-hours"], q: "Auvi" })))).toEqual([RISHAB_OH]);
    expect(ids(filterEntries(production, f({ day: "2026-10-01", types: ["office-hours"], q: "Symbio" })))).toEqual([
      ELLIOTT_THU_OH,
    ]);
    expect(ids(filterEntries(production, f({ types: ["office-hours"], q: "BIF" })))).toEqual([RON_OH]);
    expect(ids(filterEntries(production, f({ types: ["social"], view: "picks" })))).toEqual([HAPPY_HOUR]);
    expect(ids(filterEntries(production, f({ types: ["panel"], q: "Kennedy" })))).toEqual([PANEL]);
    expect(ids(filterEntries(production, f({ day: "2026-10-02", q: "Isbell" })))).toEqual([SHOWCASE]);
  });

  it("counts every facet under the other active filters", () => {
    const facets = typeFacets(production, f());
    // Office hours lead, then the core types, then the other types present in content.
    expect(facets.map((x) => [x.type, x.count])).toEqual([
      ["office-hours", 7],
      // Dan Caruso, Arnav's Siebel talk and the Showcase day program.
      ["talk", 3],
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

    expect(filterEntries(production, f({ view: "picks" }))).toHaveLength(12);
    expect(filterEntries(production, f({ day: "2026-09-30", view: "picks" }))).toHaveLength(4);
    expect(filterEntries(production, f({ day: "2026-10-01", view: "picks" }))).toHaveLength(4);
    expect(filterEntries(production, f({ day: "2026-10-02", view: "picks" }))).toHaveLength(2);
    const all = dayCounts(production, days, f());
    expect(all.all).toBe(20);
    expect(all.byDay).toEqual({
      "2026-09-28": 1,
      "2026-09-29": 1,
      "2026-09-30": 6,
      "2026-10-01": 7,
      "2026-10-02": 3,
      "2026-10-03": 2,
    });

    const officeHours = dayCounts(production, days, f({ types: ["office-hours"] }));
    expect(officeHours.all).toBe(7);
    expect(officeHours.byDay).toEqual({
      "2026-09-28": 0,
      "2026-09-29": 0,
      "2026-09-30": 2,
      "2026-10-01": 4,
      "2026-10-02": 1,
      "2026-10-03": 0,
    });

    // Facet counts follow the other filters: Thursday has four office-hours windows (Patrick,
    // Elliott, Rishab, Ron), Wednesday two (both Elliott's) and one talk (Arnav's at Siebel).
    expect(typeFacets(production, f({ day: "2026-09-30" })).map((x) => [x.type, x.count])).toEqual([
      ["office-hours", 2],
      ["talk", 1],
      ["panel", 1],
      ["networking", 2],
      ["pitch", 0],
      ["social", 2],
    ]);
    expect(typeFacets(production, f({ day: "2026-10-01" })).map((x) => [x.type, x.count])).toEqual([
      ["office-hours", 4],
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
    expect(search).toEqual([{ dimension: "q", count: 20, filters: f() }]);
    // No office hours on Saturday: clearing the day brings back all seven windows.
    const saturday = f({ day: "2026-10-03", types: ["office-hours"] });
    expect(filterEntries(production, saturday)).toHaveLength(0);
    expect(relaxations(production, saturday).map((x) => [x.dimension, x.count])).toEqual([
      ["day", 7],
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
  it("the production calendar's clashes: Elliott's Wednesday afternoon window with the kickoff reception, Wednesday evening, the Thursday windows with the program blocks, and Arnav's Friday window inside the Showcase", () => {
    // Wednesday has two clusters (Elliott's 2–5 PM window with the kickoff reception, then the
    // happy hour with Failure Lab), with Arnav's start-only Siebel talk on its own between them;
    // Thursday and Friday have one each; other days have none.
    const clusterCounts: Record<string, number> = { "2026-09-30": 2, "2026-10-01": 1, "2026-10-02": 1 };
    for (const group of groupByDay(production)) {
      const blocks = agendaBlocks(group.entries);
      if (group.date in clusterCounts) {
        expect(blocks.filter((b) => b.kind !== "single"), group.date).toHaveLength(clusterCounts[group.date]);
      } else {
        expect(blocks.every((b) => b.kind === "single"), group.date).toBe(true);
      }
    }
    expect(entriesOverlap(byId(HAPPY_HOUR), byId(FAILURE_LAB))).toBe(true);
    // Back-to-back blocks (Thu 3–5 PM, then 5–7 PM) are not overlaps.
    expect(entriesOverlap(byId("entrepreneurial-impact-launching-from-illinois"), byId(TECHRISE))).toBe(false);
    // Nor are Wednesday's kickoff reception (3:30–5 PM) and Arnav's happy hour (5–7 PM).
    expect(entriesOverlap(byId(KICKOFF), byId(HAPPY_HOUR))).toBe(false);
    expect(ids(overlapsFor(byId(HAPPY_HOUR), production))).toEqual([FAILURE_LAB]);

    // Wednesday: Elliott's morning window (9 AM–noon) clashes with nothing. His afternoon window
    // (2–5 PM) runs through the kickoff reception (3:30–5 PM) and ends as the happy hour starts.
    expect(ids(overlapsFor(byId(ELLIOTT_WED_AM_OH), production))).toEqual([]);
    expect(ids(overlapsFor(byId(ELLIOTT_WED_PM_OH), production))).toEqual([KICKOFF]);
    expect(ids(overlapsFor(byId(KICKOFF), production))).toEqual([ELLIOTT_WED_PM_OH]);
    expect(entriesOverlap(byId(ELLIOTT_WED_PM_OH), byId(HAPPY_HOUR))).toBe(false);
    expect(entriesOverlap(byId(ELLIOTT_WED_AM_OH), byId(ELLIOTT_WED_PM_OH))).toBe(false);
    // Arnav's Siebel talk starts at 3:30 PM, inside Elliott's window and as the kickoff reception
    // starts, but its listing gives no end time. Without an interval it never clusters (no end time is
    // invented), so it's listed on its own between the two clusters and clashes with nothing.
    expect(byId(SIEBEL_TALK).endsAt).toBeNull();
    expect(ids(overlapsFor(byId(SIEBEL_TALK), production))).toEqual([]);
    expect(entriesOverlap(byId(SIEBEL_TALK), byId(KICKOFF))).toBe(false);
    expect(entriesOverlap(byId(SIEBEL_TALK), byId(ELLIOTT_WED_PM_OH))).toBe(false);
    const wednesday = agendaBlocks(groupByDay(production).find((g) => g.date === "2026-09-30")!.entries);
    expect(wednesday.map((b) => (b.kind === "single" ? b.entry.id : ids(b.entries)))).toEqual([
      ELLIOTT_WED_AM_OH,
      [ELLIOTT_WED_PM_OH, KICKOFF],
      SIEBEL_TALK,
      [HAPPY_HOUR, FAILURE_LAB],
    ]);
    const afternoon = wednesday[1];
    if (afternoon.kind !== "overlap") throw new Error("expected Wednesday afternoon's cluster");
    expect(afternoon.maxConcurrent).toBe(2);
    expect(afternoon.start).toBe("14:00");
    expect(afternoon.end).toBe("17:00");
    expect(afternoon.overlapsWith).toEqual({
      [ELLIOTT_WED_PM_OH]: [{ id: KICKOFF, title: "Founders Week Kickoff Reception" }],
      [KICKOFF]: [{ id: ELLIOTT_WED_PM_OH, title: "Office hours with Elliott Notrica" }],
    });
    const evening = wednesday[3];
    if (evening.kind !== "overlap") throw new Error("expected Wednesday evening's cluster");
    expect(evening.start).toBe("17:00");
    expect(evening.end).toBe("20:30");

    // Thursday: Elliott's and Rishab's windows (both noon–5 PM) run through the pitching workshop
    // (11:45 AM–2:15 PM), each other, Ron's window (2:30–4:30 PM) and Entrepreneurial Impact
    // (3–5 PM). Patrick's window ends at 11:30 AM, and TechRise starts as their windows end (5 PM):
    // neither is an overlap. (Elliott's TechRise panel, at 6:30 PM, is after his window.)
    const PITCHING = "science-and-practice-of-pitching";
    expect(ids(overlapsFor(byId(RISHAB_OH), production))).toEqual([PITCHING, ELLIOTT_THU_OH, RON_OH, IMPACT]);
    expect(ids(overlapsFor(byId(ELLIOTT_THU_OH), production))).toEqual([PITCHING, RISHAB_OH, RON_OH, IMPACT]);
    for (const id of [RISHAB_OH, ELLIOTT_THU_OH]) {
      expect(entriesOverlap(byId(id), byId(PATRICK_OH)), id).toBe(false);
      expect(entriesOverlap(byId(id), byId(TECHRISE)), id).toBe(false);
    }
    // Ron's window overlaps Elliott's, Rishab's and Entrepreneurial Impact (3–5 PM). The pitching
    // workshop ends (2:15 PM) before it starts, and it ends (4:30 PM) before TechRise (5 PM).
    expect(ids(overlapsFor(byId(RON_OH), production))).toEqual([ELLIOTT_THU_OH, RISHAB_OH, IMPACT]);
    expect(entriesOverlap(byId(RON_OH), byId(PITCHING))).toBe(false);
    expect(entriesOverlap(byId(RON_OH), byId(TECHRISE))).toBe(false);
    // The two program blocks don't overlap each other: they're linked only through the windows.
    expect(entriesOverlap(byId(PITCHING), byId(IMPACT))).toBe(false);
    const thursday = groupByDay(production).find((g) => g.date === "2026-10-01")!;
    const blocks = agendaBlocks(thursday.entries);
    expect(blocks.map((b) => (b.kind === "single" ? b.entry.id : "overlap"))).toEqual([PATRICK_OH, "overlap", TECHRISE]);
    const cluster = blocks[1];
    expect(cluster.kind).toBe("overlap");
    if (cluster.kind !== "overlap") return;
    expect(ids(cluster.entries)).toEqual([PITCHING, ELLIOTT_THU_OH, RISHAB_OH, RON_OH, IMPACT]);
    // At most four at once: from 3:00 to 4:30 PM, Elliott's, Rishab's and Ron's windows and
    // Entrepreneurial Impact.
    expect(cluster.maxConcurrent).toBe(4);
    expect(cluster.start).toBe("11:45");
    expect(cluster.end).toBe("17:00");
    const elliottThu = { id: ELLIOTT_THU_OH, title: "Office hours with Elliott Notrica" };
    const rishab = { id: RISHAB_OH, title: "Office hours with Rishab Veldur" };
    const ron = { id: RON_OH, title: "Office hours with Ron Lewis" };
    const pitching = { id: PITCHING, title: "The Science and Practice of Pitching" };
    const impact = { id: IMPACT, title: "Entrepreneurial Impact: Launching From Illinois" };
    expect(cluster.overlapsWith).toEqual({
      [PITCHING]: [elliottThu, rishab],
      [ELLIOTT_THU_OH]: [pitching, rishab, ron, impact],
      [RISHAB_OH]: [pitching, elliottThu, ron, impact],
      [RON_OH]: [elliottThu, rishab, impact],
      [IMPACT]: [elliottThu, rishab, ron],
    });
    // Arnav's Friday window (10:00–11:30 AM) sits inside the Showcase day program (8:00 AM–5:30 PM).
    // His own Showcase talk (1:55 PM) comes after his window, and the evening reception (6 PM)
    // starts after the day program ends.
    expect(ids(overlapsFor(byId(ARNAV_OH), production))).toEqual([SHOWCASE]);
    const arnavTalk = byId(SHOWCASE).sessions.find((s) => s.people.some((p) => p.mentorId === "arnav-mishra"))!;
    expect(arnavTalk.start).toBe("13:55");
    expect(entriesOverlap(byId(ARNAV_OH), byId("founders-evening-showcase-and-reception"))).toBe(false);
    const friday = agendaBlocks(groupByDay(production).find((g) => g.date === "2026-10-02")!.entries);
    expect(friday.map((b) => (b.kind === "single" ? b.entry.id : "overlap"))).toEqual([
      "overlap",
      "founders-evening-showcase-and-reception",
    ]);
    const showcase = friday[0];
    if (showcase.kind !== "overlap") throw new Error("expected Friday's Showcase cluster");
    expect(ids(showcase.entries)).toEqual([SHOWCASE, ARNAV_OH]);
    expect(showcase.maxConcurrent).toBe(2);
    expect(showcase.start).toBe("08:00");
    expect(showcase.end).toBe("17:30");
    expect(showcase.overlapsWith).toEqual({
      [SHOWCASE]: [{ id: ARNAV_OH, title: "Office hours with Arnav Mishra" }],
      [ARNAV_OH]: [{ id: SHOWCASE, title: "Founders Showcase Day Sessions" }],
    });
    // Every clash in the calendar, as pairs (in agenda order of the earlier id): Elliott's Wednesday
    // afternoon window with the kickoff reception, Wednesday evening, Elliott's Thursday window
    // three times, Rishab's twice, Entrepreneurial Impact with the three Thursday windows, then
    // Arnav's.
    const pairs = production.flatMap((a) => overlapsFor(a, production).filter((b) => a.id < b.id).map((b) => [a.id, b.id]));
    expect(pairs).toEqual([
      [KICKOFF, ELLIOTT_WED_PM_OH],
      [FAILURE_LAB, HAPPY_HOUR],
      [ELLIOTT_THU_OH, PITCHING],
      [ELLIOTT_THU_OH, RISHAB_OH],
      [ELLIOTT_THU_OH, RON_OH],
      [RISHAB_OH, PITCHING],
      [RISHAB_OH, RON_OH],
      [IMPACT, ELLIOTT_THU_OH],
      [IMPACT, RISHAB_OH],
      [IMPACT, RON_OH],
      [SHOWCASE, ARNAV_OH],
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
    // A part-of-day window (fixture: "Friday morning, before noon") has no exact interval, so it
    // never clusters, even on the Showcase day.
    expect(overlapsFor(byId(MORNING_OH, withMorning), withMorning)).toEqual([]);
    const fridayBlocks = agendaBlocks(groupByDay(withMorning).find((g) => g.date === "2026-10-02")!.entries);
    expect(fridayBlocks.filter((b) => b.kind === "overlap").flatMap((b) => (b.kind === "overlap" ? ids(b.entries) : []))).toEqual([
      SHOWCASE,
      ARNAV_OH,
    ]);
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
      ELLIOTT_WED_AM_OH,
      ELLIOTT_WED_PM_OH,
      PATRICK_OH,
      ELLIOTT_THU_OH,
      RISHAB_OH,
      RON_OH,
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
      ELLIOTT_WED_AM_OH,
      ELLIOTT_WED_PM_OH,
      HAPPY_HOUR,
      FAILURE_LAB,
      PATRICK_OH,
      ELLIOTT_THU_OH,
      RISHAB_OH,
      RON_OH,
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
    // A plain event (no program) links its host or speaker through speakers, not programMentors:
    // Arnav's happy hour, his Siebel talk and the Entrepreneurial Impact panel.
    expect(programMentors(byId(HAPPY_HOUR))).toEqual([]);
    expect(programMentors(byId(SIEBEL_TALK))).toEqual([]);
    expect(programMentors(byId(IMPACT))).toEqual([]);
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
    expect(agendaTime(byId(ARNAV_OH))).toEqual({ main: "10:00 AM", sub: "to 11:30 AM", start: "10:00", end: "11:30" });
    expect(entryTimeText(byId(ARNAV_OH))).toBe("10:00–11:30 AM CT");
    // A part-of-day window (fixture): no times are invented.
    expect(agendaTime(byId(MORNING_OH, withMorning))).toEqual({ main: "Morning", sub: "before noon", start: null, end: null });
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
    // Arnav's Siebel talk: a 3:30 PM start and no end in the Siebel School listing, so none is invented.
    expect(agendaTime(byId(SIEBEL_TALK))).toEqual({ main: "3:30 PM", sub: null, start: "15:30", end: null });
    expect(entryStartText(byId(SIEBEL_TALK))).toEqual({ text: "3:30 PM", dateTime: "15:30" });
    expect(entryTimeText(byId(SIEBEL_TALK))).toBe("3:30 PM CT");
    expect(entryTimeText(byId(PANEL))).toBe("6:00–8:00 PM CT");
    expect(entryTimeText(byId("tailgate-and-enterpriseworks-tour"))).toBe("Time to be announced");
    // Rishab's window reads like Patrick's.
    expect(agendaTime(byId(RISHAB_OH))).toEqual({ main: "12:00 PM", sub: "to 5:00 PM", start: "12:00", end: "17:00" });
    expect(entryStartText(byId(RISHAB_OH))).toEqual({ text: "12:00 PM", dateTime: "12:00" });
    expect(entryTimeText(byId(RISHAB_OH))).toBe("12:00–5:00 PM CT");
    expect(entryTimeText(byId(PATRICK_OH))).toBe("10:00–11:30 AM CT");
    expect(locationSummary(byId(RISHAB_OH).location)).toBe("Location to be announced");
    // Ron's window: Thursday afternoon, at a confirmed venue.
    expect(agendaTime(byId(RON_OH))).toEqual({ main: "2:30 PM", sub: "to 4:30 PM", start: "14:30", end: "16:30" });
    expect(entryStartText(byId(RON_OH))).toEqual({ text: "2:30 PM", dateTime: "14:30" });
    expect(entryTimeText(byId(RON_OH))).toBe("2:30–4:30 PM CT");
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
    expect(locationSummary(byId(PATRICK_OH).location)).toBe("Espresso Royale at Grainger Library");
    expect(locationLines(byId(PATRICK_OH).location)).toEqual(["Espresso Royale at Grainger Library", "1301 W Springfield Ave, Urbana, IL 61801"]);
    // Arnav's office hours: in person in the Siebel Center atrium, at the address he gave (Sept 25).
    expect(locationSummary(byId(ARNAV_OH).location)).toBe(ARNAV_VENUE);
    expect(locationLines(byId(ARNAV_OH).location)).toEqual([ARNAV_VENUE, ARNAV_ADDRESS]);
    // His Siebel talk: Room 2405 in the same building, as the Siebel School lists it.
    expect(locationSummary(byId(SIEBEL_TALK).location)).toBe("Siebel Center for Computer Science · Room 2405");
    expect(locationLines(byId(SIEBEL_TALK).location)).toEqual([
      "Siebel Center for Computer Science",
      "Room 2405",
      "201 N. Goodwin Ave., Urbana, IL 61801",
    ]);
    expect(locationSummary(byId(RON_OH).location)).toBe("Business Instructional Facility (BIF)");
    expect(locationLines(byId(RON_OH).location)).toEqual([
      "Business Instructional Facility (BIF)",
      "515 E. Gregory Drive, Champaign, IL 61820",
    ]);
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
    // Elliott (Wed Sept 30 and Thu Oct 1), Rishab (Thu Oct 1, noon to 5 PM) and Ron (Thu Oct 1,
    // 2:30 to 4:30 PM) have published windows, so they aren't "Scheduling in progress". Only Vik is.
    expect(list.map((m) => m.id)).toEqual(["vikram-lakhwara"]);
    const [vik] = list;
    expect(vik).toMatchObject({
      name: "Vikram “Vik” Lakhwara",
      firstName: "Vik",
      affiliation: "Founder & Managing Member, Stakehouse",
      ctaLabel: "Express interest",
      href: "/office-hours?mentor=vikram-lakhwara#apply",
      headshot: { src: "/mentors/vikram-lakhwara.jpg", alt: "Vikram “Vik” Lakhwara" },
    });
    expect(JSON.stringify(list)).not.toMatch(/Wednesday|commitments|Revenue strategy|From his email|Symbio/i);
    expect(pendingMentorMatches(vik, "vik lakhwara")).toBe(true);
    expect(pendingMentorMatches(vik, "stakehouse")).toBe(true);
    expect(pendingMentorMatches(vik, "managing member")).toBe(true);
    expect(pendingMentorMatches(vik, "aerospace")).toBe(false);
    expect(pendingMentorMatches(vik, "notrica")).toBe(false);

    // A second mentor without windows (fixture) is listed after Vik, in content order, with the
    // same public fields; one who isn't taking applications is left out.
    const pendingFixture: Mentor = { ...DATE_ONLY_MENTOR, id: "fixture-pending", availability: [] };
    const closedFixture: Mentor = { ...pendingFixture, id: "fixture-closed", acceptingApplications: false };
    const withFixtures = pendingMentors([...publicMentors, pendingFixture, closedFixture]);
    expect(withFixtures.map((m) => m.id)).toEqual(["vikram-lakhwara", "fixture-pending"]);
    const fixture = withFixtures[1];
    expect(fixture).toEqual({
      id: "fixture-pending",
      name: "Fixture Mentor",
      firstName: "Fixture",
      affiliation: "Founder, Fixture Labs",
      headshot: null,
      ctaLabel: "Express interest",
      href: "/office-hours?mentor=fixture-pending#apply",
      demo: false,
    });
    expect(pendingMentorMatches(fixture, "fixture labs")).toBe(true);
    expect(pendingMentorMatches(fixture, "mentor")).toBe(true);
    expect(pendingMentorMatches(fixture, "stakehouse")).toBe(false);
  });
});
