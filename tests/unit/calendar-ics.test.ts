import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as eventIcsRoute } from "@/app/schedule/[id]/calendar.ics/route";
import { GET as feedIcsRoute } from "@/app/schedule/calendar.ics/route";
import { demoEvents, demoMentors } from "@/content/demo";
import { events } from "@/content/events";
import { mentors } from "@/content/mentors";
import { site } from "@/content/site";
import type { Mentor } from "@/content/types";
import { googleCalendarUrl } from "@/lib/calendar/google";
import {
  buildIcsCalendar,
  escapeIcsText,
  foldIcsLine,
  icsDescription,
  icsLocalDateTime,
  icsUtcDateTime,
} from "@/lib/calendar/ics";
import { buildScheduleEntries, calendarAvailability, eventToEntry } from "@/lib/schedule/entries";

const SITE = "https://founders-week.example";
const NOW = new Date("2026-09-23T17:15:00Z");
const production = buildScheduleEntries({ events, mentors, site });
const withDemo = buildScheduleEntries({
  events: [...events, ...demoEvents],
  mentors: [...mentors, ...demoMentors],
  site,
});
const byId = (id: string, list = production) => list.find((e) => e.id === id)!;
const panel = byId("how-to-make-10k-a-month-in-college");
const showcase = byId("founders-showcase-day-sessions");
const dan = byId("dan-caruso-fireside-chat");
const workshop = byId("demo-customer-discovery-workshop", withDemo);
const HAPPY_HOUR = "happy-hour-at-legends-with-arnav-mishra";
const HAPPY_HOUR_TITLE = "Happy Hour with Arnav Mishra at Legends";
const happyHour = byId(HAPPY_HOUR);
const PATRICK_OH = "office-hours-patrick-haddox-2026-10-01-am";
const ARNAV_OH = "office-hours-arnav-mishra-2026-10-02-am";
const RISHAB_OH = "office-hours-rishab-veldur-2026-10-01";
const RON_OH = "office-hours-ron-lewis-2026-10-01-pm";
const ELLIOTT_WED_AM_OH = "office-hours-elliott-notrica-2026-09-30-am";
const ELLIOTT_WED_PM_OH = "office-hours-elliott-notrica-2026-09-30-pm";
const ELLIOTT_THU_OH = "office-hours-elliott-notrica-2026-10-01-pm";
const rishabOfficeHours = byId(RISHAB_OH);
const OFFICE_HOURS_REASON = "Office hours are by application. Selected students get their confirmed time by email.";

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

/** Unfold RFC 5545 continuation lines. */
const unfold = (ics: string) => ics.replace(/\r\n /g, "");
const octets = (s: string) => new TextEncoder().encode(s).length;
const vevents = (ics: string) => unfold(ics).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

/**
 * The Founders Week Afterparty (Sat Oct 3, HERE Apartments) was canceled and must never appear.
 * (Arnav's Wednesday happy hour at Legends is a separate, real event.)
 */
function expectNoCanceledAfterparty(s: string) {
  expect(s).not.toMatch(/HERE Apartments/i);
  expect(s).not.toContain("founders-week-afterparty");
  expect(s).not.toMatch(/Founders Week Afterparty/i);
}

