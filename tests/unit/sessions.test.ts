/**
 * Office-hours sessions (organizer policy, Sept 24): every session is site.officeHours.sessionMinutes
 * long with a site.officeHours.breakMinutes break before the next, starting at the window's start.
 * Exact windows become sessions; part-of-day and time-TBA windows don't (yet). Explicit content slots
 * win for their window and must follow the same rule (content validation).
 */
import { describe, expect, it } from "vitest";
import { demoEvents, demoMentors } from "@/content/demo";
import { events } from "@/content/events";
import { mentors } from "@/content/mentors";
import { site } from "@/content/site";
import type { AppointmentSlot, AvailabilityWindow, Mentor } from "@/content/types";
import { ContentValidationError, validateContent } from "@/content/validate";
import {
  generatedSessionSlots,
  sessionRuleText,
  sessionSlotId,
  sessionTimes,
  slotRuleProblems,
  type SessionRule,
} from "@/lib/schedule/sessions";

const RULE: SessionRule = { sessionMinutes: 25, breakMinutes: 5 };
const mentor = (id: string) => mentors.find((m) => m.id === id)!;
const exact = (start: string, end?: string): Pick<AvailabilityWindow, "time"> => ({ time: { kind: "exact", start, end } });
const span = (times: { start: string; end: string }[]) => times.map((t) => `${t.start}–${t.end}`);

/** A test-only mentor: one exact window and whatever slots the test needs. */
function fixtureMentor(slots: Omit<AppointmentSlot, "windowId" | "date" | "capacity" | "status">[] = []): Mentor {
  return {
    id: "fixture-sessions",
    name: "Sam Fixture",
    firstName: "Sam",
    role: null,
    company: null,
    headshot: null,
    bio: null,
    expertise: null,
    askMeAbout: null,
    goodFitFor: null,
    session: { format: null, durationMinutes: null, location: null, sessionCount: null, confirmed: false },
    availability: [
      { id: "fixture-sessions-2026-10-01-am", date: "2026-10-01", time: { kind: "exact", start: "09:00", end: "11:00" } },
      { id: "fixture-sessions-2026-10-01-pm", date: "2026-10-01", time: { kind: "exact", start: "14:00", end: "15:00" } },
    ],
    slots: slots.map((s) => ({
      ...s,
      windowId: "fixture-sessions-2026-10-01-am",
      date: "2026-10-01",
      capacity: 1,
      status: "confirmed" as const,
    })),
    links: [],
    acceptingApplications: true,
    sources: [],
  };
}

describe("the office-hours rule", () => {
  it("comes from site settings: 25-minute sessions with a 5-minute break (organizer update, Sept 24)", () => {
    expect(site.officeHours).toEqual({ sessionMinutes: 25, breakMinutes: 5 });
    expect(sessionRuleText(site.officeHours)).toBe("Each session is 25 minutes, with a 5-minute break between sessions.");
  });

  it("describes a rule without a break, and never uses an em dash", () => {
    expect(sessionRuleText({ sessionMinutes: 25, breakMinutes: 0 })).toBe("Each session is 25 minutes.");
    expect(sessionRuleText({ sessionMinutes: 20, breakMinutes: 10 })).toBe(
      "Each session is 20 minutes, with a 10-minute break between sessions.",
    );
    expect(sessionRuleText(RULE)).not.toContain("—");
  });
});

