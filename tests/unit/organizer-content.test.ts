/**
 * The organizer view against the current content: the six mentors (names, verified roles,
 * headshots), organizer-only notes and drafts (including Rishab's and Ron's), the lineup balanced
 * three across, Rishab's confirmed Thu, Oct 1 12:00–5:00 PM window in filters, Ron's Thu, Oct 1
 * 2:30–4:30 PM window at BIF, Elliott's three windows (Wed, Sep 30 9–12 and 2–5; Thu, Oct 1 12–5), the
 * sessions generated from exact windows (Patrick 3, Arnav 3, Elliott 22, Ron 4, Rishab 10; only Vik is
 * still scheduling), no session-limit warning for anyone in
 * production (Patrick is open to all three of his sessions) but one for a fixture copy of Patrick
 * who agreed to one or two, the date-only (time not set) and
 * part-of-day paths on test-only fixture mentors, no events (Dan Caruso, Arnav's happy hour,
 * Rishab's Showcase panel, the canceled afterparty) posing as mentors, and the "Data store"
 * indicator never exposing connection details.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMentors, getMentorsForOrganizers, getSite } from "@/content";
import { events } from "@/content/events";
import { mentors as productionMentors } from "@/content/mentors";
import type { Mentor } from "@/content/types";
import { ApplicationFiltersForm } from "@/components/organizer/application-filters";
import { assignOptionText } from "@/components/organizer/assign-form";
import { lineupColumns, MentorLineup } from "@/components/organizer/mentor-lineup";
import { MentorNotes, mentorDrafts, mentorMissing, sessionsSummary } from "@/components/organizer/mentor-notes";
import { SlotBoard } from "@/components/organizer/slot-board";
import { buildApplicationCatalog, mentorNeedsBroadAvailability } from "@/lib/applications/catalog";
import { balancedColumns } from "@/lib/columns";
import { __setDbForTests, createMemoryDbForTests } from "@/lib/db/client";
import { getDataStoreStatus, postgresProvider } from "@/lib/organizer/data-store";
import { describeDataStore, redactSecrets } from "@/lib/organizer/data-store-view";
import {
  buildOrganizerDirectory,
  joinNames,
  mentorBookability,
  sessionLimitNote,
  type OrganizerDirectory,
} from "@/lib/organizer/directory";
import { DEFAULT_APPLICATION_FILTERS, parseApplicationFilters, restrictToDirectory } from "@/lib/organizer/filters";
import { sessionRuleText } from "@/lib/schedule/sessions";
import { directory as fixtureDirectory } from "./organizer-fixtures";

/** site.officeHours: the rule sessions are generated with. */
const RULE = getSite().officeHours;
const RULE_TEXT = sessionRuleText(RULE);
const build = (mentors: Mentor[]): OrganizerDirectory => buildOrganizerDirectory(mentors, RULE);

const MENTOR_IDS = ["patrick-haddox", "arnav-mishra", "vikram-lakhwara", "elliott-notrica", "ron-lewis", "rishab-veldur"];
const RISHAB_WINDOW = "rishab-veldur-2026-10-01";
const RISHAB_LABEL = "Thu, Oct 1 · 12:00–5:00 PM CT";
const RON_WINDOW = "ron-lewis-2026-10-01-pm";
const RON_LABEL = "Thu, Oct 1 · 2:30–4:30 PM CT";
/** Elliott's three exact windows (organizer update, Sept 25), in order: [id, start, end, label, sessions]. */
const ELLIOTT_WINDOWS = [
  ["elliott-notrica-2026-09-30-am", "2026-09-30", "09:00", "12:00", "Wed, Sep 30 · 9:00 AM–12:00 PM CT", 6],
  ["elliott-notrica-2026-09-30-pm", "2026-09-30", "14:00", "17:00", "Wed, Sep 30 · 2:00–5:00 PM CT", 6],
  ["elliott-notrica-2026-10-01-pm", "2026-10-01", "12:00", "17:00", "Thu, Oct 1 · 12:00–5:00 PM CT", 10],
] as const;
const ELLIOTT_WINDOW_IDS = ELLIOTT_WINDOWS.map(([id]) => id);

/**
 * Test-only mentor whose date is set but whose time isn't: the shape Rishab had before his
 * 12–5 PM window was locked. No production mentor uses it now, but the date-only path (label,
 * "Exact times TBA" badge, timeKnown=false, broad-availability rule) stays for future mentors.
 */
const DATE_ONLY_WINDOW = "fixture-date-only-2026-10-01";
const DATE_ONLY_LABEL = "Thu, Oct 1 · Exact time to be confirmed";
const dateOnlyMentor: Mentor = {
  id: "fixture-date-only",
  name: "Dana Fixture",
  firstName: "Dana",
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
    note: "Dana has time for office hours on Thursday, October 1. We’re still confirming the exact time.",
  },
  availability: [{ id: DATE_ONLY_WINDOW, date: "2026-10-01", time: { kind: "tba" }, label: "Exact time to be confirmed" }],
  slots: [],
  links: [],
  acceptingApplications: true,
  organizerNotes: "Fixture: date set, time not.",
  sources: [],
};

/** A part-of-day window ("Friday morning, before noon"), like Arnav's until it became exact on Sept 24. */
const ROUGH_WINDOW = "fixture-rough-2026-10-02-am";
const roughMentor: Mentor = {
  ...dateOnlyMentor,
  id: "fixture-rough",
  name: "Riley Fixture",
  firstName: "Riley",
  availability: [
    {
      id: ROUGH_WINDOW,
      date: "2026-10-02",
      time: { kind: "part-of-day", part: "morning", before: "12:00" },
      label: "Friday morning, before noon · Exact window pending",
    },
  ],
  organizerNotes: "Fixture: part of day, no exact times.",
};

/**
 * Test-only copy of Patrick who agreed to fewer sessions than his window fits ("One or two
 * sessions" in a window with room for three). Production Patrick sets no count (he's open to all
 * three), so no production mentor triggers the organizer warning; this keeps it covered.
 */
const productionPatrick = productionMentors.find((m) => m.id === "patrick-haddox")!;
const limitedPatrick: Mentor = {
  ...productionPatrick,
  session: { ...productionPatrick.session, sessionCount: "One or two sessions" },
  organizerNotes: "Fixture: willing to host one or two sessions in the Thu Oct 1, 10:00–11:30 AM window.",
};
/** Organizer content with Patrick swapped for the fixture above (same six mentors, same order). */
const withLimitedPatrick = (): Mentor[] =>
  getMentorsForOrganizers().map((m) => (m.id === limitedPatrick.id ? limitedPatrick : m));

/** Every <img> alt text in the markup. */
function imageAlts(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\balt="([^"]*)"/g)].map((m) => m[1]);
}

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

