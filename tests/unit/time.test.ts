import { describe, expect, it } from "vitest";
import {
  addDays,
  describeTime,
  formatDate,
  formatDeadline,
  formatTime,
  formatTimeRange,
  timeSortMinutes,
  timeZoneOffsetMinutes,
  utcToZoned,
  zonedTimeToUtc,
  zoneAbbreviation,
} from "@/lib/time";

describe("zonedTimeToUtc (America/Chicago)", () => {
  it("converts Founders Week times during daylight time (UTC-5)", () => {
    expect(zonedTimeToUtc("2026-10-01", "10:00").toISOString()).toBe("2026-10-01T15:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-03", "18:00").toISOString()).toBe("2026-10-03T23:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-03", "20:00").toISOString()).toBe("2026-10-04T01:00:00.000Z");
  });

  it("converts standard time (UTC-6) after DST ends on Nov 1, 2026", () => {
    expect(zonedTimeToUtc("2026-11-02", "18:00").toISOString()).toBe("2026-11-03T00:00:00.000Z");
    expect(zonedTimeToUtc("2026-12-03", "09:30").toISOString()).toBe("2026-12-03T15:30:00.000Z");
  });

  it("handles the DST boundaries", () => {
    // Fall back: 01:30 happens twice; either interpretation is acceptable, but 03:00 is unambiguous CST.
    expect(zonedTimeToUtc("2026-11-01", "03:00").toISOString()).toBe("2026-11-01T09:00:00.000Z");
    // Spring forward (Mar 8, 2026): 03:30 CDT.
    expect(zonedTimeToUtc("2026-03-08", "03:30").toISOString()).toBe("2026-03-08T08:30:00.000Z");
  });

  it("round-trips through utcToZoned", () => {
    for (const [d, t] of [
      ["2026-10-01", "10:00"],
      ["2026-10-02", "11:59"],
      ["2026-12-31", "23:15"],
      ["2027-01-01", "00:05"],
    ] as const) {
      expect(utcToZoned(zonedTimeToUtc(d, t))).toEqual({ date: d, time: t });
    }
  });

  it("reports offsets and abbreviations", () => {
    expect(timeZoneOffsetMinutes(new Date("2026-10-01T15:00:00Z"))).toBe(-300);
    expect(timeZoneOffsetMinutes(new Date("2026-12-01T15:00:00Z"))).toBe(-360);
    expect(zoneAbbreviation("2026-10-01")).toBe("CDT");
    expect(zoneAbbreviation("2026-12-01")).toBe("CST");
  });

  it("rejects invalid input", () => {
    expect(() => zonedTimeToUtc("2026-02-30", "10:00")).toThrow();
    expect(() => zonedTimeToUtc("2026-10-01", "24:00")).toThrow();
    expect(() => zonedTimeToUtc("2026-10-01", "9:00")).toThrow();
  });
});

describe("formatting (deterministic, no runtime timezone)", () => {
  it("formats dates", () => {
    expect(formatDate("2026-10-01")).toBe("Thursday, October 1");
    expect(formatDate("2026-10-02", "short")).toBe("Fri, Oct 2");
    expect(formatDate("2026-10-03", "full")).toBe("Saturday, October 3, 2026");
    expect(formatDate("2026-10-03", "month-day")).toBe("Oct 3");
  });

  it("formats times and ranges", () => {
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
    expect(formatTime("18:00")).toBe("6:00 PM");
    expect(formatTimeRange("10:00", "11:30")).toBe("10:00–11:30 AM");
    expect(formatTimeRange("11:00", "13:00")).toBe("11:00 AM–1:00 PM");
    expect(formatTimeRange("18:00", "20:00")).toBe("6:00–8:00 PM");
  });

  it("describes time specs with the Central Time label", () => {
    expect(describeTime({ kind: "exact", start: "10:00", end: "11:30" }).label).toBe("10:00–11:30 AM CT");
    expect(describeTime({ kind: "part-of-day", part: "morning", before: "12:00" }).label).toBe(
      "Morning, before noon CT",
    );
    expect(describeTime({ kind: "tba" }).label).toBe("Time TBA");
  });

  it("sorts rough times sensibly", () => {
    expect(timeSortMinutes({ kind: "exact", start: "10:00" })).toBe(600);
    expect(timeSortMinutes({ kind: "part-of-day", part: "morning" })).toBe(360);
    expect(timeSortMinutes({ kind: "tba" })).toBe(1440);
  });

  it("formats deadlines in Central Time", () => {
    expect(formatDeadline("2026-09-29T04:59:00Z")).toBe("Monday, September 28 at 11:59 PM CT");
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
  });
});