describe("calendar eligibility", () => {
  it("exports confirmed events with exact start and end times", () => {
    expect(production.filter((e) => e.calendar.available).map((e) => e.id)).toEqual([
      "how-to-make-10k-a-month-in-college",
      "founders-week-kickoff-reception",
      HAPPY_HOUR,
      "founder-failure-lab",
      "science-and-practice-of-pitching",
      "entrepreneurial-impact-launching-from-illinois",
      "techrise-pitch-competition",
      "founders-showcase-day-sessions",
      "founders-evening-showcase-and-reception",
    ]);
  });

  it("explains why forthcoming events and office hours can't be exported yet", () => {
    // Dan Caruso: confirmed for 4:00 PM, but no end time has been announced — nothing is invented.
    expect(dan.time).toEqual({ kind: "exact", start: "16:00" });
    expect(dan.calendar).toEqual({
      available: false,
      reason: "Calendar export opens once an end time is announced.",
    });
    expect(byId("tailgate-and-enterpriseworks-tour").calendar.available).toBe(false);
    expect(byId("illinois-football-vs-purdue").calendar.available).toBe(false);
    const oh = byId("office-hours-patrick-haddox-2026-10-01-am").calendar;
    expect(oh.available).toBe(false);
    expect(!oh.available && oh.reason).toMatch(/by application/i);
    expect(byId("demo-canceled-session", withDemo).calendar.available).toBe(false);
  });

  it("never exports office hours: Rishab's exact noon–5 PM window, Ron's confirmed window, Elliott's three windows, and a date-only window", () => {
    expect(production).toHaveLength(19);
    const officeHours = production.filter((e) => e.kind === "office-hours");
    expect(officeHours.map((e) => e.id)).toEqual([
      ELLIOTT_WED_AM_OH,
      ELLIOTT_WED_PM_OH,
      PATRICK_OH,
      ELLIOTT_THU_OH,
      RISHAB_OH,
      RON_OH,
      ARNAV_OH,
    ]);
    for (const e of officeHours) {
      expect(e.calendar, e.id).toEqual({ available: false, reason: OFFICE_HOURS_REASON });
      expect(googleCalendarUrl(e, SITE), e.id).toBeNull();
    }
    // Rishab's window now has an exact interval, but it's an availability window, not a booking.
    expect(rishabOfficeHours).toMatchObject({
      date: "2026-10-01",
      time: { kind: "exact", start: "12:00", end: "17:00" },
      status: "planned",
      startsAt: "2026-10-01T17:00:00.000Z",
      endsAt: "2026-10-01T22:00:00.000Z",
    });
    // Still no VEVENT for it.
    const ics = buildIcsCalendar([rishabOfficeHours], { siteUrl: SITE, now: NOW });
    expect(ics).not.toContain("BEGIN:VEVENT");
    expect(ics).not.toContain(RISHAB_OH);
    expect(ics).not.toContain("20261001T120000");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);

    // Ron's window is confirmed, with exact times and a venue, and still isn't exported: selected
    // students get their time by email.
    const ronOfficeHours = byId(RON_OH);
    expect(ronOfficeHours).toMatchObject({
      date: "2026-10-01",
      time: { kind: "exact", start: "14:30", end: "16:30" },
      status: "confirmed",
      startsAt: "2026-10-01T19:30:00.000Z",
      endsAt: "2026-10-01T21:30:00.000Z",
    });
    const ronIcs = buildIcsCalendar([ronOfficeHours], { siteUrl: SITE, now: NOW });
    expect(ronIcs).not.toContain("BEGIN:VEVENT");
    expect(ronIcs).not.toContain(RON_OH);
    expect(ronIcs).not.toContain("20261001T143000");
    expect(ronIcs).not.toContain("Business Instructional Facility");

    // Elliott's three exact windows (Wed 9–noon and 2–5, Thu noon–5) are planned, not bookings,
    // and none of them is exported.
    const elliottWindows = [ELLIOTT_WED_AM_OH, ELLIOTT_WED_PM_OH, ELLIOTT_THU_OH].map((id) => byId(id));
    expect(elliottWindows.map((e) => [e.date, e.time, e.status, e.startsAt, e.endsAt])).toEqual([
      ["2026-09-30", { kind: "exact", start: "09:00", end: "12:00" }, "planned", "2026-09-30T14:00:00.000Z", "2026-09-30T17:00:00.000Z"],
      ["2026-09-30", { kind: "exact", start: "14:00", end: "17:00" }, "planned", "2026-09-30T19:00:00.000Z", "2026-09-30T22:00:00.000Z"],
      ["2026-10-01", { kind: "exact", start: "12:00", end: "17:00" }, "planned", "2026-10-01T17:00:00.000Z", "2026-10-01T22:00:00.000Z"],
    ]);
    const elliottIcs = buildIcsCalendar(elliottWindows, { siteUrl: SITE, now: NOW });
    expect(elliottIcs).not.toContain("BEGIN:VEVENT");
    expect(elliottIcs).not.toContain("elliott-notrica");
    expect(elliottIcs).not.toContain("20260930T090000");
    expect(elliottIcs).not.toContain("20261001T120000");

    // A date-only window (a future mentor's): no export, and no invented time on Oct 1.
    const withDateOnly = buildScheduleEntries({ events, mentors: [...mentors, DATE_ONLY_MENTOR], site });
    const dateOnly = byId(FIXTURE_OH, withDateOnly);
    expect(dateOnly).toMatchObject({
      date: "2026-10-01",
      time: { kind: "tba" },
      status: "planned",
      startsAt: null,
      endsAt: null,
      calendar: { available: false, reason: OFFICE_HOURS_REASON },
    });
    expect(googleCalendarUrl(dateOnly, SITE)).toBeNull();
    const dateOnlyIcs = buildIcsCalendar([dateOnly], { siteUrl: SITE, now: NOW });
    expect(dateOnlyIcs).not.toContain("BEGIN:VEVENT");
    expect(dateOnlyIcs).not.toContain(FIXTURE_OH);
    // Adding it changes nothing in the all-events feed.
    expect(vevents(buildIcsCalendar(withDateOnly, { siteUrl: SITE, now: NOW }))).toEqual(
      vevents(buildIcsCalendar(production, { siteUrl: SITE, now: NOW })),
    );
    // Office hours stay out even once a window is confirmed with exact times: selected students get
    // their time by email.
    expect(calendarAvailability("office-hours", "confirmed", { kind: "exact", start: "10:00", end: "11:00" })).toEqual({
      available: false,
      reason: OFFICE_HOURS_REASON,
    });
    expect(calendarAvailability("office-hours", "planned", { kind: "tba" })).toEqual({
      available: false,
      reason: OFFICE_HOURS_REASON,
    });
    // An event with no announced time explains itself differently.
    expect(calendarAvailability("event", "confirmed", { kind: "tba" })).toEqual({
      available: false,
      reason: "Calendar export opens once an exact time is announced.",
    });
  });
});

