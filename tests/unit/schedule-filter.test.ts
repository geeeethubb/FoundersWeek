import { describe, expect, it } from "vitest";
import { demoEvents, demoMentors } from "@/content/demo";
import { events } from "@/content/events";
import { mentors } from "@/content/mentors";
import { site } from "@/content/site";
import type { ScheduleEvent } from "@/content/types";
import { buildScheduleEntries, eventToEntry, featuredEntries, scheduleDays } from "@/lib/schedule/entries";
import {
  featuredBand,
  featuredDayMarks,
  featuredEvents,
  officeHoursMentorSummaries,
  schedulingMentorNames,
} from "@/lib/schedule/featured";
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
  viewCounts,
} from "@/lib/schedule/filter";
import {
  dateRangeLabel,
  entryCertainty,
  entryTimeText,
  entryWhenText,
  gutterTime,
  locationSummary,
  timeZoneNote,
} from "@/lib/schedule/format";
import { pendingMentorMatches, pendingMentors } from "@/lib/schedule/pending-mentors";
import {
  defaultProgramOpen,
  hasProgram,
  isLogistics,
  matchingSessionIndexes,
  mentorProfileHref,
  programMentors,
  programTrack,
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

const DAN = "dan-caruso-fireside-chat";
const PANEL = "how-to-make-10k-a-month-in-college";
const SHOWCASE = "founders-showcase-day-sessions";
const PATRICK_OH = "office-hours-patrick-haddox-2026-10-01-am";
const ARNAV_OH = "office-hours-arnav-mishra-2026-10-02-am";

describe("production calendar", () => {
  it("lists the full week (Mon Sep 28 – Sat Oct 3) in chronological order", () => {
    expect(ids(production)).toEqual([
      DAN,
      PANEL,
      "founders-week-kickoff-reception",
      PATRICK_OH,
      "science-and-practice-of-pitching",
      "entrepreneurial-impact-launching-from-illinois",
      "techrise-pitch-competition",
      ARNAV_OH,
      SHOWCASE,
      "founders-evening-showcase-and-reception",
      // Both Saturday items have no time yet: they keep the agenda order (tailgate first).
      "tailgate-and-enterpriseworks-tour",
      "illinois-football-vs-purdue",
    ]);
    const days = scheduleDays(production);
    expect(days).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(dateRangeLabel(days[0], days[days.length - 1])).toBe("Mon Sep 28 – Sat Oct 3");
  });

  it("no longer lists the canceled afterparty, but keeps the university's Friday evening showcase", () => {
    const text = JSON.stringify(production);
    expect(text).not.toMatch(/afterparty/i);
    expect(text).not.toMatch(/HERE Apartments/i);
    expect(production.some((e) => e.id === "founders-week-afterparty")).toBe(false);
    const evening = byId("founders-evening-showcase-and-reception");
    expect(evening).toMatchObject({ date: "2026-10-02", status: "confirmed" });
  });

  it("only creates office-hours entries for mentors with published windows", () => {
    expect(production.filter((e) => e.kind === "office-hours").map((e) => e.mentor!.id)).toEqual([
      "patrick-haddox",
      "arnav-mishra",
    ]);
    // Ron and Vik are "Scheduling in progress": no schedule entries, no invented windows.
    expect(production.some((e) => e.mentor?.id === "ron-lewis" || e.mentor?.id === "vikram-lakhwara")).toBe(false);
  });

  it("never surfaces organizer-only notes or draft topics in searchable or displayed text", () => {
    const text = JSON.stringify(production);
    expect(text).not.toMatch(/Wednesday through Saturday/i);
    expect(text).not.toMatch(/commitments/i);
    expect(text).not.toMatch(/Revenue strategy/i);
  });

  it("never offers an application or booking for anything but office hours (Dan Caruso included)", () => {
    for (const e of production.filter((x) => x.kind === "event")) {
      expect(e.registration?.internal ?? false).toBe(false);
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
    expect(find("quantum")).toEqual([SHOWCASE]);
    expect(find("Hannah")).toEqual(["science-and-practice-of-pitching"]);
    expect(find("where are they now")).toEqual(["techrise-pitch-competition"]);
    expect(find("Martinis")).toEqual(["science-and-practice-of-pitching", "techrise-pitch-competition", SHOWCASE]);
  });

  it("matches speakers, mentors and companies across events and office hours", () => {
    expect(find("Kennedy")).toEqual([PANEL]);
    expect(find("doss")).toEqual([ARNAV_OH, SHOWCASE]);
    expect(find("aerospace")).toEqual([PATRICK_OH, SHOWCASE]);
    expect(find("caruso ventures")).toEqual([DAN]);
    expect(find("100 MSEB")).toEqual([PANEL]);
  });

  it("returns nothing for unknown terms and for the removed afterparty", () => {
    expect(find("zzz")).toEqual([]);
    expect(find("here apartments")).toEqual([]);
    expect(find("afterparty")).toEqual([]);
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
      "entrepreneurial-impact-launching-from-illinois",
      "techrise-pitch-competition",
    ]);
    expect(ids(filterEntries(production, f({ view: "picks" })))).toEqual([DAN, PANEL, PATRICK_OH, ARNAV_OH, SHOWCASE]);
    expect(ids(filterEntries(production, f({ types: ["office-hours"] })))).toEqual([PATRICK_OH, ARNAV_OH]);
    expect(ids(filterEntries(production, f({ types: ["panel"], q: "Kennedy" })))).toEqual([PANEL]);
    expect(ids(filterEntries(production, f({ day: "2026-10-02", q: "Isbell" })))).toEqual([SHOWCASE]);
  });

  it("counts every facet under the other active filters", () => {
    const facets = typeFacets(production, f());
    // Office hours lead, then the core types, then the other types present in content.
    expect(facets.map((x) => [x.type, x.count])).toEqual([
      ["office-hours", 2],
      ["talk", 2],
      ["panel", 6],
      ["networking", 5],
      ["pitch", 2],
      ["social", 4],
    ]);

    const panels = dayCounts(production, days, f({ types: ["panel"] }));
    expect(panels.all).toBe(6);
    expect(panels.byDay).toEqual({
      "2026-09-28": 0,
      "2026-09-29": 1,
      "2026-09-30": 0,
      "2026-10-01": 3,
      "2026-10-02": 2,
      "2026-10-03": 0,
    });

    expect(viewCounts(production, f())).toEqual({ all: 12, picks: 5 });
    expect(viewCounts(production, f({ day: "2026-10-02" }))).toEqual({ all: 3, picks: 2 });
  });

  it("explains empty results with one-filter-at-a-time relaxations", () => {
    const filters = f({ day: "2026-09-28", types: ["panel"] });
    expect(filterEntries(production, filters)).toHaveLength(0);
    const r = relaxations(production, filters);
    expect(r.map((x) => [x.dimension, x.count])).toEqual([
      ["day", 6],
      ["types", 1],
    ]);
    const search = relaxations(production, f({ q: "zzz" }));
    expect(search).toEqual([{ dimension: "q", count: 12, filters: f() }]);
  });
});

