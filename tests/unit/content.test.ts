import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { demoEvents, demoMentors } from "@/content/demo";
import { events } from "@/content/events";
import { mentors } from "@/content/mentors";
import { site } from "@/content/site";
import { ContentValidationError, validateContent } from "@/content/validate";
import { LATEST_MIGRATION } from "@/lib/db/client";
import { mentorCtaLabel, schedulingStatus } from "@/lib/mentors";
import { buildScheduleEntries, featuredEntries, mentorAppearances } from "@/lib/schedule/entries";

describe("content", () => {
  it("production content is valid and contains no demo items", () => {
    expect(() => validateContent({ events, mentors, forbidDemo: true })).not.toThrow();
    expect(events.some((e) => e.demo)).toBe(false);
    expect(mentors.some((m) => m.demo)).toBe(false);
  });

  it("demo content is valid and every item is flagged demo", () => {
    expect(() =>
      validateContent({ events: [...events, ...demoEvents], mentors: [...mentors, ...demoMentors], forbidDemo: false }),
    ).not.toThrow();
    expect(demoEvents.every((e) => e.demo)).toBe(true);
    expect(demoMentors.every((m) => m.demo)).toBe(true);
  });

  it("rejects demo items in production data", () => {
    expect(() => validateContent({ events: demoEvents, mentors: [], forbidDemo: true })).toThrow(
      ContentValidationError,
    );
  });

  it("rejects slots outside their window and bad times", () => {
    const bad = structuredClone(demoMentors[0]);
    bad.slots[0].start = "09:00";
    bad.slots[0].end = "09:30";
    expect(() => validateContent({ events: [], mentors: [bad], forbidDemo: false })).toThrow(/outside window/);

    const badEvent = structuredClone(events[0]);
    badEvent.time = { kind: "exact", start: "20:00", end: "18:00" };
    expect(() => validateContent({ events: [badEvent], mentors: [], forbidDemo: true })).toThrow(/End time/);
  });

  it("keeps the seed facts exactly as supplied", () => {
    const patrick = mentors.find((m) => m.id === "patrick-haddox")!;
    expect(patrick.role).toBe("CEO & Co-Founder");
    expect(patrick.company).toBe("Samara Aerospace");
    expect(patrick.availability).toHaveLength(1);
    expect(patrick.availability[0]).toMatchObject({
      date: "2026-10-01",
      time: { kind: "exact", start: "10:00", end: "11:30" },
    });
    expect(patrick.slots).toHaveLength(0); // a window, not two confirmed bookings
    expect(patrick.askMeAbout).toBeNull(); // never inferred from title

    const arnav = mentors.find((m) => m.id === "arnav-mishra")!;
    expect(arnav.company).toBe("Doss");
    expect(arnav.role).toBe("Co-Founder & CTO");
    expect(arnav.slots).toHaveLength(0);
    expect(arnav.availability[0]).toMatchObject({
      date: "2026-10-02",
      time: { kind: "part-of-day", part: "morning", before: "12:00" },
    });

    const ron = mentors.find((m) => m.id === "ron-lewis")!;
    expect(ron).toMatchObject({ role: "Co-Founder", company: "Auctus Advisory", availability: [], slots: [] });
    expect(ron.links).toEqual([{ label: "LinkedIn", url: "https://www.linkedin.com/in/ronlewis20/" }]);
    expect(ron.askMeAbout?.status).toBe("draft"); // pending Ron's confirmation
    expect(schedulingStatus(ron)).toBe("in-progress");
    expect(mentorCtaLabel(ron)).toBe("Express interest");

    const vikram = mentors.find((m) => m.id === "vikram-lakhwara")!;
    expect(vikram).toMatchObject({ role: null, askMeAbout: null, company: "Stakehouse", firstName: "Vik" });
    expect(vikram.name).toBe("Vikram “Vik” Lakhwara");
    expect(vikram.availability).toEqual([]); // commitments Wed–Sat morning are not available slots
    expect(vikram.bio?.value).not.toMatch(/Wednesday|commitment/i);
    expect(mentorCtaLabel(vikram)).toBe("Express interest");
    expect(mentorCtaLabel(patrick)).toBe("Apply to meet Patrick");

    // The Founders afterparty was canceled: it must not exist anywhere in the data.
    expect(events.some((e) => /afterparty|HERE Apartments/i.test(JSON.stringify(e)))).toBe(false);
    // …but the university's Friday evening showcase and reception stays.
    expect(events.find((e) => e.id === "founders-evening-showcase-and-reception")).toMatchObject({
      date: "2026-10-02",
      time: { kind: "exact", start: "18:00", end: "20:30" },
      involvement: "week",
    });

    const dan = events.find((e) => e.id === "dan-caruso-fireside-chat")!;
    expect(dan).toMatchObject({ date: "2026-09-28", involvement: "supported", registration: null, time: { kind: "tba" } });
    expect(dan.featured?.rank).toBe(2);

    const panel = events.find((e) => e.id === "how-to-make-10k-a-month-in-college")!;
    expect(panel).toMatchObject({
      title: "How to Make $10K/Month in College",
      date: "2026-09-29",
      time: { kind: "exact", start: "18:00", end: "20:00" },
      involvement: "cohosted",
      location: { kind: "in-person", venue: "100 MSEB" },
    });
    expect(panel.featured?.rank).toBe(3);
    expect(site.applications.deadline).toBeNull();
  });

  it("builds office-hours entries from mentor windows", () => {
    const entries = buildScheduleEntries({ events, mentors, site });
    const oh = entries.filter((e) => e.kind === "office-hours");
    expect(oh.map((e) => e.id)).toEqual([
      "office-hours-patrick-haddox-2026-10-01-am",
      "office-hours-arnav-mishra-2026-10-02-am",
    ]);
    expect(oh.every((e) => !e.calendar.available)).toBe(true);
    expect(oh[0].startsAt).toBe("2026-10-01T15:00:00.000Z");
    expect(oh[1].startsAt).toBeNull();
    expect(oh.every((e) => e.featuredRank === 1 && e.registration?.url.startsWith("/office-hours?"))).toBe(true);

    // Featured order: office hours, then Dan Caruso, then the Sep 29 panel.
    expect(featuredEntries(entries).map((e) => e.id)).toEqual([
      "office-hours-patrick-haddox-2026-10-01-am",
      "office-hours-arnav-mishra-2026-10-02-am",
      "dan-caruso-fireside-chat",
      "how-to-make-10k-a-month-in-college",
    ]);
    // Calendar export: confirmed exact events only.
    expect(entries.find((e) => e.id === "how-to-make-10k-a-month-in-college")!.calendar.available).toBe(true);
    expect(entries.find((e) => e.id === "dan-caruso-fireside-chat")!.calendar.available).toBe(false);

    // Mentors on stage are linked from the agenda.
    expect(mentorAppearances(entries, "arnav-mishra").map((a) => a.start)).toEqual(["13:55"]);
    expect(mentorAppearances(entries, "patrick-haddox").map((a) => a.sessionTitle)).toEqual([
      "Next Generation Industrial, Manufacturing and Space Tech",
    ]);
    expect(mentorAppearances(entries, "vikram-lakhwara")).toHaveLength(1);
    expect(mentorAppearances(entries, "ron-lewis")).toHaveLength(0);
    // Chronological order
    expect(entries.map((e) => e.date)).toEqual([...entries.map((e) => e.date)].sort());
  });

  it("LATEST_MIGRATION matches the newest migration file", () => {
    const files = readdirSync(path.join(process.cwd(), "db", "migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    expect(files.at(-1)).toBe(`${LATEST_MIGRATION}.sql`);
  });
});