describe("buildIcsCalendar — Sep 29 panel", () => {
  const ics = buildIcsCalendar([panel], { siteUrl: SITE, now: NOW, name: "Founders Week" });
  const lines = unfold(ics).split("\r\n");

  it("is a VCALENDAR with the required properties and CRLF line endings", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines.some((l) => l.startsWith("PRODID:"))).toBe(true);
    expect(lines).toContain("CALSCALE:GREGORIAN");
    expect(lines).toContain("METHOD:PUBLISH");
    expect(lines).toContain("X-WR-CALNAME:Founders Week");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("embeds an America/Chicago VTIMEZONE with the US DST rules", () => {
    const tz = unfold(ics).match(/BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE/)![0];
    expect(tz).toContain("TZID:America/Chicago");
    expect(tz).toMatch(
      /BEGIN:DAYLIGHT\r\nTZOFFSETFROM:-0600\r\nTZOFFSETTO:-0500\r\nTZNAME:CDT\r\nDTSTART:19700308T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU/,
    );
    expect(tz).toMatch(
      /BEGIN:STANDARD\r\nTZOFFSETFROM:-0500\r\nTZOFFSETTO:-0600\r\nTZNAME:CST\r\nDTSTART:19701101T020000\r\nRRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU/,
    );
  });

  it("writes Central Time wall-clock times with TZID, a UTC DTSTAMP and a stable UID", () => {
    expect(lines).toContain("DTSTART;TZID=America/Chicago:20260929T180000");
    expect(lines).toContain("DTEND;TZID=America/Chicago:20260929T200000");
    expect(lines).toContain("DTSTAMP:20260923T171500Z");
    expect(lines).toContain("UID:how-to-make-10k-a-month-in-college@founders-week");
    expect(lines).toContain("SUMMARY:How to Make $10K/Month in College");
    expect(lines).toContain(
      "LOCATION:Materials Science and Engineering Building\\, Room 100\\, 1304 W. Green St.\\, Urbana\\, IL 61801",
    );
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines).toContain(`URL:${SITE}/schedule/how-to-make-10k-a-month-in-college`);
    expect(lines.some((l) => /^DTSTART:\d{8}T\d{6}Z$/.test(l))).toBe(false);
  });

  it("includes the official event information link in DESCRIPTION", () => {
    const description = lines.find((l) => l.startsWith("DESCRIPTION:"))!;
    expect(description).toContain(
      "Event information: https://www.austnkennedy.com/how-to-make-10k-a-month-in-college",
    );
    expect(description).toContain(`\\n\\nDetails and updates: ${SITE}/schedule/how-to-make-10k-a-month-in-college`);
    // Program blocks only: a single event has no program section.
    expect(description).not.toContain("Program (");
  });
});

