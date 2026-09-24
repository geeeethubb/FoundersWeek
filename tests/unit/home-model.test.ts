/**
 * Home page data helpers against the public (default-env) content: priority order, computed
 * counts, the agenda preview, and that the canceled afterparty is gone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMentors, getScheduleDays, getScheduleEntries } from "@/content";
import {
  agendaPreviewEntries,
  foundersListingCount,
  homeFeaturedEvents,
  involvementSummaries,
  liveEntries,
  mentorNamesText,
  numberWord,
  pad2,
  relatedSummary,
  schedulingFirstNames,
  summaryTitle,
  titlesPreview,
  weekRange,
} from "@/components/home/home-model";

describe("home model (public data)", () => {
  beforeEach(() => {
    vi.stubEnv("SHOW_DEMO_CONTENT", "");
    vi.stubEnv("SHOW_DRAFT_CONTENT", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("features Dan Caruso's fireside chat, then the Sep 29 panel (office hours lead separately)", () => {
    const featured = homeFeaturedEvents(getScheduleEntries());
    expect(featured.map((e) => e.id)).toEqual(["dan-caruso-fireside-chat", "how-to-make-10k-a-month-in-college"]);
    expect(featured.map((e) => e.featuredRank)).toEqual([2, 3]);
    expect(featured.every((e) => e.kind === "event")).toBe(true);
  });

  it("previews the rest of the week chronologically, picks first when trimming", () => {
    const entries = getScheduleEntries();
    const preview = agendaPreviewEntries(entries);
    expect(preview).toHaveLength(5);
    // Never the featured items (they have their own sections) or office hours.
    expect(preview.some((e) => e.featuredRank !== null || e.kind === "office-hours")).toBe(false);
    // The Friday Founders Showcase (a Founders pick) makes the cut.
    expect(preview.map((e) => e.id)).toContain("founders-showcase-day-sessions");
    // Chronological.
    const keys = preview.map((e) => `${e.date}-${String(e.sortMinutes).padStart(4, "0")}`);
    expect([...keys].sort()).toEqual(keys);
    expect(agendaPreviewEntries(entries, 2)).toHaveLength(2);
    expect(agendaPreviewEntries(entries, 2).map((e) => e.id)).toContain("founders-showcase-day-sessions");
    expect(agendaPreviewEntries(entries, 0)).toEqual([]);
  });

  it("computes label counts from the data", () => {
    const entries = getScheduleEntries();
    const byLabel = Object.fromEntries(involvementSummaries(entries).map((s) => [s.involvement, s]));
    expect(Object.keys(byLabel)).toEqual(["hosted", "cohosted", "supported", "week"]);
    const officeHours = entries.filter((e) => e.kind === "office-hours").length;
    expect(byLabel.hosted.count).toBe(officeHours);
    expect(byLabel.hosted.titles).toEqual(["Founders Office Hours"]);
    expect(byLabel.cohosted).toMatchObject({ count: 1, titles: ["How to Make $10K/Month in College"] });
    expect(byLabel.supported).toMatchObject({ count: 1, titles: ["Dan Caruso — Fireside Chat"] });
    expect(byLabel.week.count).toBe(entries.filter((e) => e.involvement === "week").length);
    expect(byLabel.week.titles).toContain("Founders Evening Showcase and Reception");
    expect(relatedSummary(entries).titles).toEqual(["Dan Caruso — Fireside Chat", "How to Make $10K/Month in College"]);
    expect(foundersListingCount(entries)).toBe(officeHours + 2);
    const total = liveEntries(entries).length;
    expect(Object.values(byLabel).reduce((n, s) => n + s.count, 0)).toBe(total);
  });

  it("keeps the canceled afterparty out of every list", () => {
    const entries = getScheduleEntries();
    const all = JSON.stringify([
      agendaPreviewEntries(entries, 99),
      involvementSummaries(entries),
      homeFeaturedEvents(entries),
    ]);
    expect(all).not.toMatch(/afterparty|HERE Apartments/i);
    expect(all).toContain("Founders Evening Showcase and Reception");
  });

  it("names the mentors still scheduling and formats small numbers", () => {
    expect(schedulingFirstNames(getMentors())).toEqual(["Vik", "Ron"]);
    expect(mentorNamesText(getMentors())).toBe("Patrick Haddox, Arnav Mishra, Vikram “Vik” Lakhwara and Ron Lewis");
    expect(numberWord(4)).toBe("four");
    expect(numberWord(4, { capitalize: true })).toBe("Four");
    expect(numberWord(12)).toBe("12");
    expect(pad2(4)).toBe("04");
    expect(weekRange(getScheduleDays())).toBe("Mon Sep 28 – Sat Oct 3");
    expect(weekRange([])).toBeNull();
    expect(titlesPreview(["a", "b", "c", "d"])).toEqual({ shown: ["a", "b"], more: 2 });
    expect(summaryTitle({ kind: "office-hours", title: "Office hours with X" })).toBe("Founders Office Hours");
  });
});
