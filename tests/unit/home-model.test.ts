/**
 * Home page data helpers against the public (default-env) content: date wording, the office-hours
 * sentence (no one-on-one claim), the six mentor previews (content order, approved headshots, one
 * availability line each, nothing private), the date-only window wording (on a synthetic fixture
 * mentor), the four featured events in priority order, and that the canceled afterparty is gone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMentors, getScheduleEntries, getSite } from "@/content";
import type { EventLocation, Mentor, SiteSettings } from "@/content/types";
import {
  calendarNote,
  dateRange,
  featuredEventView,
  homeFeaturedEvents,
  liveEntries,
  longDate,
  mentorPreviews,
  monthDay,
  namesText,
  officeHoursSentence,
  officialDates,
  placeText,
  previewAvailability,
  relatedEventsStart,
  shortDate,
  timeText,
} from "@/components/home/home-model";

const MENTOR_IDS = [
  "patrick-haddox",
  "arnav-mishra",
  "vikram-lakhwara",
  "elliott-notrica",
  "ron-lewis",
  "rishab-veldur",
];
const MENTOR_NAMES = [
  "Patrick Haddox",
  "Arnav Mishra",
  "Vikram “Vik” Lakhwara",
  "Elliott Notrica",
  "Ron Lewis",
  "Rishab Veldur",
];

/** Rishab's one office-hours window: Thu, Oct 1, anytime from noon to 5 PM (locked Sept 24). */
const RISHAB_AVAILABILITY = {
  known: true,
  date: "Thu, Oct 1",
  time: "12:00–5:00 PM CT",
  dateTime: "2026-10-01",
  more: 0,
};

/** A date-only window (the date is set, the time isn't): how it previews. */
const DATE_ONLY_AVAILABILITY = {
  known: true,
  date: "Thu, Oct 1",
  time: "Exact time to be confirmed",
  dateTime: "2026-10-01",
  more: 0,
};

/**
 * A synthetic mentor, not in /content, with one date-only window. No real mentor has one right
 * now, but the path stays for future mentors whose date is set before their time.
 */
const DATE_ONLY_MENTOR: Mentor = {
  id: "fixture-date-only",
  name: "Fixture Mentor",
  firstName: "Fixture",
  role: "Founder",
  company: "Fixture Co",
  headshot: null,
  bio: null,
  expertise: null,
  askMeAbout: null,
  goodFitFor: null,
  session: { format: null, durationMinutes: null, location: null, sessionCount: null, confirmed: false },
  availability: [{ id: "fixture-date-only-2026-10-01", date: "2026-10-01", time: { kind: "tba" } }],
  slots: [],
  links: [],
  acceptingApplications: true,
  sources: [],
};

/** The Founders Week Afterparty (Sat Oct 3, HERE Apartments) was canceled and must never appear. */
function expectNoCanceledAfterparty(s: string) {
  expect(s).not.toMatch(/HERE Apartments/i);
  expect(s).not.toMatch(/after[\s-]?party/i);
}