describe("buildIcsCalendar — Arnav's happy hour at Legends (Wed Sep 30)", () => {
  const ics = buildIcsCalendar([happyHour], { siteUrl: SITE, now: NOW, name: "Founders Week" });
  const lines = unfold(ics).split("\r\n");

  it("is a confirmed 5:00–7:00 PM Central Time event at Legends, 6th & Green", () => {
    expect(happyHour.calendar).toEqual({ available: true });
    expect(vevents(ics)).toHaveLength(1);
    expect(lines).toContain(`UID:${HAPPY_HOUR}@founders-week`);
    expect(lines).toContain("DTSTART;TZID=America/Chicago:20260930T170000");
    expect(lines).toContain("DTEND;TZID=America/Chicago:20260930T190000");
    expect(lines).toContain(`SUMMARY:${HAPPY_HOUR_TITLE}`);
    expect(lines).toContain("LOCATION:Legends\\, 6th & Green");
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines).toContain(`URL:${SITE}/schedule/${HAPPY_HOUR}`);
    const description = lines.find((l) => l.startsWith("DESCRIPTION:"))!;
    expect(description).toBe(`DESCRIPTION:${escapeIcsText(icsDescription(happyHour, SITE))}`);
    expect(description).toContain("RSVP on Partiful");
    expect(description).toContain(`Details and updates: ${SITE}/schedule/${HAPPY_HOUR}`);
    for (const line of ics.split("\r\n")) expect(octets(line)).toBeLessThanOrEqual(75);
    expectNoCanceledAfterparty(ics.replace(/\r\n /g, ""));
  });

  it("builds a Google Calendar link with the same local times and place", () => {
    const params = new URL(googleCalendarUrl(happyHour, SITE)!).searchParams;
    expect(params.get("text")).toBe(HAPPY_HOUR_TITLE);
    expect(params.get("dates")).toBe("20260930T170000/20260930T190000");
    expect(params.get("ctz")).toBe("America/Chicago");
    expect(params.get("location")).toBe("Legends, 6th & Green");
    expect(params.get("details")).toContain(`${SITE}/schedule/${HAPPY_HOUR}`);
  });
});

describe("calendar.ics routes (public data)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://founders.example.edu");
  });
  afterEach(() => vi.unstubAllEnvs());

  const get = (id: string) => eventIcsRoute(new Request(`https://founders.example.edu/schedule/${id}/calendar.ics`), {
    params: Promise.resolve({ id }),
  });

  it("serves the happy hour's .ics as a download", async () => {
    const res = await get(HAPPY_HOUR);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/calendar; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe(`attachment; filename="${HAPPY_HOUR}.ics"`);
    const body = unfold(await res.text());
    expect(body).toContain(`UID:${HAPPY_HOUR}@founders-week`);
    expect(body).toContain("DTSTART;TZID=America/Chicago:20260930T170000");
    expect(body).toContain("DTEND;TZID=America/Chicago:20260930T190000");
    expect(body).toContain(`URL:https://founders.example.edu/schedule/${HAPPY_HOUR}`);
  });

  it("has no .ics for the canceled afterparty, forthcoming events or office hours", async () => {
    for (const id of ["founders-week-afterparty", "dan-caruso-fireside-chat", PATRICK_OH, RISHAB_OH, RON_OH, ARNAV_OH]) {
      const res = await get(id);
      expect(res.status, id).toBe(404);
      expect(await res.text(), id).toBe("No calendar file is available for this event.");
    }
  });

  it("the all-events feed includes the happy hour and never the canceled afterparty", async () => {
    const body = unfold(await (await feedIcsRoute()).text());
    expect(vevents(body)).toHaveLength(9);
    expect(body).toContain(`UID:${HAPPY_HOUR}@founders-week`);
    expectNoCanceledAfterparty(body);
    expect(body).toContain("SUMMARY:Founders Evening Showcase and Reception");
    // Office hours (Rishab's noon–5 PM window included) never reach the feed.
    expect(body).not.toContain("office-hours-");
    expect(body).not.toContain("SUMMARY:Office hours");
  });
});

