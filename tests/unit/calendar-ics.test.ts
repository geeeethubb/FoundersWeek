import { describe, expect, it } from "vitest";
import { demoEvents, demoMentors } from "@/content/demo";
import { events } from "@/content/events";
import { mentors } from "@/content/mentors";
import { site } from "@/content/site";
import { googleCalendarUrl } from "@/lib/calendar/google";
import {
  buildIcsCalendar,
  escapeIcsText,
  foldIcsLine,
  icsDescription,
  icsLocalDateTime,
  icsUtcDateTime,
} from "@/lib/calendar/ics";
import { buildScheduleEntries, eventToEntry } from "@/lib/schedule/entries";

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

/** Unfold RFC 5545 continuation lines. */
const unfold = (ics: string) => ics.replace(/\r\n /g, "");
const octets = (s: string) => new TextEncoder().encode(s).length;
const vevents = (ics: string) => unfold(ics).match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g) ?? [];

describe("calendar eligibility", () => {
  it("exports confirmed events with exact start and end times", () => {
    expect(production.filter((e) => e.calendar.available).map((e) => e.id)).toEqual([
      "how-to-make-10k-a-month-in-college",
      "founders-week-kickoff-reception",
      "science-and-practice-of-pitching",
      "entrepreneurial-impact-launching-from-illinois",
      "techrise-pitch-competition",
      "founders-showcase-day-sessions",
      "founders-evening-showcase-and-reception",
    ]);
  });

  it("explains why forthcoming events and office hours can't be exported yet", () => {
    expect(dan.calendar).toEqual({
      available: false,
      reason: "Calendar export opens once the organizer confirms the date and time.",
    });
    expect(byId("tailgate-and-enterpriseworks-tour").calendar.available).toBe(false);
    expect(byId("illinois-football-vs-purdue").calendar.available).toBe(false);
    const oh = byId("office-hours-patrick-haddox-2026-10-01-am").calendar;
    expect(oh.available).toBe(false);
    expect(!oh.available && oh.reason).toMatch(/by application/i);
    expect(byId("demo-canceled-session", withDemo).calendar.available).toBe(false);
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
    expect(lines).toContain("LOCATION:100 MSEB");
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

describe("buildIcsCalendar — program blocks", () => {
  it("lists the timed sub-sessions (with people and moderators) in DESCRIPTION", () => {
    const text = icsDescription(showcase, SITE);
    expect(text.startsWith(`${showcase.summary}\n\nProgram (Central Time):\n`)).toBe(true);
    const program = text.split("\n\n")[1].split("\n");
    expect(program).toHaveLength(1 + 11);
    expect(program[1]).toBe("8:00–8:45 AM — Check-In and Breakfast Networking");
    expect(program[4]).toBe(
      "11:00–11:30 AM — Fireside Chat with Chancellor Charles Isbell: Innovation, Entrepreneurship, and Illinois’ Ambition for Impact (Charles Isbell (Chancellor); moderated by Scott Rose and Susan Martinis)",
    );
    expect(program[8]).toBe(
      "1:55–2:25 PM — From Idea to Scale — Building Doss: Lessons from an Illini Founder (Arnav Mishra; moderated by Ranjitha Kumar)",
    );
    expect(program[11]).toBe("3:50–5:30 PM — Innovation Tours and Structured Networking");
    expect(text.endsWith(`Details and updates: ${SITE}/schedule/founders-showcase-day-sessions`)).toBe(true);
  });

  it("notes people still to be announced", () => {
    const text = icsDescription(byId("techrise-pitch-competition"), SITE);
    expect(text).toContain(
      "6:30–6:50 PM — TechRise × University of Illinois Founders Week Cohort 2: Where Are They Now? (Mehmet Gunal and Elliott Notrica; Additional participants to be announced)",
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
    expect(description).toContain("\\nProgram (Central Time):\\n8:00–8:45 AM — Check-In");
  });
});

describe("all-events feed", () => {
  const feed = buildIcsCalendar(production, { siteUrl: SITE, now: NOW, name: "Founders Week 2026" });
  const uids = unfold(feed)
    .split("\r\n")
    .filter((l) => l.startsWith("UID:"));

  it("contains exactly the eligible events", () => {
    expect(uids).toEqual(production.filter((e) => e.calendar.available).map((e) => `UID:${e.id}@founders-week`));
    expect(vevents(feed)).toHaveLength(7);
  });

  it("leaves out forthcoming events, office hours and the removed afterparty", () => {
    expect(feed).not.toContain("dan-caruso-fireside-chat@");
    expect(feed).not.toContain("tailgate-and-enterpriseworks-tour@");
    expect(feed).not.toContain("illinois-football-vs-purdue@");
    expect(feed).not.toContain("office-hours-");
    expect(feed).not.toMatch(/afterparty|HERE Apartments/i);
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
    expect(params.get("location")).toBe("100 MSEB");
    expect(params.get("details")).toContain(`${SITE}/schedule/how-to-make-10k-a-month-in-college`);
  });

  it("carries the program for blocks", () => {
    const params = new URL(googleCalendarUrl(showcase, SITE)!).searchParams;
    expect(params.get("details")).toContain("2:40–2:55 PM — Next Generation Industrial, Manufacturing and Space Tech");
  });

  it("returns null for entries that can't be exported", () => {
    expect(googleCalendarUrl(dan, SITE)).toBeNull();
    expect(googleCalendarUrl(byId("office-hours-patrick-haddox-2026-10-01-am"), SITE)).toBeNull();
  });
});