describe("home model (public data)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("formats dates in the home page's house style", () => {
    expect(monthDay("2026-09-28")).toBe("Sept 28");
    expect(monthDay("2026-10-03")).toBe("Oct 3");
    expect(shortDate("2026-09-28")).toBe("Mon, Sept 28");
    expect(longDate("2026-09-29")).toBe("Tuesday, Sept 29");
    expect(dateRange("2026-09-30", "2026-10-03")).toBe("Sept 30 – Oct 3");
    expect(dateRange("2026-10-01", "2026-10-03")).toBe("Oct 1–3");
    expect(dateRange("2026-10-01", "2026-10-01")).toBe("Oct 1");
  });

  it("states the official dates and when related events begin", () => {
    const site = getSite();
    const entries = getScheduleEntries();
    expect(officialDates(site)).toBe("Sept 30 – Oct 3");
    expect(relatedEventsStart(entries, site)).toBe("Sept 28");
    expect(calendarNote(entries, site)).toBe(
      "The official Founders Week program runs Sept 30 – Oct 3, and related events begin Sept 28.",
    );
    // Without published dates there is nothing to say; without earlier events, no "related" clause.
    const noDates: SiteSettings = { ...site, week: { ...site.week, dates: null } };
    expect(officialDates(noDates)).toBeNull();
    expect(calendarNote(entries, noDates)).toBeNull();
    const later = entries.filter((e) => e.date >= "2026-09-30");
    expect(calendarNote(later, site)).toBe("The official Founders Week program runs Sept 30 – Oct 3.");
  });

  it("explains office hours in one accurate sentence — no one-on-one promise", () => {
    const sentence = officeHoursSentence(getSite());
    expect(sentence).toBe(
      "During Founders Week (Sept 30 – Oct 3), Founders – Illinois Entrepreneurs is setting up office hours with startup founders and investors, and one short application covers every mentor.",
    );
    expect(sentence).not.toMatch(/one-on-one|1:1|guarantee|reserve/i);
    expect(sentence).not.toContain("—");
    expect(sentence.match(/[.!?](\s|$)/g)).toHaveLength(1);
  });

  it("previews all six mentors in content order, with photos and one availability line each", () => {
    const previews = mentorPreviews(getMentors());
    expect(previews).toHaveLength(6);
    expect(previews.map((p) => p.id)).toEqual(MENTOR_IDS);
    expect(previews.map((p) => p.name)).toEqual(MENTOR_NAMES);
    expect(previews.map((p) => p.href)).toEqual(MENTOR_IDS.map((id) => `/office-hours/${id}`));
    // Every preview carries its approved headshot, with the mentor's name as alt text.
    expect(previews.map((p) => p.headshot && { src: p.headshot.src, alt: p.headshot.alt })).toEqual(
      MENTOR_IDS.map((id, i) => ({ src: `/mentors/${id}.jpg`, alt: MENTOR_NAMES[i] })),
    );
    expect(previews.map((p) => [p.role, p.company])).toEqual([
      ["CEO & Co-Founder", "Samara Aerospace"],
      ["Co-Founder & CTO", "Doss"],
      ["Founder & Managing Member", "Stakehouse"],
      ["Founder & CEO", "Symbio Bioculinary"],
      ["Co-Founder", "Auctus Advisory"],
      ["Co-Founder & CEO", "Auvi Labs"],
    ]);
    expect(previews.map((p) => p.availability)).toEqual([
      { known: true, date: "Thu, Oct 1", time: "10:00–11:30 AM CT", dateTime: "2026-10-01", more: 0 },
      { known: true, date: "Fri, Oct 2", time: "Morning, before noon CT", dateTime: "2026-10-02", more: 0 },
      { known: false, label: "Scheduling in progress" },
      { known: false, label: "Scheduling in progress" },
      { known: false, label: "Scheduling in progress" },
      RISHAB_AVAILABILITY,
    ]);
  });

  it("previews Rishab last: Thu, Oct 1 · 12:00–5:00 PM CT, never Oct 2", () => {
    const rishab = mentorPreviews(getMentors()).at(-1)!;
    expect(rishab).toEqual({
      id: "rishab-veldur",
      name: "Rishab Veldur",
      role: "Co-Founder & CEO",
      company: "Auvi Labs",
      headshot: { src: "/mentors/rishab-veldur.jpg", alt: "Rishab Veldur", width: 800, height: 800 },
      href: "/office-hours/rishab-veldur",
      availability: RISHAB_AVAILABILITY,
    });
    // His line reads like Patrick's: "Thu, Oct 1 · 12:00–5:00 PM CT", a window, not a booking.
    const a = rishab.availability;
    expect(a.known && `${a.date} · ${a.time}`).toBe("Thu, Oct 1 · 12:00–5:00 PM CT");
    // He is at Founders Week on Oct 2 but has no office hours then; that must never show.
    const json = JSON.stringify(rishab);
    expect(json).not.toMatch(/Oct 2|2026-10-02|Fri/);
    // His time is locked now: no "to be confirmed/announced" wording left.
    expect(json).not.toMatch(/Time to be announced|Exact time to be confirmed|Scheduling in progress/);
  });

  it("previews carry nothing private: no organizer notes, drafts, bios or expertise bases", () => {
    const json = JSON.stringify(mentorPreviews(getMentors()));
    expect(json).not.toMatch(/commitments|much more available|extra sessions|Wednesday through Saturday/i);
    expect(json).not.toMatch(/Revenue strategy|Startup financial planning/);
    expect(json).not.toMatch(/"(basis|organizerNotes|expertise|bio|askMeAbout|goodFitFor|backgroundTags|sources)"/);
    expect(json).not.toMatch(/Former senior spacecraft test engineer|Stakehouse backs founders/);
    // Rishab's organizer-only notes (team preference, phone, Oct 2 presence) and his bio stay off.
    expect(json).not.toMatch(/student teams|phone number|email signature|Oct 1 and 2|dialysis|Cozad|Medtech/i);
    expect(json).not.toMatch(/FDA|clinically|commercially available|Beacon|one-on-one/i);
  });

  it("lists the earliest window first and counts the rest", () => {
    const a = previewAvailability({
      availability: [
        { id: "b", date: "2026-10-02", time: { kind: "exact", start: "09:00", end: "10:00" } },
        { id: "a", date: "2026-10-01", time: { kind: "exact", start: "14:00", end: "15:00" } },
        { id: "c", date: "2026-10-01", time: { kind: "exact", start: "09:00", end: "10:00" } },
      ],
      slots: [],
    });
    expect(a).toEqual({ known: true, date: "Thu, Oct 1", time: "9:00–10:00 AM CT", dateTime: "2026-10-01", more: 2 });
    expect(previewAvailability({ availability: [], slots: [] })).toEqual({
      known: false,
      label: "Scheduling in progress",
    });
  });

  it("words a date-only window (time to be confirmed) as 'Exact time to be confirmed'", () => {
    // A mentor with only a date-only window previews as "Thu, Oct 1 · Exact time to be confirmed".
    const [preview] = mentorPreviews([DATE_ONLY_MENTOR]);
    expect(preview).toEqual({
      id: "fixture-date-only",
      name: "Fixture Mentor",
      role: "Founder",
      company: "Fixture Co",
      headshot: null,
      href: "/office-hours/fixture-date-only",
      availability: DATE_ONLY_AVAILABILITY,
    });
    const a = preview.availability;
    expect(a.known && `${a.date} · ${a.time}`).toBe("Thu, Oct 1 · Exact time to be confirmed");
    expect(JSON.stringify(preview)).not.toMatch(/Time to be announced|Scheduling in progress/);

    // With or without a display label, the wording is the same.
    const [tba] = DATE_ONLY_MENTOR.availability;
    expect(previewAvailability({ availability: [tba], slots: [] })).toEqual(DATE_ONLY_AVAILABILITY);
    expect(
      previewAvailability({ availability: [{ ...tba, label: "Exact time to be confirmed" }], slots: [] }),
    ).toEqual(DATE_ONLY_AVAILABILITY);
    // A timed window on the same day comes first; the date-only one is counted.
    expect(
      previewAvailability({
        availability: [tba, { id: "x", date: "2026-10-01", time: { kind: "exact", start: "12:00", end: "17:00" } }],
        slots: [],
      }),
    ).toEqual({ ...RISHAB_AVAILABILITY, more: 1 });
  });

  it("features Dan Caruso's fireside chat, the Sept 29 panel, Arnav's happy hour and Failure Lab — no office hours", () => {
    const featured = homeFeaturedEvents(getScheduleEntries());
    expect(featured.map((e) => e.id)).toEqual([
      "dan-caruso-fireside-chat",
      "how-to-make-10k-a-month-in-college",
      "happy-hour-at-legends-with-arnav-mishra",
      "founder-failure-lab",
    ]);
    expect(featured.every((e) => e.kind === "event" && e.status !== "canceled")).toBe(true);
    expect(homeFeaturedEvents(getScheduleEntries(), 1).map((e) => e.id)).toEqual(["dan-caruso-fireside-chat"]);
  });

  it("describes each featured event with its label, date, time and place", () => {
    const [dan, panel] = homeFeaturedEvents(getScheduleEntries()).map(featuredEventView);
    expect(dan).toEqual({
      id: "dan-caruso-fireside-chat",
      title: "Fireside Chat with Dan Caruso",
      href: "/schedule/dan-caruso-fireside-chat",
      involvement: "supported",
      date: "Monday, Sept 28",
      time: "4:00 PM CT",
      dateTime: "2026-09-28T16:00",
      place: "Beckman Institute, Auditorium (Room 1025)",
      address: "405 N. Mathews Ave., Urbana, IL 61801",
    });
    expect(panel).toEqual({
      id: "how-to-make-10k-a-month-in-college",
      title: "How to Make $10K/Month in College",
      href: "/schedule/how-to-make-10k-a-month-in-college",
      involvement: "cohosted",
      date: "Tuesday, Sept 29",
      time: "6:00–8:00 PM CT",
      dateTime: "2026-09-29T18:00",
      place: "Materials Science and Engineering Building, Room 100",
      address: "1304 W. Green St., Urbana, IL 61801",
    });
  });

  it("says plainly when a time or place isn't announced", () => {
    expect(timeText({ kind: "tba" })).toBe("Time to be announced");
    expect(timeText({ kind: "part-of-day", part: "morning", before: "12:00" })).toBe("Morning, before noon CT");
    const places: [EventLocation, string][] = [
      [{ kind: "tba" }, "Location to be announced"],
      [{ kind: "virtual", platform: "Zoom" }, "Online · Zoom"],
      [{ kind: "virtual" }, "Online"],
      [{ kind: "hybrid", venue: "Siebel Center", room: "2405" }, "Siebel Center, 2405 and online"],
    ];
    for (const [loc, text] of places) expect(placeText(loc)).toBe(text);
  });

  it("keeps the canceled afterparty out of everything the home page uses", () => {
    const entries = getScheduleEntries();
    expectNoCanceledAfterparty(
      JSON.stringify([
        homeFeaturedEvents(entries, 99).map(featuredEventView),
        mentorPreviews(getMentors()),
        calendarNote(entries, getSite()),
      ]),
    );
    expect(liveEntries(entries).some((e) => /HERE Apartments/i.test(JSON.stringify(e.location)))).toBe(false);
    // The university's Friday showcase stays on the calendar.
    expect(entries.map((e) => e.id)).toContain("founders-evening-showcase-and-reception");
  });

  it("joins names for copy", () => {
    expect(namesText(getMentors().map((m) => m.name))).toBe(
      "Patrick Haddox, Arnav Mishra, Vikram “Vik” Lakhwara, Elliott Notrica, Ron Lewis and Rishab Veldur",
    );
    expect(namesText(MENTOR_NAMES)).toBe(namesText(getMentors().map((m) => m.name)));
    expect(namesText(["A", "B"])).toBe("A and B");
    expect(namesText(["A"])).toBe("A");
    expect(namesText([])).toBe("");
  });
});