describe("buildIcsCalendar — program blocks", () => {
  it("lists the timed sub-sessions (with people and moderators) in DESCRIPTION", () => {
    const text = icsDescription(showcase, SITE);
    expect(text.startsWith(`${showcase.summary}\n\nProgram (Central Time):\n`)).toBe(true);
    const program = text.split("\n\n")[1].split("\n");
    expect(program).toHaveLength(1 + 11);
    expect(program[1]).toBe("8:00–8:45 AM: Check-In and Breakfast Networking");
    expect(program[4]).toBe(
      "11:00–11:30 AM: Fireside Chat with Chancellor Charles Isbell: Innovation, Entrepreneurship, and Illinois’ Ambition for Impact (Charles Isbell (Chancellor); moderated by Scott Rose and Susan Martinis)",
    );
    expect(program[7]).toBe(
      "1:20–1:55 PM: Health Innovation: From Therapeutics to Devices (Marty Burke, Carol Curtis, Steve Boppart, Rishab Veldur and Rohit Bhargava)",
    );
    expect(program[8]).toBe(
      "1:55–2:25 PM: From Idea to Scale: Building Doss, Lessons from an Illini Founder (Arnav Mishra; moderated by Ranjitha Kumar)",
    );
    expect(program[11]).toBe("3:50–5:30 PM: Innovation Tours and Structured Networking");
    expect(text.endsWith(`Details and updates: ${SITE}/schedule/founders-showcase-day-sessions`)).toBe(true);
  });

  it("notes people still to be announced", () => {
    const text = icsDescription(byId("techrise-pitch-competition"), SITE);
    expect(text).toContain(
      "6:30–6:50 PM: TechRise × University of Illinois Founders Week Cohort 2: Where Are They Now? (Mehmet Gunal and Elliott Notrica; Additional participants to be announced)",
    );
  });

  it("escapes and folds the long DESCRIPTION without losing anything", () => {
    const ics = buildIcsCalendar([showcase], { siteUrl: SITE, now: NOW });
    for (const line of ics.split("\r\n")) expect(octets(line)).toBeLessThanOrEqual(75);
    const vevent = vevents(ics)[0] ?? "";
    expect(vevent).toContain("DTSTART;TZID=America/Chicago:20261002T080000");
    expect(vevent).toContain("DTEND;TZID=America/Chicago:20261002T173000");
    expect(vevent).toContain("LOCATION:Illinois Conference Center");
    const description = vevent.split("\r\n").find((l) => l.startsWith("DESCRIPTION:"))!;
    expect(description).toBe(`DESCRIPTION:${escapeIcsText(icsDescription(showcase, SITE))}`);
    expect(description).toContain("(Charles Isbell (Chancellor)\\; moderated by Scott Rose and Susan Martinis)");
    expect(description).toContain("\\nProgram (Central Time):\\n8:00–8:45 AM: Check-In");
  });
});