describe("overlaps", () => {
  it("the production calendar has no clashing exact times", () => {
    for (const group of groupByDay(production)) {
      expect(agendaBlocks(group.entries).every((b) => b.kind === "single")).toBe(true);
    }
    // Back-to-back blocks (Thu 3–5 PM, then 5–7 PM) are not overlaps.
    expect(entriesOverlap(byId("entrepreneurial-impact-launching-from-illinois"), byId("techrise-pitch-competition"))).toBe(
      false,
    );
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
  it("orders priorities: office hours, then Dan Caruso, then the Sep 29 panel", () => {
    expect(ids(featuredEntries(production))).toEqual([PATRICK_OH, ARNAV_OH, DAN, PANEL]);
    const band = featuredBand(production);
    expect(ids(band.officeHours)).toEqual([PATRICK_OH, ARNAV_OH]);
    expect(ids(band.events)).toEqual([DAN, PANEL]);
    expect(ids(featuredEvents(production))).toEqual([DAN, PANEL]);
    expect(band.events.map((e) => [e.featuredRank, e.involvement, e.related])).toEqual([
      [2, "supported", true],
      [3, "cohosted", true],
    ]);
  });

  it("keeps the agenda chronological regardless of featured rank", () => {
    const featuredIds = new Set(ids(featuredEntries(production)));
    expect(ids(production.filter((e) => featuredIds.has(e.id)))).toEqual([DAN, PANEL, PATRICK_OH, ARNAV_OH]);
  });

  it("never features a canceled entry", () => {
    const canceled = eventToEntry({ ...events[0], id: "canceled-feature", status: "canceled", featured: { rank: 2 } });
    expect(ids(featuredEvents([...production, canceled]))).toEqual([DAN, PANEL]);
  });

  it("summarizes all four mentors — including those still scheduling — with verified fields only", () => {
    const summaries = officeHoursMentorSummaries(publicMentors);
    expect(summaries.map((m) => m.id)).toEqual(["patrick-haddox", "arnav-mishra", "vikram-lakhwara", "ron-lewis"]);
    expect(summaries[0]).toMatchObject({
      affiliation: "CEO & Co-Founder, Samara Aerospace",
      status: "available",
      availability: "window",
      whenDay: "Thu, Oct 1",
      whenTime: "10:00–11:30 AM CT",
      when: "Thu, Oct 1 · 10:00–11:30 AM CT",
      ctaLabel: "Apply to meet Patrick",
      applyHref: "/office-hours?mentor=patrick-haddox#apply",
      profileHref: "/office-hours/patrick-haddox",
    });
    expect(summaries[1]).toMatchObject({ availability: "window-approx", whenTime: "Morning, before noon CT" });
    expect(summaries[2]).toMatchObject({
      affiliation: "Stakehouse",
      status: "in-progress",
      availability: "in-progress",
      when: null,
      ctaLabel: "Express interest",
      applyHref: "/office-hours?mentor=vikram-lakhwara#apply",
    });
    expect(schedulingMentorNames(summaries)).toEqual(["Vik", "Ron"]);
    expect(JSON.stringify(summaries)).not.toMatch(/Wednesday|commitments|Revenue strategy/i);
  });

  it("marks each day's priorities for the week strip", () => {
    expect(featuredDayMarks(production, "2026-09-28")).toEqual([
      { rank: 2, label: "Dan Caruso — Fireside Chat", href: `/schedule/${DAN}` },
    ]);
    expect(featuredDayMarks(production, "2026-09-29")).toEqual([
      { rank: 3, label: "How to Make $10K/Month in College", href: `/schedule/${PANEL}` },
    ]);
    expect(featuredDayMarks(production, "2026-10-01")).toEqual([{ rank: 1, label: "Office hours", href: "/office-hours" }]);
    expect(featuredDayMarks(production, "2026-09-30")).toEqual([]);
  });
});

describe("program blocks", () => {
  const showcase = byId(SHOWCASE);
  const techrise = byId("techrise-pitch-competition");

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
    expect(sessionLineText(showcase.sessions[0])).toBe("8:00–8:45 AM — Check-In and Breakfast Networking");
  });

  it("links office-hours mentors who speak, in program order", () => {
    expect(programMentors(showcase)).toEqual([
      {
        mentorId: "arnav-mishra",
        name: "Arnav Mishra",
        sessionTitle: "From Idea to Scale — Building Doss: Lessons from an Illini Founder",
        start: "13:55",
        end: "14:25",
        anchor: "session-1355",
        role: "speaker",
      },
      expect.objectContaining({ mentorId: "patrick-haddox", start: "14:40", role: "speaker" }),
      expect.objectContaining({ mentorId: "vikram-lakhwara", start: "14:55", role: "speaker" }),
    ]);
    expect(programMentors(techrise)).toEqual([]);
    expect(mentorProfileHref("vikram-lakhwara")).toBe("/office-hours/vikram-lakhwara");
  });

  it("starts collapsed on All days, open for a single day or a matching search", () => {
    expect(defaultProgramOpen(showcase, { day: null, q: "" })).toBe(false);
    expect(defaultProgramOpen(showcase, { day: "2026-10-02", q: "" })).toBe(true);
    expect(defaultProgramOpen(showcase, { day: null, q: "Isbell" })).toBe(true);
    expect(defaultProgramOpen(showcase, { day: null, q: "Illinois Conference Center" })).toBe(false);
    expect(defaultProgramOpen(byId("founders-week-kickoff-reception"), { day: "2026-09-30", q: "" })).toBe(false);
  });

  it("draws a proportional track inside the block's span", () => {
    const track = programTrack(showcase);
    expect(track).toHaveLength(11);
    expect(track[0]).toMatchObject({ left: 0, logistics: true, mentor: false });
    expect(track.map((s, i) => (s.mentor ? i : -1)).filter((i) => i >= 0)).toEqual([7, 8, 9]);
    for (const s of track) {
      expect(s.width).toBeGreaterThan(0);
      expect(s.left + s.width).toBeLessThanOrEqual(100);
    }
    expect(programTrack(byId(DAN))).toEqual([]);
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
  it("formats gutter times for exact, part-of-day and forthcoming times", () => {
    expect(gutterTime(byId(PATRICK_OH))).toEqual({ kind: "exact", primary: "10:00", period: "AM", secondary: "–11:30 AM" });
    expect(gutterTime(byId(ARNAV_OH))).toMatchObject({ kind: "part-of-day", primary: "Morning", secondary: "before noon" });
    expect(gutterTime(byId(DAN))).toEqual({ kind: "tba", primary: "Time forthcoming", period: null, secondary: null });
    expect(entryTimeText(byId(DAN))).toBe("Time forthcoming");
    expect(entryTimeText(byId("tailgate-and-enterpriseworks-tour"))).toBe("Time forthcoming");
    expect(entryWhenText(byId(PANEL))).toBe("Tue, Sep 29 · 6:00–8:00 PM CT");
  });

  it("encodes certainty as line style", () => {
    expect(entryCertainty(byId(PANEL))).toBe("solid"); // confirmed, exact
    expect(entryCertainty(byId(PATRICK_OH))).toBe("dashed"); // availability window
    expect(entryCertainty(byId(ARNAV_OH))).toBe("dotted"); // exact times forthcoming
    expect(entryCertainty(byId(DAN))).toBe("dotted"); // time forthcoming
  });

  it("summarizes locations and time zones honestly", () => {
    expect(locationSummary(byId(PANEL).location)).toBe("100 MSEB");
    expect(locationSummary(byId(DAN).location)).toBe("Location forthcoming");
    expect(locationSummary({ kind: "virtual", platform: "Zoom" })).toBe("Virtual · Zoom");
    expect(timeZoneNote("2026-10-01", "10:00")).toBe("Central Time (CDT, UTC−5)");
    expect(timeZoneNote("2026-12-03", "10:00")).toBe("Central Time (CST, UTC−6)");
  });
});

describe("pending mentors", () => {
  it("lists scheduling-in-progress mentors with public fields and an application link", () => {
    const list = pendingMentors(publicMentors);
    expect(list.map((m) => m.id)).toEqual(["vikram-lakhwara", "ron-lewis"]);
    const [vik, ron] = list;
    expect(ron).toMatchObject({
      affiliation: "Co-Founder, Auctus Advisory",
      ctaLabel: "Express interest",
      href: "/office-hours?mentor=ron-lewis#apply",
    });
    expect(vik.affiliation).toBe("Stakehouse");
    expect(JSON.stringify(list)).not.toMatch(/Wednesday|commitments|Revenue strategy/i);
    expect(pendingMentorMatches(ron, "auctus")).toBe(true);
    expect(pendingMentorMatches(vik, "stakehouse")).toBe(true);
    expect(pendingMentorMatches(vik, "aerospace")).toBe(false);
  });
});