describe("sessionTimes", () => {
  it("splits Patrick's Thu 10:00–11:30 window into three sessions from the window start", () => {
    const [window] = mentor("patrick-haddox").availability;
    expect(window.time).toEqual({ kind: "exact", start: "10:00", end: "11:30" });
    expect(span(sessionTimes(window, RULE))).toEqual(["10:00–10:25", "10:30–10:55", "11:00–11:25"]);
  });

  it("splits Rishab's Thu 12:00–17:00 window into ten sessions, the last ending 16:55", () => {
    const [window] = mentor("rishab-veldur").availability;
    const times = sessionTimes(window, RULE);
    expect(times).toHaveLength(10);
    expect(span(times)).toEqual([
      "12:00–12:25",
      "12:30–12:55",
      "13:00–13:25",
      "13:30–13:55",
      "14:00–14:25",
      "14:30–14:55",
      "15:00–15:25",
      "15:30–15:55",
      "16:00–16:25",
      "16:30–16:55",
    ]);
  });

  it("splits Arnav's Fri 10:00–11:30 window into three sessions from the window start", () => {
    const [window] = mentor("arnav-mishra").availability;
    expect(window).toMatchObject({ id: "arnav-mishra-2026-10-02-am", date: "2026-10-02" });
    expect(window.time).toEqual({ kind: "exact", start: "10:00", end: "11:30" });
    expect(span(sessionTimes(window, RULE))).toEqual(["10:00–10:25", "10:30–10:55", "11:00–11:25"]);
  });

  it("has no sessions for part-of-day, time-TBA or open-ended windows", () => {
    expect(sessionTimes({ time: { kind: "part-of-day", part: "morning", before: "12:00" } }, RULE)).toEqual([]);
    expect(sessionTimes({ time: { kind: "part-of-day", part: "morning", after: "09:00", before: "12:00" } }, RULE)).toEqual([]);
    expect(sessionTimes({ time: { kind: "tba" } }, RULE)).toEqual([]);
    expect(sessionTimes(exact("10:00"), RULE)).toEqual([]);
  });

  it("only keeps whole sessions inside short or uneven windows", () => {
    expect(sessionTimes(exact("10:00", "10:20"), RULE)).toEqual([]);
    expect(span(sessionTimes(exact("10:00", "10:25"), RULE))).toEqual(["10:00–10:25"]);
    // The second session would end 10:55, one minute after the window.
    expect(span(sessionTimes(exact("10:00", "10:54"), RULE))).toEqual(["10:00–10:25"]);
    expect(span(sessionTimes(exact("10:00", "10:55"), RULE))).toEqual(["10:00–10:25", "10:30–10:55"]);
    // Starts off the half hour: the grid starts at the window start, not on the clock.
    expect(span(sessionTimes(exact("09:45", "10:45"), RULE))).toEqual(["09:45–10:10", "10:15–10:40"]);
  });

  it("follows the rule it's given (no break, longer sessions, a disabled rule)", () => {
    expect(span(sessionTimes(exact("10:00", "11:00"), { sessionMinutes: 20, breakMinutes: 0 }))).toEqual([
      "10:00–10:20",
      "10:20–10:40",
      "10:40–11:00",
    ]);
    expect(span(sessionTimes(exact("10:00", "11:30"), { sessionMinutes: 40, breakMinutes: 10 }))).toEqual([
      "10:00–10:40",
      "10:50–11:30",
    ]);
    expect(sessionTimes(exact("10:00", "11:30"), { sessionMinutes: 0, breakMinutes: 5 })).toEqual([]);
  });
});