describe("all-events feed", () => {
  const feed = buildIcsCalendar(production, { siteUrl: SITE, now: NOW, name: "Founders Week 2026" });
  const uids = unfold(feed)
    .split("\r\n")
    .filter((l) => l.startsWith("UID:"));

  it("contains exactly the eligible events", () => {
    expect(uids).toEqual(production.filter((e) => e.calendar.available).map((e) => `UID:${e.id}@founders-week`));
    expect(vevents(feed)).toHaveLength(9);
    expect(uids).toContain(`UID:${HAPPY_HOUR}@founders-week`);
  });

  it("leaves out forthcoming events, office hours and the removed afterparty", () => {
    expect(feed).not.toContain(`${RISHAB_OH}@`);
    // Rishab's window is the only Oct 1 listing that starts at noon, and it stays out.
    expect(unfold(feed)).not.toContain("DTSTART;TZID=America/Chicago:20261001T120000");
    expect(unfold(feed)).not.toContain("SUMMARY:Office hours with Rishab Veldur");
    expect(feed).not.toContain("dan-caruso-fireside-chat@");
    expect(feed).not.toContain("tailgate-and-enterpriseworks-tour@");
    expect(feed).not.toContain("illinois-football-vs-purdue@");
    expect(feed).not.toContain("office-hours-");
    expectNoCanceledAfterparty(unfold(feed));
    // Nothing on Saturday is exportable yet (both items are still "time forthcoming").
    expect(unfold(feed)).not.toMatch(/DTSTART;TZID=America\/Chicago:20261003/);
    expect(feed).toContain("SUMMARY:Founders Evening Showcase and Reception");
  });

  it("is still a valid calendar when nothing is eligible", () => {
    const empty = buildIcsCalendar([dan], { siteUrl: SITE, now: NOW });
    expect(empty).not.toContain("BEGIN:VEVENT");
    expect(empty).toContain("BEGIN:VTIMEZONE");
    expect(empty.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("time zones and escaping", () => {
  it("keeps local wall-clock times with TZID in winter (CST), not a shifted UTC time", () => {
    const december = eventToEntry({
      ...demoEvents[0],
      id: "winter-demo",
      date: "2026-12-03",
      time: { kind: "exact", start: "18:00", end: "19:30" },
    });
    const out = unfold(buildIcsCalendar([december], { siteUrl: SITE, now: NOW }));
    expect(out).toContain("DTSTART;TZID=America/Chicago:20261203T180000");
    expect(out).toContain("DTEND;TZID=America/Chicago:20261203T193000");
    expect(out).not.toMatch(/DTSTART:\d{8}T\d{6}Z/);
  });

  it("escapes commas in locations", () => {
    const out = unfold(buildIcsCalendar([workshop], { siteUrl: SITE, now: NOW }));
    expect(out).toContain("LOCATION:Demo Hall\\, Room 101\\, 123 Example St\\, Urbana\\, IL");
  });

  it("escapes backslashes, semicolons, commas and newlines", () => {
    expect(escapeIcsText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("never splits a multi-byte UTF-8 character when folding", () => {
    const line = `SUMMARY:${"Café × Founders — ".repeat(8)}`;
    const folded = foldIcsLine(line);
    const physical = folded.split("\r\n");
    expect(physical.length).toBeGreaterThan(1);
    for (const p of physical) {
      expect(octets(p)).toBeLessThanOrEqual(75);
      expect(p).not.toContain("�");
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("formats local and UTC date-times", () => {
    expect(icsLocalDateTime("2026-09-29", "18:00")).toBe("20260929T180000");
    expect(icsUtcDateTime(new Date("2026-10-03T23:00:00.000Z"))).toBe("20261003T230000Z");
  });
});

describe("googleCalendarUrl", () => {
  it("builds a template link with local times and ctz=America/Chicago", () => {
    const url = googleCalendarUrl(panel, SITE)!;
    expect(url.startsWith("https://calendar.google.com/calendar/render?action=TEMPLATE&")).toBe(true);
    expect(url).toContain("dates=20260929T180000/20260929T200000");
    expect(url).toContain("ctz=America/Chicago");
    const params = new URL(url).searchParams;
    expect(params.get("text")).toBe("How to Make $10K/Month in College");
    expect(params.get("location")).toBe(
      "Materials Science and Engineering Building, Room 100, 1304 W. Green St., Urbana, IL 61801",
    );
    expect(params.get("details")).toContain(`${SITE}/schedule/how-to-make-10k-a-month-in-college`);
  });

  it("carries the program for blocks", () => {
    const params = new URL(googleCalendarUrl(showcase, SITE)!).searchParams;
    expect(params.get("details")).toContain("2:40–2:55 PM: Next Generation Industrial, Manufacturing and Space Tech");
    expect(params.get("details")).toContain(
      "1:20–1:55 PM: Health Innovation: From Therapeutics to Devices (Marty Burke, Carol Curtis, Steve Boppart, Rishab Veldur and Rohit Bhargava)",
    );
  });

  it("returns null for entries that can't be exported", () => {
    expect(googleCalendarUrl(dan, SITE)).toBeNull();
    expect(googleCalendarUrl(byId(PATRICK_OH), SITE)).toBeNull();
    expect(googleCalendarUrl(rishabOfficeHours, SITE)).toBeNull();
  });
});