beforeEach(() => {
  vi.stubEnv("SHOW_DEMO_CONTENT", "");
  vi.stubEnv("SHOW_DRAFT_CONTENT", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("organizer directory from production content", () => {
  const directory = build(getMentorsForOrganizers());

  it("lists exactly the six mentors with verified names, roles and headshots", () => {
    expect(directory.mentors.map((m) => m.id)).toEqual(MENTOR_IDS);
    expect(directory.mentors).toHaveLength(6);
    const by = (id: string) => directory.mentorsById.get(id)!;
    expect(by("patrick-haddox")).toMatchObject({ name: "Patrick Haddox", affiliation: "CEO & Co-Founder, Samara Aerospace" });
    expect(by("arnav-mishra")).toMatchObject({ name: "Arnav Mishra", affiliation: "Co-Founder & CTO, Doss" });
    // Vik's title is verified now (Stakehouse team page).
    expect(by("vikram-lakhwara")).toMatchObject({
      name: "Vikram “Vik” Lakhwara",
      firstName: "Vik",
      role: "Founder & Managing Member",
      company: "Stakehouse",
      affiliation: "Founder & Managing Member, Stakehouse",
    });
    expect(by("elliott-notrica")).toMatchObject({
      name: "Elliott Notrica",
      firstName: "Elliott",
      role: "Founder & CEO",
      company: "Symbio Bioculinary",
      affiliation: "Founder & CEO, Symbio Bioculinary",
      demo: false,
      scheduling: "available",
      acceptingApplications: true,
      // Elliott set windows, not a number of sessions, so there's no session limit to warn about.
      sessionCount: null,
    });
    expect(by("ron-lewis")).toMatchObject({
      name: "Ron Lewis",
      firstName: "Ron",
      affiliation: "Co-Founder, Auctus Advisory",
      scheduling: "available",
      acceptingApplications: true,
      // Ron set a window, not a number of sessions, so there's no session limit to warn about.
      sessionCount: null,
    });
    expect(by("rishab-veldur")).toEqual({
      id: "rishab-veldur",
      name: "Rishab Veldur",
      firstName: "Rishab",
      role: "Co-Founder & CEO",
      company: "Auvi Labs",
      affiliation: "Co-Founder & CEO, Auvi Labs",
      headshot: { src: "/mentors/rishab-veldur.jpg", alt: "Rishab Veldur", width: 800, height: 800 },
      demo: false,
      scheduling: "available",
      acceptingApplications: true,
      sessionCount: null,
      organizerNotes: productionMentors.find((m) => m.id === "rishab-veldur")!.organizerNotes,
    });
    expect(Object.fromEntries(directory.mentors.map((m) => [m.id, m.scheduling]))).toEqual({
      "patrick-haddox": "available",
      "arnav-mishra": "available",
      "vikram-lakhwara": "in-progress",
      "elliott-notrica": "available",
      "ron-lewis": "available",
      "rishab-veldur": "available",
    });
    for (const m of directory.mentors) expect(m.headshot).toMatchObject({ src: `/mentors/${m.id}.jpg`, alt: m.name });
    // Vik has no windows or slots yet.
    expect(directory.windows.filter((w) => w.mentorId === "vikram-lakhwara")).toEqual([]);
    expect(directory.slots.filter((s) => s.mentorId === "vikram-lakhwara")).toEqual([]);
    // Elliott: three exact windows, Wed, Sep 30 (9–12 and 2–5) and Thu, Oct 1 (12–5).
    expect(directory.windows.filter((w) => w.mentorId === "elliott-notrica")).toEqual(
      ELLIOTT_WINDOWS.map(([id, date, start, end, label]) => ({
        id,
        mentorId: "elliott-notrica",
        mentorName: "Elliott Notrica",
        date,
        time: { kind: "exact", start, end },
        kind: "window",
        demo: false,
        label,
      })),
    );
    // Ron: ONE confirmed window, Thu, Oct 1 2:30–4:30 PM (never Oct 4, which is organizer-only).
    expect(directory.windows.filter((w) => w.mentorId === "ron-lewis")).toEqual([
      {
        id: RON_WINDOW,
        mentorId: "ron-lewis",
        mentorName: "Ron Lewis",
        date: "2026-10-01",
        time: { kind: "exact", start: "14:30", end: "16:30" },
        kind: "window",
        demo: false,
        label: RON_LABEL,
      },
    ]);
    // Rishab: ONE confirmed window, Thu, Oct 1 12:00–5:00 PM (never Oct 2), split into sessions.
    expect(directory.windows.filter((w) => w.mentorId === "rishab-veldur")).toEqual([
      {
        id: RISHAB_WINDOW,
        mentorId: "rishab-veldur",
        mentorName: "Rishab Veldur",
        date: "2026-10-01",
        time: { kind: "exact", start: "12:00", end: "17:00" },
        kind: "window",
        demo: false,
        label: RISHAB_LABEL,
      },
    ]);
    expect(directory.slots.filter((s) => s.mentorId === "rishab-veldur")).toHaveLength(10);
    expect(directory.windows.some((w) => w.mentorId === "rishab-veldur" && w.date !== "2026-10-01")).toBe(false);
    // Production has no explicit slots: every session is generated from an exact window.
    expect(directory.slots.every((s) => s.generated)).toBe(true);
    expect(directory.windows.map((w) => w.id)).toEqual([
      "patrick-haddox-2026-10-01-am",
      "arnav-mishra-2026-10-02-am",
      ...ELLIOTT_WINDOW_IDS,
      RON_WINDOW,
      RISHAB_WINDOW,
    ]);
  });

  it("splits exact windows into sessions: Patrick 3, Arnav 3, Elliott 22, Ron 4, Rishab 10, Vik (still scheduling) none", () => {
    const sessionsOf = (id: string) => directory.slots.filter((s) => s.mentorId === id);
    expect(Object.fromEntries(MENTOR_IDS.map((id) => [id, sessionsOf(id).length]))).toEqual({
      "patrick-haddox": 3,
      "arnav-mishra": 3, // Fri 10:00–11:30 AM (exact since Sept 24)
      "vikram-lakhwara": 0,
      "elliott-notrica": 22, // Wed 9–12 (6) and 2–5 (6), Thu 12–5 (10) (exact since Sept 25)
      "ron-lewis": 4, // Thu 2:30–4:30 PM at BIF (exact since Sept 24)
      "rishab-veldur": 10,
    });
    expect(directory.slots).toHaveLength(42);
    // Elliott: each window on the 25-minute grid with 5-minute breaks; the last session starts at 11:30 or 4:30.
    const elliott = sessionsOf("elliott-notrica");
    for (const [windowId, , , , , count] of ELLIOTT_WINDOWS) {
      expect(elliott.filter((s) => s.windowId === windowId), windowId).toHaveLength(count);
    }
    expect(elliott.map((s) => [s.id, s.label])).toEqual([
      ["elliott-notrica-2026-09-30-am-0900", "Wed, Sep 30 · 9:00–9:25 AM CT"],
      ["elliott-notrica-2026-09-30-am-0930", "Wed, Sep 30 · 9:30–9:55 AM CT"],
      ["elliott-notrica-2026-09-30-am-1000", "Wed, Sep 30 · 10:00–10:25 AM CT"],
      ["elliott-notrica-2026-09-30-am-1030", "Wed, Sep 30 · 10:30–10:55 AM CT"],
      ["elliott-notrica-2026-09-30-am-1100", "Wed, Sep 30 · 11:00–11:25 AM CT"],
      ["elliott-notrica-2026-09-30-am-1130", "Wed, Sep 30 · 11:30–11:55 AM CT"],
      ["elliott-notrica-2026-09-30-pm-1400", "Wed, Sep 30 · 2:00–2:25 PM CT"],
      ["elliott-notrica-2026-09-30-pm-1430", "Wed, Sep 30 · 2:30–2:55 PM CT"],
      ["elliott-notrica-2026-09-30-pm-1500", "Wed, Sep 30 · 3:00–3:25 PM CT"],
      ["elliott-notrica-2026-09-30-pm-1530", "Wed, Sep 30 · 3:30–3:55 PM CT"],
      ["elliott-notrica-2026-09-30-pm-1600", "Wed, Sep 30 · 4:00–4:25 PM CT"],
      ["elliott-notrica-2026-09-30-pm-1630", "Wed, Sep 30 · 4:30–4:55 PM CT"],
      ["elliott-notrica-2026-10-01-pm-1200", "Thu, Oct 1 · 12:00–12:25 PM CT"],
      ["elliott-notrica-2026-10-01-pm-1230", "Thu, Oct 1 · 12:30–12:55 PM CT"],
      ["elliott-notrica-2026-10-01-pm-1300", "Thu, Oct 1 · 1:00–1:25 PM CT"],
      ["elliott-notrica-2026-10-01-pm-1330", "Thu, Oct 1 · 1:30–1:55 PM CT"],
      ["elliott-notrica-2026-10-01-pm-1400", "Thu, Oct 1 · 2:00–2:25 PM CT"],
      ["elliott-notrica-2026-10-01-pm-1430", "Thu, Oct 1 · 2:30–2:55 PM CT"],
      ["elliott-notrica-2026-10-01-pm-1500", "Thu, Oct 1 · 3:00–3:25 PM CT"],
      ["elliott-notrica-2026-10-01-pm-1530", "Thu, Oct 1 · 3:30–3:55 PM CT"],
      ["elliott-notrica-2026-10-01-pm-1600", "Thu, Oct 1 · 4:00–4:25 PM CT"],
      ["elliott-notrica-2026-10-01-pm-1630", "Thu, Oct 1 · 4:30–4:55 PM CT"],
    ]);
    // Nothing between his Wednesday windows (noon to 2 PM), and no location yet.
    expect(elliott.some((s) => s.date === "2026-09-30" && s.start >= "12:00" && s.start < "14:00")).toBe(false);
    expect(directory.slotsById.has("elliott-notrica-2026-09-30-am-1200")).toBe(false);
    expect(directory.slotsById.has("elliott-notrica-2026-10-01-pm-1700")).toBe(false);
    expect(elliott.every((s) => s.location === null && s.format === null && s.mentorFirstName === "Elliott")).toBe(true);
    expect(sessionsOf("patrick-haddox").map((s) => [s.id, s.label])).toEqual([
      ["patrick-haddox-2026-10-01-am-1000", "Thu, Oct 1 · 10:00–10:25 AM CT"],
      ["patrick-haddox-2026-10-01-am-1030", "Thu, Oct 1 · 10:30–10:55 AM CT"],
      ["patrick-haddox-2026-10-01-am-1100", "Thu, Oct 1 · 11:00–11:25 AM CT"],
    ]);
    expect(sessionsOf("arnav-mishra").map((s) => [s.id, s.label, s.windowId])).toEqual([
      ["arnav-mishra-2026-10-02-am-1000", "Fri, Oct 2 · 10:00–10:25 AM CT", "arnav-mishra-2026-10-02-am"],
      ["arnav-mishra-2026-10-02-am-1030", "Fri, Oct 2 · 10:30–10:55 AM CT", "arnav-mishra-2026-10-02-am"],
      ["arnav-mishra-2026-10-02-am-1100", "Fri, Oct 2 · 11:00–11:25 AM CT", "arnav-mishra-2026-10-02-am"],
    ]);
    // Ron's 2:30–4:30 window fits four sessions; the last one ends at 4:25, inside the window.
    expect(sessionsOf("ron-lewis").map((s) => [s.id, s.label, s.windowId])).toEqual([
      ["ron-lewis-2026-10-01-pm-1430", "Thu, Oct 1 · 2:30–2:55 PM CT", RON_WINDOW],
      ["ron-lewis-2026-10-01-pm-1500", "Thu, Oct 1 · 3:00–3:25 PM CT", RON_WINDOW],
      ["ron-lewis-2026-10-01-pm-1530", "Thu, Oct 1 · 3:30–3:55 PM CT", RON_WINDOW],
      ["ron-lewis-2026-10-01-pm-1600", "Thu, Oct 1 · 4:00–4:25 PM CT", RON_WINDOW],
    ]);
    expect(directory.slotsById.has("ron-lewis-2026-10-01-pm-1630")).toBe(false);
    // A part-of-day window (fixture) has no exact times, so no sessions yet.
    expect(build([roughMentor]).slots).toEqual([]);
    const rishab = sessionsOf("rishab-veldur");
    expect(rishab[0]).toEqual({
      id: "rishab-veldur-2026-10-01-1200",
      mentorId: "rishab-veldur",
      mentorName: "Rishab Veldur",
      mentorFirstName: "Rishab",
      windowId: RISHAB_WINDOW,
      date: "2026-10-01",
      start: "12:00",
      end: "12:25",
      capacity: 1,
      status: "confirmed",
      format: null,
      location: null,
      demo: false,
      generated: true,
      label: "Thu, Oct 1 · 12:00–12:25 PM CT",
    });
    expect(rishab.map((s) => s.label)).toEqual([
      "Thu, Oct 1 · 12:00–12:25 PM CT",
      "Thu, Oct 1 · 12:30–12:55 PM CT",
      "Thu, Oct 1 · 1:00–1:25 PM CT",
      "Thu, Oct 1 · 1:30–1:55 PM CT",
      "Thu, Oct 1 · 2:00–2:25 PM CT",
      "Thu, Oct 1 · 2:30–2:55 PM CT",
      "Thu, Oct 1 · 3:00–3:25 PM CT",
      "Thu, Oct 1 · 3:30–3:55 PM CT",
      "Thu, Oct 1 · 4:00–4:25 PM CT",
      "Thu, Oct 1 · 4:30–4:55 PM CT",
    ]);
    // One application (a student or a team) per session; the grid is Founders' rule inside a
    // window the mentor confirmed, so sessions can be confirmed.
    expect(directory.slots.every((s) => s.capacity === 1 && s.status === "confirmed" && s.generated)).toBe(true);
    expect(directory.slotsById.get("rishab-veldur-2026-10-01-1630")).toMatchObject({ start: "16:30", end: "16:55" });
    expect(directory.slotsById.has("rishab-veldur-2026-10-01-1700")).toBe(false);
    expect(directory.sessionRule).toEqual(RULE);

    // Explicit content slots (demo) stay explicit and win for their window.
    expect(fixtureDirectory.slots.filter((s) => s.mentorId === "demo-avery-sample").map((s) => [s.id, s.generated])).toEqual([
      ["demo-avery-slot-1400", false],
      ["demo-avery-slot-1430", false],
    ]);
    expect(fixtureDirectory.slots.filter((s) => s.mentorId === "demo-jordan-placeholder").map((s) => s.label)).toEqual([
      "Fri, Oct 2 · 3:00–3:25 PM CT",
    ]);

    // The rule is passed in: a different rule gives different sessions (the builder stays pure).
    const hourly = buildOrganizerDirectory(getMentorsForOrganizers(), { sessionMinutes: 55, breakMinutes: 5 });
    expect(hourly.slots.filter((s) => s.mentorId === "rishab-veldur")).toHaveLength(5);
    expect(hourly.slots.filter((s) => s.mentorId === "patrick-haddox").map((s) => s.label)).toEqual([
      "Thu, Oct 1 · 10:00–10:55 AM CT",
    ]);
    expect(hourly.slots.filter((s) => s.mentorId === "ron-lewis").map((s) => s.label)).toEqual([
      "Thu, Oct 1 · 2:30–3:25 PM CT",
      "Thu, Oct 1 · 3:30–4:25 PM CT",
    ]);
  });

  it("warns about a session count only when content sets one: nobody in production, a fixture Patrick with one or two", () => {
    // Patrick is open to all three sessions in his window, so he sets no count and gets no warning.
    const patrick = directory.mentorsById.get("patrick-haddox")!;
    expect(patrick.sessionCount).toBeNull();
    expect(patrick.organizerNotes).toContain(
      "Open to hosting all three 25-minute sessions in the Thu Oct 1, 10:00–11:30 AM window (10:00, 10:30, 11:00)",
    );
    expect(patrick.organizerNotes).not.toMatch(/one or two/i);
    expect(directory.slots.filter((s) => s.mentorId === "patrick-haddox")).toHaveLength(3);
    expect(sessionLimitNote(patrick, 3)).toBeNull();
    // Nobody in production has a count now.
    for (const m of directory.mentors) {
      expect(m.sessionCount, m.id).toBeNull();
      expect(sessionLimitNote(m, directory.slots.filter((s) => s.mentorId === m.id).length), m.id).toBeNull();
      expect(sessionLimitNote(m, 10), m.id).toBeNull();
    }

    // The warning stays for a mentor who agreed to fewer sessions than the window fits (fixture).
    const limited = build(withLimitedPatrick());
    const fixture = limited.mentorsById.get("patrick-haddox")!;
    expect(fixture.sessionCount).toBe("One or two sessions");
    expect(limited.slots.filter((s) => s.mentorId === "patrick-haddox")).toHaveLength(3);
    expect(sessionLimitNote(fixture, 3)).toBe(
      "Patrick is hosting one or two sessions, and 3 are listed. Only book as many as Patrick agreed to.",
    );
    expect(sessionLimitNote(fixture, 1)).toBe(
      "Patrick is hosting one or two sessions, and 1 is listed. Only book as many as Patrick agreed to.",
    );
    expect(sessionLimitNote(fixture, 0)).toBeNull();
    for (const m of limited.mentors.filter((x) => x.id !== "patrick-haddox")) {
      expect(sessionLimitNote(m, 10), m.id).toBeNull();
    }
  });

  it("never treats an event (Dan Caruso, Arnav's happy hour, Rishab's Showcase panel, the canceled afterparty) as a mentor, window, slot or option", () => {
    expect(events.some((e) => e.id === "dan-caruso-fireside-chat")).toBe(true);
    expect(events.some((e) => e.id === "happy-hour-at-legends-with-arnav-mishra")).toBe(true);
    expect(events.some((e) => e.id === "founders-week-afterparty")).toBe(false);
    // Rishab speaks on the Friday Showcase panel: a separate appearance, not office hours.
    expect(JSON.stringify(events)).toContain('"mentorId":"rishab-veldur"');
    const everything = JSON.stringify({
      // Organizer notes may mention events (Arnav's happy hour, Rishab's panel) as context; the
      // mentor, window, slot and option records themselves never do.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      mentors: directory.mentors.map(({ organizerNotes, ...m }) => m),
      slots: directory.slots,
      windows: directory.windows,
      catalog: buildApplicationCatalog(getMentorsForOrganizers()),
    });
    expect(everything).not.toMatch(/caruso|afterparty|happy hour|legends|HERE Apartments/i);
    expect(everything).not.toMatch(/Health Innovation|Therapeutics|Showcase|Conference Center/i);

    // A filter URL naming an event is dropped instead of silently filtering to nothing.
    for (const eventId of ["dan-caruso-fireside-chat", "happy-hour-at-legends-with-arnav-mishra", "founders-week-afterparty"]) {
      const filters = restrictToDirectory(
        parseApplicationFilters({ mentor: eventId, choice: "first", availability: `window:${eventId}` }),
        directory,
      );
      expect(filters, eventId).toEqual(DEFAULT_APPLICATION_FILTERS);
    }
    // Known ids survive.
    expect(
      restrictToDirectory(
        parseApplicationFilters({ mentor: "ron-lewis", availability: "window:patrick-haddox-2026-10-01-am" }),
        directory,
      ),
    ).toMatchObject({ mentor: "ron-lewis", availability: "window:patrick-haddox-2026-10-01-am" });
    expect(
      restrictToDirectory(parseApplicationFilters({ mentor: "ron-lewis", availability: `window:${RON_WINDOW}` }), directory),
    ).toEqual({ ...DEFAULT_APPLICATION_FILTERS, mentor: "ron-lewis", availability: `window:${RON_WINDOW}` });
    // Ron's openness to Oct 4 is organizer-only: there's no such window to filter by.
    expect(
      restrictToDirectory(parseApplicationFilters({ mentor: "ron-lewis", availability: "window:ron-lewis-2026-10-04" }), directory),
    ).toEqual({ ...DEFAULT_APPLICATION_FILTERS, mentor: "ron-lewis" });
    expect(
      restrictToDirectory(parseApplicationFilters({ mentor: "elliott-notrica", choice: "first" }), directory),
    ).toMatchObject({ mentor: "elliott-notrica", firstChoiceOnly: true });
    // Each of Elliott's windows is a filter now.
    for (const id of ELLIOTT_WINDOW_IDS) {
      expect(
        restrictToDirectory(parseApplicationFilters({ mentor: "elliott-notrica", availability: `window:${id}` }), directory),
      ).toEqual({ ...DEFAULT_APPLICATION_FILTERS, mentor: "elliott-notrica", availability: `window:${id}` });
    }
    expect(restrictToDirectory(parseApplicationFilters({ availability: "none" }), directory).availability).toBe("none");
    // Students pick windows, never generated sessions: a session isn't an availability filter.
    expect(
      restrictToDirectory(parseApplicationFilters({ availability: "slot:rishab-veldur-2026-10-01-1200" }), directory).availability,
    ).toBeNull();
    expect(
      restrictToDirectory(parseApplicationFilters({ availability: "slot:demo-avery-slot-1400" }), fixtureDirectory).availability,
    ).toBe("slot:demo-avery-slot-1400");
  });

  it("labels windows without repeating the weekday", () => {
    expect(directory.windowsById.get("patrick-haddox-2026-10-01-am")?.label).toBe("Thu, Oct 1 · 10:00–11:30 AM CT");
    expect(directory.windowsById.get("arnav-mishra-2026-10-02-am")?.label).toBe("Fri, Oct 2 · 10:00–11:30 AM CT");
    expect(directory.windowsById.get(RON_WINDOW)?.label).toBe(RON_LABEL);
    // A content label that already names the day (part-of-day fixture) isn't prefixed with it again.
    expect(build([roughMentor]).windowsById.get(ROUGH_WINDOW)?.label).toBe(
      "Oct 2 · Friday morning, before noon · Exact window pending",
    );
    // Rishab's window is exact now, in the same style as Patrick's.
    expect(directory.windowsById.get(RISHAB_WINDOW)?.label).toBe(RISHAB_LABEL);
    // Date set, time not (fixture mentor): the content label says so plainly, and the window is approximate.
    const withDateOnly = build([...getMentorsForOrganizers(), dateOnlyMentor]);
    expect(withDateOnly.windowsById.get(DATE_ONLY_WINDOW)).toEqual({
      id: DATE_ONLY_WINDOW,
      mentorId: "fixture-date-only",
      mentorName: "Dana Fixture",
      date: "2026-10-01",
      time: { kind: "tba" },
      kind: "window-approx",
      demo: false,
      label: DATE_ONLY_LABEL,
    });
    expect(withDateOnly.windowsById.get(DATE_ONLY_WINDOW)?.label).not.toMatch(/Time TBA|Time to be announced/);
    // Without a content label, the organizer label falls back to the compact "Time TBA".
    const unlabeled = build([
      { ...dateOnlyMentor, availability: [{ id: DATE_ONLY_WINDOW, date: "2026-10-01", time: { kind: "tba" } }] },
    ]);
    expect(unlabeled.windowsById.get(DATE_ONLY_WINDOW)?.label).toBe("Thu, Oct 1 · Time TBA");
  });

  it("offers Rishab's Oct 1 12:00–5:00 PM window as a timed option (no broad-availability note needed)", () => {
    const catalog = buildApplicationCatalog(getMentorsForOrganizers());
    expect(catalog.mentors.map((m) => m.id)).toEqual(MENTOR_IDS);
    const rishab = catalog.mentors.find((m) => m.id === "rishab-veldur")!;
    expect(rishab).toMatchObject({ name: "Rishab Veldur", firstName: "Rishab", affiliation: "Co-Founder & CEO, Auvi Labs", scheduling: "available", demo: false });
    expect(rishab.options).toEqual([
      {
        key: `window:${RISHAB_WINDOW}`,
        kind: "window",
        id: RISHAB_WINDOW,
        mentorId: "rishab-veldur",
        certainty: "window",
        date: "2026-10-01",
        label: RISHAB_LABEL,
        // Fallback wording only: the form shows lib/applications/option-presentation.ts copy.
        detail: "Availability window. Exact appointment times aren’t set yet.",
        timeKnown: true,
      },
    ]);
    expect(mentorNeedsBroadAvailability(rishab)).toBe(false);
    // Ron's Thu, Oct 1 2:30–4:30 PM window is timed too.
    const ron = catalog.mentors.find((m) => m.id === "ron-lewis")!;
    expect(ron).toMatchObject({ name: "Ron Lewis", firstName: "Ron", affiliation: "Co-Founder, Auctus Advisory", scheduling: "available", demo: false });
    expect(ron.options).toEqual([
      {
        key: `window:${RON_WINDOW}`,
        kind: "window",
        id: RON_WINDOW,
        mentorId: "ron-lewis",
        certainty: "window",
        date: "2026-10-01",
        label: RON_LABEL,
        detail: "Availability window. Exact appointment times aren’t set yet.",
        timeKnown: true,
      },
    ]);
    expect(mentorNeedsBroadAvailability(ron)).toBe(false);
    // Elliott's three windows are timed options too (students pick windows, never sessions).
    const elliott = catalog.mentors.find((m) => m.id === "elliott-notrica")!;
    expect(elliott).toMatchObject({ firstName: "Elliott", affiliation: "Founder & CEO, Symbio Bioculinary", scheduling: "available", demo: false });
    expect(elliott.options).toEqual(
      ELLIOTT_WINDOWS.map(([id, date, , , label]) => ({
        key: `window:${id}`,
        kind: "window",
        id,
        mentorId: "elliott-notrica",
        certainty: "window",
        date,
        label,
        detail: "Availability window. Exact appointment times aren’t set yet.",
        timeKnown: true,
      })),
    );
    expect(mentorNeedsBroadAvailability(elliott)).toBe(false);
    // Only Vik (no times yet) needs the broad-availability note.
    expect(catalog.mentors.filter(mentorNeedsBroadAvailability).map((m) => m.id)).toEqual(["vikram-lakhwara"]);
    expect(catalog.mentors.filter((m) => m.options.length === 0).map((m) => [m.id, m.scheduling])).toEqual([
      ["vikram-lakhwara", "in-progress"],
    ]);
  });

  it("offers a date-only window (fixture mentor) as an option that needs broad availability", () => {
    const catalog = buildApplicationCatalog([...getMentorsForOrganizers(), dateOnlyMentor]);
    expect(catalog.mentors.map((m) => m.id)).toEqual([...MENTOR_IDS, "fixture-date-only"]);
    const dana = catalog.mentors.find((m) => m.id === "fixture-date-only")!;
    expect(dana).toMatchObject({ name: "Dana Fixture", firstName: "Dana", affiliation: "Founder, Fixture Labs", scheduling: "available", demo: false });
    expect(dana.options).toEqual([
      {
        key: `window:${DATE_ONLY_WINDOW}`,
        kind: "window",
        id: DATE_ONLY_WINDOW,
        mentorId: "fixture-date-only",
        certainty: "window",
        date: "2026-10-01",
        label: DATE_ONLY_LABEL,
        detail: "Availability window. Exact times to be announced.",
        timeKnown: false,
      },
    ]);
    expect(mentorNeedsBroadAvailability(dana)).toBe(true);
    // Vik (no times) and the date-only mentor need the broad-availability note.
    expect(catalog.mentors.filter(mentorNeedsBroadAvailability).map((m) => m.id)).toEqual([
      "vikram-lakhwara",
      "fixture-date-only",
    ]);
  });

  it("explains which preferred mentors can't be booked yet", () => {
    const prefs = mentorBookability(directory, ["vikram-lakhwara", "elliott-notrica", "ron-lewis", "arnav-mishra", "patrick-haddox"]);
    // Only Vik is still scheduling; Elliott's three windows give him 22 sessions, Ron's Thu 2:30–4:30 window four.
    expect(prefs.map((p) => [p.firstName, p.slots.length, p.windows.length, p.scheduling])).toEqual([
      ["Vik", 0, 0, "in-progress"],
      ["Elliott", 22, 3, "available"],
      ["Ron", 4, 1, "available"],
      ["Arnav", 3, 1, "available"],
      ["Patrick", 3, 1, "available"],
    ]);
    expect(prefs.filter((p) => p.slots.length === 0).map((p) => p.firstName)).toEqual(["Vik"]);
    expect(prefs[1].windows.map((w) => [w.id, w.label, w.kind])).toEqual(
      ELLIOTT_WINDOWS.map(([id, , , , label]) => [id, label, "window"]),
    );
    expect(prefs[2].windows.map((w) => [w.id, w.label, w.kind])).toEqual([[RON_WINDOW, RON_LABEL, "window"]]);
    // A window without exact times (part-of-day fixture) has no sessions yet.
    const [riley] = mentorBookability(build([roughMentor]), ["fixture-rough"]);
    expect([riley.firstName, riley.slots.length, riley.windows.length, riley.scheduling]).toEqual(["Riley", 0, 1, "available"]);
    expect(joinNames(prefs.map((p) => p.firstName))).toBe("Vik, Elliott, Ron, Arnav and Patrick");
    expect(joinNames(["Vik", "Elliott"])).toBe("Vik and Elliott");
    // Rishab's confirmed window is split into ten bookable sessions.
    const [rishab] = mentorBookability(directory, ["rishab-veldur"]);
    expect(rishab).toMatchObject({ mentorId: "rishab-veldur", mentorName: "Rishab Veldur", firstName: "Rishab", scheduling: "available" });
    expect(rishab.slots).toHaveLength(10);
    expect(rishab.windows.map((w) => [w.id, w.label, w.kind])).toEqual([[RISHAB_WINDOW, RISHAB_LABEL, "window"]]);
    // A date-only mentor (fixture) has a window but nothing bookable.
    const [dana] = mentorBookability(build([dateOnlyMentor]), ["fixture-date-only"]);
    expect(dana).toMatchObject({ mentorId: "fixture-date-only", firstName: "Dana", scheduling: "available", slots: [] });
    expect(dana.windows.map((w) => [w.id, w.label, w.kind])).toEqual([[DATE_ONLY_WINDOW, DATE_ONLY_LABEL, "window-approx"]]);
    // With demo content, demo mentors keep their explicit slots.
    expect(mentorBookability(fixtureDirectory, ["demo-avery-sample"])[0].slots).toHaveLength(2);
    expect(mentorBookability(fixtureDirectory, ["rishab-veldur"])[0].slots).toHaveLength(10);
  });

  it("filters by mentor=rishab-veldur and his Oct 1 window, and drops an Oct 2 window he doesn't have", () => {
    const filters = restrictToDirectory(
      parseApplicationFilters(new URLSearchParams(`mentor=rishab-veldur&choice=first&availability=window:${RISHAB_WINDOW}`)),
      directory,
    );
    expect(filters).toEqual({
      ...DEFAULT_APPLICATION_FILTERS,
      mentor: "rishab-veldur",
      firstChoiceOnly: true,
      availability: `window:${RISHAB_WINDOW}`,
    });
    // He isn't available for office hours on Oct 2, so no such window exists to filter by.
    expect(
      restrictToDirectory(parseApplicationFilters({ mentor: "rishab-veldur", availability: "window:rishab-veldur-2026-10-02" }), directory),
    ).toEqual({ ...DEFAULT_APPLICATION_FILTERS, mentor: "rishab-veldur" });

    // The GET form reflects the filter: Rishab selected among six mentors, his window among the options.
    const html = renderToStaticMarkup(createElement(ApplicationFiltersForm, { filters, directory }));
    const mentorSelect = /<select id="f-mentor"[^>]*>([\s\S]*?)<\/select>/.exec(html)![1];
    expect([...mentorSelect.matchAll(/<option value="([^"]*)"/g)].map((m) => m[1])).toEqual(["", ...MENTOR_IDS]);
    expect(mentorSelect).toContain('<option value="rishab-veldur" selected="">Rishab Veldur</option>');
    expect(mentorSelect.match(/selected=""/g)).toHaveLength(1);
    const availabilitySelect = /<select id="f-availability"[^>]*>([\s\S]*?)<\/select>/.exec(html)![1];
    // Only mentors with published times get a group; Vik is still scheduling.
    expect([...availabilitySelect.matchAll(/<optgroup label="([^"]*)"/g)].map((m) => m[1])).toEqual([
      "Patrick Haddox",
      "Arnav Mishra",
      "Elliott Notrica",
      "Ron Lewis",
      "Rishab Veldur",
    ]);
    // Elliott's three windows, in order.
    expect(availabilitySelect).toContain(
      `<optgroup label="Elliott Notrica">${ELLIOTT_WINDOWS.map(([id, , , , label]) => `<option value="window:${id}">${label} (window)</option>`).join("")}</optgroup>`,
    );
    expect(availabilitySelect).toContain(
      `<optgroup label="Rishab Veldur"><option value="window:${RISHAB_WINDOW}" selected="">${RISHAB_LABEL} (window)</option></optgroup>`,
    );
    expect(availabilitySelect).toContain(
      `<optgroup label="Ron Lewis"><option value="window:${RON_WINDOW}">${RON_LABEL} (window)</option></optgroup>`,
    );
    expect(availabilitySelect).not.toMatch(/vikram-lakhwara/);
    expect(availabilitySelect).not.toContain("rishab-veldur-2026-10-02");
    // Generated sessions aren't what students choose, so they're never availability filters.
    expect(availabilitySelect).not.toContain("slot:");
    expect(availabilitySelect).not.toContain("12:00–12:25");
    expect(html).toContain('href="/organizers"'); // "Clear filters"

    // A date-only window (fixture mentor) is offered the same way, with its date-only label.
    const withDateOnly = build([...getMentorsForOrganizers(), dateOnlyMentor]);
    const dateOnlyFilters = restrictToDirectory(parseApplicationFilters({ availability: `window:${DATE_ONLY_WINDOW}` }), withDateOnly);
    expect(dateOnlyFilters).toEqual({ ...DEFAULT_APPLICATION_FILTERS, availability: `window:${DATE_ONLY_WINDOW}` });
    const fixtureHtml = renderToStaticMarkup(createElement(ApplicationFiltersForm, { filters: dateOnlyFilters, directory: withDateOnly }));
    expect(fixtureHtml).toContain(
      `<optgroup label="Dana Fixture"><option value="window:${DATE_ONLY_WINDOW}" selected="">${DATE_ONLY_LABEL} (window)</option></optgroup>`,
    );
  });
});

describe("mentor notes (organizer-only)", () => {
  it("keeps organizer notes and drafts out of public mentor data", () => {
    const publicMentors = JSON.stringify(getMentors());
    expect(publicMentors).not.toContain("not available slots");
    expect(publicMentors).not.toContain("Wednesday through Saturday");
    expect(publicMentors).not.toContain("commitments");
    // Ron's draft topics (his approved highlight "Revenue strategy and optimization" is public).
    expect(publicMentors).not.toContain('"Revenue strategy"');
    expect(publicMentors).not.toContain("Startup financial planning");
    expect(publicMentors).not.toContain("Communicating business progress to stakeholders");
    // Elliott's email and the session total organizers set from it.
    expect(publicMentors).not.toMatch(/From his email|anytime after 9 AM|Organizers set his windows|22 sessions/);
    const organizer = getMentorsForOrganizers();
    expect(organizer.map((m) => m.id)).toEqual(MENTOR_IDS);
    expect(organizer.every((m) => Boolean(m.organizerNotes))).toBe(true);
    for (const m of organizer) expect(publicMentors).not.toContain(m.organizerNotes!);
    expect(getMentors().map((m) => m.id)).toEqual(MENTOR_IDS);
    expect(getMentors().some((m) => "organizerNotes" in m)).toBe(false);
  });

  it("keeps Ron's openness to Oct 4 organizer-only; students see his Thu, Oct 1 2:30–4:30 PM window at BIF", () => {
    const ron = getMentorsForOrganizers().find((m) => m.id === "ron-lewis")!;
    expect(ron.organizerNotes).toContain("He’s also open to Oct 4");
    expect(ron.organizerNotes).toContain("nothing about Oct 4 is published yet");
    const publicRon = getMentors().find((m) => m.id === "ron-lewis")!;
    expect(publicRon).not.toHaveProperty("organizerNotes");
    expect(JSON.stringify(getMentors())).not.toMatch(/Oct(ober)?\.? 4\b|2026-10-04|Sunday/);
    expect(publicRon.availability).toEqual([
      {
        id: RON_WINDOW,
        date: "2026-10-01",
        time: { kind: "exact", start: "14:30", end: "16:30" },
        note: "Ron is free during this window, but it isn’t a booked appointment. We’ll schedule sessions inside it.",
      },
    ]);
    expect(publicRon.slots).toEqual([]);
    expect(publicRon.session).toMatchObject({
      format: "in-person",
      location: "Business Instructional Facility (BIF)",
      address: "515 E. Gregory Drive, Champaign, IL 61820",
      sessionCount: null,
      confirmed: true,
      note: "Ron is holding office hours on Thursday, October 1, from 2:30 to 4:30 PM at the Business Instructional Facility (BIF).",
    });
  });

  it("keeps Rishab's email details (team preference, Oct 2, phone number) organizer-only", () => {
    const rishab = getMentorsForOrganizers().find((m) => m.id === "rishab-veldur")!;
    expect(rishab.organizerNotes).toContain(
      "he’d like to meet student teams (a preference, not an eligibility rule; individuals can apply)",
    );
    expect(rishab.organizerNotes).toContain("only has time for office hours on Thu Oct 1");
    expect(rishab.organizerNotes).toContain("Window locked for Thu Oct 1, anytime 12–5 PM (organizer update, Sept 24).");
    expect(rishab.organizerNotes).toContain("Keep the phone number from his email signature off the site.");
    const publicMentor = getMentors().find((m) => m.id === "rishab-veldur")!;
    expect(publicMentor).not.toHaveProperty("organizerNotes");
    const publicRishab = JSON.stringify(publicMentor);
    expect(publicRishab).not.toMatch(/student teams|eligibility|phone number|signature|Oct 1 and 2|capacity|locked/i);
    // Students see one window, Thu, Oct 1 from noon to 5 PM (no label override), never Oct 2.
    expect(publicMentor.availability).toEqual([
      {
        id: RISHAB_WINDOW,
        date: "2026-10-01",
        time: { kind: "exact", start: "12:00", end: "17:00" },
        note: "Rishab is free anytime during this window, from noon to 5 PM, but it isn’t a booked appointment. We’ll schedule sessions inside it.",
      },
    ]);
    expect(publicMentor.slots).toEqual([]);
    // The copy students read makes no regulatory, commercial, clinical or one-on-one claims.
    const studentFacing = JSON.stringify([
      publicMentor.bio?.value,
      publicMentor.goodFitFor?.value,
      publicMentor.backgroundTags,
      publicMentor.session.note,
      publicMentor.availability.map((w) => [w.label, w.note]),
    ]);
    expect(studentFacing).not.toMatch(/FDA|approved|cleared|commercially available|clinically proven|one-on-one|1:1/i);
  });

  it("shows Rishab's organizer notes, his Oct 1 12:00–5:00 PM window and what's still missing", () => {
    const rishab = getMentorsForOrganizers().find((m) => m.id === "rishab-veldur")!;
    const html = renderToStaticMarkup(createElement(MentorNotes, { mentors: [rishab], sessionRule: RULE }));
    const t = text(html);
    expect(t).toContain("Rishab Veldur Co-Founder & CEO · Auvi Labs");
    expect(imageAlts(html)).toEqual(["Rishab Veldur"]);
    // Scheduling: one exact window with the "Availability window" badge, split into ten sessions; never Oct 2.
    expect(t).toContain(`Scheduling ${RISHAB_LABEL} Availability window 10 sessions (see Sessions). ${rishab.session.note}`);
    expect(sessionsSummary(rishab, RULE)).toBe("10 sessions (see Sessions).");
    expect(rishab.session.note).toMatch(/Thursday, October 1, anytime from noon to 5 PM/);
    expect(t).not.toContain("Exact times TBA");
    expect(t).not.toContain("Exact time to be confirmed");
    expect(t).not.toContain("Scheduling in progress");
    expect(t).not.toMatch(/Fri, Oct 2 ·|Oct 2 · /);
    // Organizer-only notes, shown in full with the lock.
    expect(t).toContain(`Organizer notes ${rishab.organizerNotes}`);
    // His approved copy needs no approval; the public preview shows the approved bio only.
    expect(mentorDrafts(rishab)).toEqual([]);
    expect(t).not.toContain("Awaiting approval");
    expect(t).toContain(`Public profile Show what students see Hide what students see ${rishab.bio!.value}`);
    expect(t).not.toContain("Basis (internal):");
    // No approved topic list and no confirmed session format yet.
    expect(mentorMissing(rishab)).toEqual(["Topics from the mentor", "Session format, length & location"]);
    expect(t).toContain("Not yet provided Topics from the mentor Session format, length & location");
    // Links: his applications, his public profile, and the application with him preselected.
    expect(html).toContain('href="/organizers?mentor=rishab-veldur"');
    expect(t).toContain("Applications listing Rishab");
    expect(html).toContain('href="/office-hours/rishab-veldur"');
    expect(html).toContain('href="/office-hours?mentor=rishab-veldur#apply"');
    expect(t).toContain("Application with Rishab preselected");
    expect(html).not.toMatch(/href="\/apply/);
  });

  it("shows a date-only window (fixture mentor) with the \"Exact times TBA\" badge", () => {
    const html = renderToStaticMarkup(createElement(MentorNotes, { mentors: [dateOnlyMentor], sessionRule: RULE }));
    const t = text(html);
    expect(t).toContain("Dana Fixture Founder · Fixture Labs");
    expect(t).toContain(
      `Scheduling ${DATE_ONLY_LABEL} Exact times TBA No sessions yet. A window becomes sessions once it has exact start and end times. ${dateOnlyMentor.session.note}`,
    );
    expect(t).not.toContain("Availability window");
    expect(t).not.toContain("Scheduling in progress");
    expect(t).toContain(`Organizer notes ${dateOnlyMentor.organizerNotes}`);
  });

  it("shows every mentor's organizer notes, Ron's draft topics and what's still missing", () => {
    const mentors = getMentorsForOrganizers();
    const html = renderToStaticMarkup(createElement(MentorNotes, { mentors, sessionRule: RULE }));
    const t = text(html);
    expect(productionMentors.map((m) => m.id)).toEqual(MENTOR_IDS);
    for (const m of productionMentors) {
      expect(t).toContain(m.name);
      expect(t).toContain(m.organizerNotes!);
    }
    // No decorative numbering ("01 / 06") — mentors are listed by name.
    expect(t).not.toMatch(/\b0\d \/ 0\d\b/);
    // Vik's existing commitments are constraints, not availability.
    expect(t).toMatch(/these are not available slots/i);
    // What Elliott said in his email and the windows organizers set from it: organizers see that, students don't.
    const elliott = mentors.find((m) => m.id === "elliott-notrica")!;
    expect(elliott.organizerNotes).toMatch(
      /^From his email \(Sept 25\): available anytime after 9 AM on Sept 30, or noon to 5 PM on Oct 1\. Organizers set his windows /,
    );
    expect(t).toContain(`Organizer notes ${elliott.organizerNotes}`);
    expect(elliott.session.note).toBe(
      "Elliott is holding office hours on Wednesday, September 30 (9 AM to noon and 2 to 5 PM) and Thursday, October 1 (noon to 5 PM). We’re still setting the location.",
    );
    // Elliott: three exact windows, each with the "Availability window" badge, 22 sessions in all.
    expect(sessionsSummary(elliott, RULE)).toBe("22 sessions (see Sessions).");
    expect(t).toContain(
      `Scheduling ${ELLIOTT_WINDOWS.map(([, , , , label]) => `${label} Availability window`).join(" ")} 22 sessions (see Sessions). ${elliott.session.note}`,
    );
    // Ron's suggested topics are the only drafts awaiting confirmation.
    const ron = mentors.find((m) => m.id === "ron-lewis")!;
    expect(mentorDrafts(ron).map((d) => d.label)).toEqual(["Ask me about"]);
    for (const m of mentors.filter((x) => x.id !== "ron-lewis")) expect(mentorDrafts(m), m.id).toEqual([]);
    for (const topic of ron.askMeAbout!.value) expect(t).toContain(topic);
    // Approved expertise: organizers see the internal basis, clearly marked as never public.
    expect(t).toContain("Basis (internal):");
    expect(t).toContain("Students only see the expertise labels, never the basis.");
    expect(t.match(/Hidden on the public site until marked approved/g)).toHaveLength(1);
    expect(t).toContain("Draft");
    // Only Vik is still scheduling; Patrick, Arnav, Elliott, Ron and Rishab have exact windows, each
    // split into sessions (Patrick 3, Arnav 3, Elliott 22, Ron 4, Rishab 10).
    expect(html.match(/>Scheduling in progress</g)).toHaveLength(1);
    expect(t.match(/\b3 sessions \(see Sessions\)\./g)).toHaveLength(2);
    expect(t.match(/\b4 sessions \(see Sessions\)\./g)).toHaveLength(1);
    expect(t.match(/\b10 sessions \(see Sessions\)\./g)).toHaveLength(1);
    expect(t.match(/\b22 sessions \(see Sessions\)\./g)).toHaveLength(1);
    expect(t).not.toContain("No sessions yet");
    // Ron: his Thu, Oct 1 window at BIF with the "Availability window" badge, split into four sessions.
    expect(sessionsSummary(ron, RULE)).toBe("4 sessions (see Sessions).");
    expect(t).toContain(`Scheduling ${RON_LABEL} Availability window 4 sessions (see Sessions). ${ron.session.note}`);
    expect(ron.session.note).toBe(
      "Ron is holding office hours on Thursday, October 1, from 2:30 to 4:30 PM at the Business Instructional Facility (BIF).",
    );
    // A rough window (part-of-day fixture) still explains why it has none.
    expect(text(renderToStaticMarkup(createElement(MentorNotes, { mentors: [roughMentor], sessionRule: RULE })))).toContain(
      "No sessions yet. A window becomes sessions once it has exact start and end times.",
    );
    expect(t).not.toContain("appointment slot");
    // Missing details are honest: every title is verified and every headshot supplied now.
    const missing = (id: string) => mentorMissing(mentors.find((m) => m.id === id)!);
    expect(missing("vikram-lakhwara")).toEqual(["Topics from the mentor", "Session format, length & location"]);
    expect(missing("elliott-notrica")).toEqual(["Topics from the mentor", "Session format, length & location"]);
    // Ron's format, length and BIF location are confirmed; only his topics await approval (drafts).
    expect(missing("ron-lewis")).toEqual([]);
    expect(missing("rishab-veldur")).toEqual(["Topics from the mentor", "Session format, length & location"]);
    expect(t).not.toContain("Title not verified");
    expect(t).not.toContain("Company not verified");
    expect(t).not.toContain("Title (unverified, so hidden)");
    expect(t).not.toContain("Headshot (initials portrait shown)");
    // Links go to the application section on the Office Hours page — never /apply.
    expect(html).toContain('href="/office-hours?mentor=ron-lewis#apply"');
    expect(html).toContain('href="/office-hours?mentor=elliott-notrica#apply"');
    expect(html).toContain('href="/office-hours?mentor=rishab-veldur#apply"');
    expect(html).toContain('href="/office-hours/vikram-lakhwara"');
    expect(html).toContain('href="/office-hours/elliott-notrica"');
    expect(html).toContain('href="/office-hours/rishab-veldur"');
    expect(html).toContain('href="/organizers?mentor=elliott-notrica"');
    expect(html).toContain('href="/organizers?mentor=rishab-veldur"');
    expect(html).not.toMatch(/href="\/apply/);
    // Headshots (alt = name) rather than generated initials, in content order; no event appears.
    expect(imageAlts(html)).toEqual(productionMentors.map((m) => m.name));
    expect(imageAlts(html)).toHaveLength(6);
    expect(html).not.toContain('viewBox="0 0 100 125"');
    expect(t).not.toMatch(/caruso/i);
  });

  it("the mentor lineup shows all six mentors, three across, with demand and scheduling state", () => {
    const directory = build(getMentorsForOrganizers());
    const html = renderToStaticMarkup(
      createElement(MentorLineup, {
        directory,
        interest: new Map([["ron-lewis", { any: 5, first: 2 }]]),
        usage: new Map([
          ["rishab-veldur-2026-10-01-1200", { proposed: 1, confirmed: 0 }],
          ["rishab-veldur-2026-10-01-1230", { proposed: 0, confirmed: 1 }],
        ]),
        filters: { ...DEFAULT_APPLICATION_FILTERS, mentor: "ron-lewis" },
      }),
    );
    const t = text(html);
    for (const m of productionMentors) expect(t).toContain(m.name);
    expect(imageAlts(html)).toEqual(productionMentors.map((m) => m.name));
    expect(html.match(/<li>/g)).toHaveLength(6);
    // Ron (the active filter): his demand, his Thu 2:30–4:30 window and four sessions.
    expect(t).toContain(
      "Ron Lewis 5 interested · 2 first choice Thu, Oct 1 · 2:30–4:30 PM 4 sessions · 0/4 booked (filtering by this mentor; select to show all mentors)",
    );
    // Only Vik is still scheduling.
    expect(t.match(/Scheduling in progress/g)).toHaveLength(1);
    expect(t).toContain("Vikram “Vik” Lakhwara 0 interested · 0 first choice Scheduling in progress");
    // Elliott: all three windows and 22 sessions.
    expect(t).toContain(
      "Elliott Notrica 0 interested · 0 first choice Wed, Sep 30 · 9:00 AM–12:00 PM · Wed, Sep 30 · 2:00–5:00 PM · Thu, Oct 1 · 12:00–5:00 PM 22 sessions · 0/22 booked (show applications that list this mentor)",
    );
    // Patrick: his window and three sessions, all open to booking (he sets no session count).
    expect(t).toContain(
      "Patrick Haddox 0 interested · 0 first choice Thu, Oct 1 · 10:00–11:30 AM 3 sessions · 0/3 booked (show applications that list this mentor)",
    );
    // Arnav: his exact Friday window, three sessions (no session count of his own, so no limit note).
    expect(t).toContain(
      "Arnav Mishra 0 interested · 0 first choice Fri, Oct 2 · 10:00–11:30 AM 3 sessions · 0/3 booked (show applications that list this mentor)",
    );
    // Nobody in production sets a session count, so no card says who's "hosting" how many.
    expect(t).not.toMatch(/\bhosting\b/i);
    expect(t).not.toContain("No sessions yet");
    // Rishab: his confirmed window, in the same compact form as Patrick's, and two sessions booked.
    expect(t).toContain(
      "Rishab Veldur 0 interested · 0 first choice Thu, Oct 1 · 12:00–5:00 PM 10 sessions · 2/10 booked (show applications that list this mentor)",
    );
    expect(t).not.toContain("Time TBA");
    expect(html).toContain('href="/organizers?mentor=elliott-notrica"');
    expect(html).toContain('href="/organizers?mentor=rishab-veldur"');
    // The active mentor links back to all mentors; the others filter.
    expect(html).toContain('href="/organizers"');
    expect(html).toContain('href="/organizers?mentor=patrick-haddox"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    // Six mentors balance as two rows of three on desktop (never 5 + 1), with no index numbers.
    expect(html).toContain('<ul class="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">');
    expect(html).not.toMatch(/lg:grid-cols-[245]/);
    // Portrait-over-text cards are only for a single row of five.
    expect(html).not.toContain("lg:flex-col");
    expect(t).not.toMatch(/\b0[1-6]\b/);
  });

  it("the mentor lineup says how many sessions a mentor agreed to host (fixture Patrick: one or two), once", () => {
    const html = renderToStaticMarkup(
      createElement(MentorLineup, {
        directory: build(withLimitedPatrick()),
        interest: new Map(),
        usage: new Map([["patrick-haddox-2026-10-01-am-1000", { proposed: 0, confirmed: 1 }]]),
        filters: DEFAULT_APPLICATION_FILTERS,
      }),
    );
    const t = text(html);
    expect(html.match(/<li>/g)).toHaveLength(6);
    expect(t).toContain(
      "Patrick Haddox 0 interested · 0 first choice Thu, Oct 1 · 10:00–11:30 AM 3 sessions · 1/3 booked · hosting one or two sessions (show applications that list this mentor)",
    );
    expect(t.match(/\bhosting\b/gi)).toHaveLength(1);
  });

  it("marks Rishab's card as the active filter and keeps the other filters in every link", () => {
    const directory = build(getMentorsForOrganizers());
    const html = renderToStaticMarkup(
      createElement(MentorLineup, {
        directory,
        interest: new Map([
          ["rishab-veldur", { any: 2, first: 1 }],
          ["patrick-haddox", { any: 1, first: 0 }],
        ]),
        usage: new Map(),
        filters: { ...DEFAULT_APPLICATION_FILTERS, mentor: "rishab-veldur", firstChoiceOnly: true, status: "submitted" },
      }),
    );
    const t = text(html);
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    // Selecting the active card again clears the mentor (and first-choice) filter, keeping status.
    expect(html).toMatch(/<a aria-current="true" class="[^"]*border-accent bg-accent-soft[^"]*" href="\/organizers\?status=submitted">/);
    expect(t).toContain(
      "Rishab Veldur 2 interested · 1 first choice Thu, Oct 1 · 12:00–5:00 PM 10 sessions · 0/10 booked (filtering by this mentor; select to show all mentors)",
    );
    expect(t).toContain("Patrick Haddox 1 interested · 0 first choice");
    // The other five cards filter by their mentor (any preference), keeping status.
    expect([...html.matchAll(/href="(\/organizers\?mentor=[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"))).toEqual(
      MENTOR_IDS.filter((id) => id !== "rishab-veldur").map((id) => `/organizers?mentor=${id}&status=submitted`),
    );
  });

  it("the mentor lineup shows a date-only mentor (fixture) with the compact \"Time TBA\" wording", () => {
    const directory = build([...getMentorsForOrganizers(), dateOnlyMentor]);
    const html = renderToStaticMarkup(
      createElement(MentorLineup, {
        directory,
        interest: new Map([["fixture-date-only", { any: 1, first: 1 }]]),
        usage: new Map(),
        filters: DEFAULT_APPLICATION_FILTERS,
      }),
    );
    const t = text(html);
    expect(html.match(/<li>/g)).toHaveLength(7);
    expect(t).toContain(
      "Dana Fixture 1 interested · 1 first choice Thu, Oct 1 · Time TBA No sessions yet (show applications that list this mentor)",
    );
    expect(t.match(/Time TBA/g)).toHaveLength(1);
    expect(t).toContain(
      "Rishab Veldur 0 interested · 0 first choice Thu, Oct 1 · 12:00–5:00 PM 10 sessions · 0/10 booked (show applications that list this mentor)",
    );
    expect(html).toContain('href="/organizers?mentor=fixture-date-only"');
  });

  it("chooses a desktop column count that keeps the lineup's rows full", () => {
    expect([1, 2, 3, 4, 5].map(lineupColumns)).toEqual([2, 2, 3, 4, 5]);
    // Six production mentors → three across (two full rows), never 5 + 1.
    expect(lineupColumns(productionMentors.length)).toBe(3);
    expect(lineupColumns(6)).toBe(3);
    expect(lineupColumns(7)).toBe(4);
    expect(lineupColumns(8)).toBe(4);
    expect(lineupColumns(9)).toBe(3);
    expect(lineupColumns(10)).toBe(5);
    // Six production + two demo mentors = eight → four across.
    expect(fixtureDirectory.mentors).toHaveLength(8);
    expect(lineupColumns(fixtureDirectory.mentors.length)).toBe(4);
    // Same balancing rule as the public lineups (lib/columns.ts) for any real lineup size.
    for (let n = 2; n <= 12; n++) expect(lineupColumns(n), String(n)).toBe(balancedColumns(n));
  });
});

describe("sessions board and assign options", () => {
  const directory = build(getMentorsForOrganizers());
  const NADIA_APP = "0b5c7b8e-6f1e-4a8e-9a57-0c1f5f1e2d3a";

  it("lists Patrick's, Arnav's, Elliott's, Ron's and Rishab's sessions under their windows, with who holds each seat", () => {
    const html = renderToStaticMarkup(
      createElement(SlotBoard, {
        directory,
        usage: new Map([
          ["patrick-haddox-2026-10-01-am-1000", { proposed: 0, confirmed: 1 }],
          ["rishab-veldur-2026-10-01-1200", { proposed: 1, confirmed: 0 }],
        ]),
        holders: new Map([
          [
            "rishab-veldur-2026-10-01-1200",
            [{ appointmentId: "ap-1", applicationId: NADIA_APP, fullName: "Nadia Brooks", teamName: "PulseFit", status: "proposed" as const }],
          ],
        ]),
      }),
    );
    const t = text(html);
    // Only mentors with sessions get a group, in content order.
    expect([...html.matchAll(/<h3 id="slots-([^"]+)"/g)].map((m) => m[1])).toEqual([
      "patrick-haddox",
      "arnav-mishra",
      "elliott-notrica",
      "ron-lewis",
      "rishab-veldur",
    ]);
    expect(html).not.toMatch(/slots-vikram-lakhwara/);
    // Elliott: three windows (6, 6 and 10 sessions), each with its own filter link.
    expect(t).toContain(
      `Elliott Notrica Founder & CEO, Symbio Bioculinary 0 of 22 sessions booked ${ELLIOTT_WINDOWS[0][4]} window · 6 sessions Applications that chose this window Wed, Sep 30 · 9:00–9:25 AM CT Confirmed slot 0/1 seat used (0 confirmed, 0 proposed) 1 open`,
    );
    for (const [id, , , , label, count] of ELLIOTT_WINDOWS) {
      expect(t).toContain(`${label} window · ${count} sessions Applications that chose this window`);
      expect(html).toContain(`href="/organizers?availability=window%3A${id}"`);
    }
    expect(t).toContain("Wed, Sep 30 · 11:30–11:55 AM CT Confirmed slot 0/1 seat used (0 confirmed, 0 proposed) 1 open Wed, Sep 30 · 2:00–5:00 PM CT window");
    expect(t).toContain("Wed, Sep 30 · 4:30–4:55 PM CT Confirmed slot 0/1 seat used (0 confirmed, 0 proposed) 1 open Thu, Oct 1 · 12:00–5:00 PM CT window");
    expect(t).toContain("Ron Lewis Co-Founder, Auctus Advisory 0 of 4 sessions booked");
    expect(t).toContain(`${RON_LABEL} window · 4 sessions Applications that chose this window`);
    expect(html).toContain(`href="/organizers?availability=window%3A${RON_WINDOW}"`);
    for (const time of ["2:30–2:55 PM", "3:00–3:25 PM", "3:30–3:55 PM", "4:00–4:25 PM"]) expect(t).toContain(`Thu, Oct 1 · ${time} CT`);
    expect(t).toContain("Thu, Oct 1 · 4:00–4:25 PM CT Confirmed slot 0/1 seat used (0 confirmed, 0 proposed) 1 open");
    expect(t).toContain("Arnav Mishra Co-Founder & CTO, Doss 0 of 3 sessions booked");
    expect(t).toContain("Fri, Oct 2 · 10:00–11:30 AM CT window · 3 sessions Applications that chose this window");
    expect(html).toContain('href="/organizers?availability=window%3Aarnav-mishra-2026-10-02-am"');
    for (const time of ["10:00–10:25 AM", "10:30–10:55 AM", "11:00–11:25 AM"]) expect(t).toContain(`Fri, Oct 2 · ${time} CT`);
    expect(t).toContain("Patrick Haddox CEO & Co-Founder, Samara Aerospace 1 of 3 sessions booked");
    expect(t).toContain("Thu, Oct 1 · 10:00–11:30 AM CT window · 3 sessions Applications that chose this window");
    expect(html).toContain('href="/organizers?availability=window%3Apatrick-haddox-2026-10-01-am"');
    for (const time of ["10:00–10:25 AM", "10:30–10:55 AM", "11:00–11:25 AM"]) expect(t).toContain(`Thu, Oct 1 · ${time} CT`);
    expect(t).toContain("Rishab Veldur Co-Founder & CEO, Auvi Labs 1 of 10 sessions booked");
    expect(t).toContain(`${RISHAB_LABEL} window · 10 sessions Applications that chose this window`);
    expect(t).toContain(
      "Thu, Oct 1 · 12:00–12:25 PM CT Nadia Brooks Team PulseFit Proposed, awaiting confirmation Confirmed slot 1/1 seat used (0 confirmed, 1 proposed) Full",
    );
    expect(t).toContain("Thu, Oct 1 · 4:30–4:55 PM CT Confirmed slot 0/1 seat used (0 confirmed, 0 proposed) 1 open");
    expect(html).toContain(`href="/organizers/applications/${NADIA_APP}"`);
    // Students pick windows, so a generated session isn't a filter link.
    expect(html).not.toContain("availability=slot");
    // The rule is stated once, in the section lede on the page, not per mentor or row.
    expect(t).not.toContain(RULE_TEXT);
    expect(t).not.toContain("—");
  });

  it("shows no session-limit warning for Patrick (open to all three sessions) or anyone else in production", () => {
    const patrick = getMentorsForOrganizers().find((m) => m.id === "patrick-haddox")!;
    const html = renderToStaticMarkup(
      createElement(SlotBoard, {
        directory,
        usage: new Map([["patrick-haddox-2026-10-01-am-1030", { proposed: 1, confirmed: 0 }]]),
      }),
    );
    const t = text(html);
    // His header goes straight to his window and its three sessions.
    expect(t).toContain(
      "Patrick Haddox CEO & Co-Founder, Samara Aerospace 1 of 3 sessions booked Thu, Oct 1 · 10:00–11:30 AM CT window · 3 sessions Applications that chose this window",
    );
    expect(t).not.toContain("Only book as many as");
    expect(t).not.toContain("Booked so far");
    expect(t).not.toMatch(/\bhosting\b/i);
    // The organizer note only rides along with a warning, so none shows here.
    expect(t).not.toContain("Organizer note:");
    expect(t).not.toContain(patrick.organizerNotes!);
  });

  it("puts a fixture Patrick's one-or-two-sessions note, and his organizer note, right above his sessions", () => {
    const html = renderToStaticMarkup(
      createElement(SlotBoard, {
        directory: build(withLimitedPatrick()),
        usage: new Map([["patrick-haddox-2026-10-01-am-1030", { proposed: 1, confirmed: 0 }]]),
      }),
    );
    const t = text(html);
    expect(t).toContain(
      "Patrick Haddox CEO & Co-Founder, Samara Aerospace 1 of 3 sessions booked " +
        "Patrick is hosting one or two sessions, and 3 are listed. Only book as many as Patrick agreed to. Booked so far: 1. " +
        `Organizer note: ${limitedPatrick.organizerNotes} Thu, Oct 1 · 10:00–11:30 AM CT window · 3 sessions`,
    );
    // Nobody else agreed to a session count, so nobody else gets the warning.
    expect(t.match(/Only book as many as/g)).toHaveLength(1);
    expect(t.match(/Organizer note:/g)).toHaveLength(1);
  });

  it("explains how sessions appear when there are none", () => {
    const withoutExact = getMentorsForOrganizers().filter((m) => m.availability.every((w) => w.time.kind !== "exact"));
    // Only Vik has no exact window now.
    expect(withoutExact.map((m) => m.id)).toEqual(["vikram-lakhwara"]);
    const t = text(renderToStaticMarkup(createElement(SlotBoard, { directory: build(withoutExact), usage: new Map() })));
    expect(t).toContain("No sessions yet");
    // (text() turns the <code> tag around the file name into spaces.)
    expect(t).toContain("Once a mentor has a window with exact start and end times in content/mentors.ts , it’s split into sessions automatically.");
  });

  it("labels assign options by session time and seats (explicit slots also say Confirmed or Proposed)", () => {
    const rishab1200 = directory.slotsById.get("rishab-veldur-2026-10-01-1200")!;
    const option = { slotId: rishab1200.id, label: rishab1200.label, status: rishab1200.status, capacity: 1, used: 0, generated: true, disabledReason: null };
    expect(assignOptionText(option)).toBe("Thu, Oct 1 · 12:00–12:25 PM CT · 1 of 1 open");
    expect(assignOptionText({ ...option, used: 1, disabledReason: "Full (1/1)" })).toBe("Thu, Oct 1 · 12:00–12:25 PM CT · Full (1/1)");
    const avery = fixtureDirectory.slotsById.get("demo-avery-slot-1430")!;
    expect(
      assignOptionText({ slotId: avery.id, label: avery.label, status: avery.status, capacity: 2, used: 1, generated: false, disabledReason: null }),
    ).toBe("Thu, Oct 1 · 2:30–2:55 PM CT · Confirmed · 1 of 2 open");
  });
});

describe("data store indicator", () => {
  const checkedAt = "2026-09-23T20:00:00.000Z";

  it("labels live Postgres/Supabase, local PGlite and disconnected states", () => {
    expect(
      describeDataStore({ persistence: { ready: true, kind: "postgres" }, provider: "supabase", schema: "0001_init", showHints: true, checkedAt }),
    ).toMatchObject({ state: "live", provider: "Supabase · Postgres", headline: "Live database connected", schema: "0001_init", hint: null });
    expect(
      describeDataStore({ persistence: { ready: true, kind: "postgres" }, provider: "postgres", schema: "0001_init", showHints: true, checkedAt }),
    ).toMatchObject({ state: "live", provider: "Postgres" });
    expect(
      describeDataStore({ persistence: { ready: true, kind: "pglite" }, provider: "pglite", schema: "0001_init", showHints: true, checkedAt }),
    ).toMatchObject({ state: "local", provider: "PGlite · local file" });
    const down = describeDataStore({
      persistence: { ready: false, reason: "unreachable", detail: "Could not connect: postgres://admin:hunter2@db.abc.supabase.co:5432/postgres" },
      provider: "supabase",
      schema: "0001_init",
      showHints: true,
      checkedAt,
    });
    expect(down).toMatchObject({ state: "down", headline: "Database not connected", schema: null });
    expect(JSON.stringify(down)).not.toMatch(/hunter2|admin:|postgres:\/\//);
    // Production: no hint at all.
    expect(
      describeDataStore({ persistence: { ready: false, reason: "not-migrated", detail: "x" }, provider: "postgres", schema: "0001_init", showHints: false, checkedAt }).hint,
    ).toBeNull();
  });

  it("redacts connection strings and credentials from free text", () => {
    expect(redactSecrets("failed for postgresql://user:p%40ss@host:6543/db?sslmode=require now")).toBe(
      "failed for [connection string hidden] now",
    );
    expect(redactSecrets("auth failed for admin:hunter2@10.0.0.5")).not.toContain("hunter2");
    expect(redactSecrets("password=hunter2 sslmode=require")).toBe("password=[hidden] sslmode=require");
    expect(redactSecrets("Database schema is missing. Run `npm run db:migrate`.")).toBe(
      "Database schema is missing. Run `npm run db:migrate`.",
    );
  });

  it("hides database hosts and IPs from driver errors (shown as setup hints on preview deploys)", () => {
    expect(redactSecrets("Could not connect to the database: connect ECONNREFUSED 127.0.0.1:1")).toBe(
      "Could not connect to the database: connect ECONNREFUSED [host hidden]",
    );
    expect(redactSecrets("getaddrinfo ENOTFOUND db.abcdefghijkl.supabase.co")).toBe("getaddrinfo ENOTFOUND [host hidden]");
    expect(redactSecrets("connect ECONNREFUSED ::1:5432")).toBe("connect ECONNREFUSED [host hidden]");
    expect(redactSecrets("connect ECONNREFUSED [2600:1f18::5]:6543")).toBe("connect ECONNREFUSED [host hidden]");
    expect(redactSecrets("timeout on aws-0-us-east-1.pooler.supabase.com:6543 after 10s")).toBe(
      "timeout on [host hidden] after 10s",
    );
    expect(redactSecrets("no route to localhost:5432")).toBe("no route to [host hidden]");
  });

  it("detects Supabase by host without exposing it", () => {
    expect(postgresProvider("postgresql://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres")).toBe("supabase");
    expect(postgresProvider("postgres://postgres:pw@db.abcdefgh.supabase.co:5432/postgres")).toBe("supabase");
    expect(postgresProvider("postgres://u:p@localhost:5432/app")).toBe("postgres");
    expect(postgresProvider("postgres://u:p@supabase.co.evil.example/app")).toBe("postgres");
    expect(postgresProvider("not a url")).toBe("postgres");
  });

  it("reports the connected database and a dead one without leaking the URL", async () => {
    const db = await createMemoryDbForTests();
    __setDbForTests(db);
    try {
      expect(await getDataStoreStatus(new Date(checkedAt))).toMatchObject({ state: "local", checkedAt });
    } finally {
      __setDbForTests(undefined);
    }
    vi.stubEnv("DATABASE_URL", "postgres://admin:hunter2@127.0.0.1:1/founders");
    vi.stubEnv("POSTGRES_URL", "");
    const dead = await getDataStoreStatus();
    expect(dead.state).toBe("down");
    expect(dead.provider).toBe("Postgres");
    expect(JSON.stringify(dead)).not.toMatch(/hunter2|admin|postgres:\/\//);

    vi.stubEnv("DATABASE_URL", "");
    expect(await getDataStoreStatus()).toMatchObject({ state: "down", headline: "No database configured", provider: "Not configured" });
  });
});