describe("session ids", () => {
  it("are <windowId>-<HHmm>, stable because appointments store them", () => {
    expect(sessionSlotId("rishab-veldur-2026-10-01", "12:00")).toBe("rishab-veldur-2026-10-01-1200");
    expect(sessionSlotId("patrick-haddox-2026-10-01-am", "10:30")).toBe("patrick-haddox-2026-10-01-am-1030");
    expect(sessionSlotId("x", "09:05")).toBe("x-0905");
    // Valid as organizer slot ids (lowercase kebab-case).
    expect(sessionSlotId("rishab-veldur-2026-10-01", "16:30")).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});

describe("generatedSessionSlots", () => {
  it("gives Patrick three one-seat confirmed sessions and Rishab ten", () => {
    const patrick = generatedSessionSlots(mentor("patrick-haddox"), RULE);
    expect(patrick).toEqual([
      { id: "patrick-haddox-2026-10-01-am-1000", windowId: "patrick-haddox-2026-10-01-am", date: "2026-10-01", start: "10:00", end: "10:25", capacity: 1, status: "confirmed" },
      { id: "patrick-haddox-2026-10-01-am-1030", windowId: "patrick-haddox-2026-10-01-am", date: "2026-10-01", start: "10:30", end: "10:55", capacity: 1, status: "confirmed" },
      { id: "patrick-haddox-2026-10-01-am-1100", windowId: "patrick-haddox-2026-10-01-am", date: "2026-10-01", start: "11:00", end: "11:25", capacity: 1, status: "confirmed" },
    ]);
    const rishab = generatedSessionSlots(mentor("rishab-veldur"), RULE);
    expect(rishab).toHaveLength(10);
    expect(rishab[0]).toEqual({
      id: "rishab-veldur-2026-10-01-1200",
      windowId: "rishab-veldur-2026-10-01",
      date: "2026-10-01",
      start: "12:00",
      end: "12:25",
      capacity: 1,
      status: "confirmed",
    });
    expect(rishab.at(-1)).toMatchObject({ id: "rishab-veldur-2026-10-01-1630", start: "16:30", end: "16:55" });
    expect(rishab.every((s) => s.capacity === 1 && s.status === "confirmed" && s.date === "2026-10-01")).toBe(true);
    expect(new Set(rishab.map((s) => s.id)).size).toBe(10);
  });

  it("gives Arnav three sessions in his Fri 10:00–11:30 window", () => {
    expect(generatedSessionSlots(mentor("arnav-mishra"), RULE).map((s) => [s.id, s.date, s.start, s.end])).toEqual([
      ["arnav-mishra-2026-10-02-am-1000", "2026-10-02", "10:00", "10:25"],
      ["arnav-mishra-2026-10-02-am-1030", "2026-10-02", "10:30", "10:55"],
      ["arnav-mishra-2026-10-02-am-1100", "2026-10-02", "11:00", "11:25"],
    ]);
  });

  it("gives Ron four sessions in his Thu 2:30–4:30 PM window", () => {
    expect(generatedSessionSlots(mentor("ron-lewis"), RULE).map((s) => [s.id, s.date, s.start, s.end])).toEqual([
      ["ron-lewis-2026-10-01-pm-1430", "2026-10-01", "14:30", "14:55"],
      ["ron-lewis-2026-10-01-pm-1500", "2026-10-01", "15:00", "15:25"],
      ["ron-lewis-2026-10-01-pm-1530", "2026-10-01", "15:30", "15:55"],
      ["ron-lewis-2026-10-01-pm-1600", "2026-10-01", "16:00", "16:25"],
    ]);
  });

  it("generates nothing for rough windows (part of day, time TBA) or mentors still scheduling (Vik, Elliott)", () => {
    for (const id of ["vikram-lakhwara", "elliott-notrica"]) {
      expect(generatedSessionSlots(mentor(id), RULE), id).toEqual([]);
    }
    const rough: Pick<Mentor, "availability" | "slots"> = {
      slots: [],
      availability: [
        { id: "fixture-rough-2026-10-02-am", date: "2026-10-02", time: { kind: "part-of-day", part: "morning", before: "12:00" } },
        { id: "fixture-rough-2026-10-03", date: "2026-10-03", time: { kind: "tba" } },
      ],
    };
    expect(generatedSessionSlots(rough, RULE)).toEqual([]);
  });

  it("lets explicit content slots win for their window, and still splits the mentor's other windows", () => {
    const withSlots = fixtureMentor([{ id: "fixture-sessions-slot-0900", start: "09:00", end: "09:25" }]);
    const generated = generatedSessionSlots(withSlots, RULE);
    // The morning window has an explicit slot: no generated sessions there. The afternoon is split.
    expect(generated.map((s) => s.id)).toEqual(["fixture-sessions-2026-10-01-pm-1400", "fixture-sessions-2026-10-01-pm-1430"]);
    expect(generated.every((s) => s.windowId === "fixture-sessions-2026-10-01-pm")).toBe(true);
    // Without explicit slots, both windows are split (4 + 2).
    expect(generatedSessionSlots(fixtureMentor(), RULE)).toHaveLength(6);
    // Demo mentors only have explicit slots: nothing is generated for them.
    for (const m of demoMentors) expect(generatedSessionSlots(m, RULE), m.id).toEqual([]);
  });
});

describe("slotRuleProblems (explicit slots)", () => {
  it("accepts 25-minute slots with at least a 5-minute gap (the demo slots)", () => {
    for (const m of demoMentors) expect(slotRuleProblems(m, site.officeHours), m.id).toEqual([]);
    expect(
      slotRuleProblems(
        fixtureMentor([
          { id: "a", start: "09:00", end: "09:25" },
          { id: "b", start: "09:30", end: "09:55" },
          { id: "c", start: "10:10", end: "10:35" },
        ]),
        RULE,
      ),
    ).toEqual([]);
  });

  it("flags the wrong length, a slot outside its window, and a missing break", () => {
    expect(slotRuleProblems(fixtureMentor([{ id: "long", start: "09:00", end: "09:30" }]), RULE)).toEqual([
      "slot long is 30 minutes; sessions are 25 minutes",
    ]);
    expect(slotRuleProblems(fixtureMentor([{ id: "late", start: "10:50", end: "11:15" }]), RULE)).toEqual([
      "slot late falls outside window fixture-sessions-2026-10-01-am",
    ]);
    expect(
      slotRuleProblems(
        fixtureMentor([
          { id: "first", start: "09:00", end: "09:25" },
          { id: "tight", start: "09:27", end: "09:52" },
        ]),
        RULE,
      ),
    ).toEqual(["slot tight starts 2 minutes after first ends; sessions need a 5-minute break"]);
  });

  it("flags overlapping slots, and ignores the gap between slots in different windows", () => {
    expect(
      slotRuleProblems(
        fixtureMentor([
          { id: "one", start: "09:00", end: "09:25" },
          { id: "two", start: "09:10", end: "09:35" },
        ]),
        RULE,
      ),
    ).toEqual(["slot two overlaps one"]);
    // Back to back (no break) is too close under a 5-minute break, fine without one.
    const backToBack = fixtureMentor([
      { id: "first", start: "09:00", end: "09:25" },
      { id: "next", start: "09:25", end: "09:50" },
    ]);
    expect(slotRuleProblems(backToBack, RULE)).toEqual([
      "slot next starts 0 minutes after first ends; sessions need a 5-minute break",
    ]);
    expect(slotRuleProblems(backToBack, { sessionMinutes: 25, breakMinutes: 0 })).toEqual([]);
    const twoWindows = fixtureMentor([{ id: "am", start: "10:30", end: "10:55" }]);
    twoWindows.slots.push({ id: "pm", windowId: "fixture-sessions-2026-10-01-pm", date: "2026-10-01", start: "14:00", end: "14:25", capacity: 1, status: "confirmed" });
    expect(slotRuleProblems(twoWindows, RULE)).toEqual([]);
  });
});

describe("content validation with the session rule", () => {
  const check = (m: Mentor, officeHours?: SessionRule) => () =>
    validateContent({ events: [], mentors: [m], forbidDemo: false, officeHours });

  it("accepts production and demo content under site.officeHours", () => {
    expect(() => validateContent({ events, mentors, forbidDemo: true })).not.toThrow();
    expect(() =>
      validateContent({ events: [...events, ...demoEvents], mentors: [...mentors, ...demoMentors], forbidDemo: false }),
    ).not.toThrow();
  });

  it("rejects explicit slots that break the rule, with the mentor and slot named", () => {
    const thirty = structuredClone(demoMentors[1]);
    thirty.slots[0].end = "15:30";
    expect(check(thirty)).toThrow(ContentValidationError);
    expect(check(thirty)).toThrow(
      /mentors\[0\] \(demo-jordan-placeholder\): slot demo-jordan-slot-1500 is 30 minutes; sessions are 25 minutes/,
    );

    const tight = structuredClone(demoMentors[0]);
    tight.slots[1].start = "14:27";
    tight.slots[1].end = "14:52";
    expect(check(tight)).toThrow(
      /\(demo-avery-sample\): slot demo-avery-slot-1430 starts 2 minutes after demo-avery-slot-1400 ends; sessions need a 5-minute break/,
    );

    const outside = structuredClone(demoMentors[0]);
    outside.slots[1].start = "14:40";
    outside.slots[1].end = "15:05";
    expect(check(outside)).toThrow(/slot demo-avery-slot-1430 falls outside window demo-avery-2026-10-01-pm/);

    // A different rule (e.g. 30-minute sessions) is checked the same way.
    expect(check(demoMentors[0], { sessionMinutes: 30, breakMinutes: 0 })).toThrow(/is 25 minutes; sessions are 30 minutes/);
  });

  it("rejects an unusable rule", () => {
    expect(check(demoMentors[0], { sessionMinutes: 0, breakMinutes: 5 })).toThrow(/site\.officeHours\.sessionMinutes/);
    expect(check(demoMentors[0], { sessionMinutes: 25, breakMinutes: -5 })).toThrow(/site\.officeHours\.breakMinutes/);
  });

  it("rejects a window or slot id that a generated session id already uses", () => {
    const clash = fixtureMentor();
    // "<window>-1400" is the afternoon window's first generated session.
    clash.availability.push({ id: "fixture-sessions-2026-10-01-pm-1400", date: "2026-10-02", time: { kind: "tba" } });
    expect(() => validateContent({ events: [], mentors: [clash], forbidDemo: false })).toThrow(
      /generated session id "fixture-sessions-2026-10-01-pm-1400" is already used by a window or slot/,
    );
  });
});
