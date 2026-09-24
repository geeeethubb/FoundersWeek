/**
 * Display helpers for schedule entries (agenda rows, previews, featured cards, detail page).
 * Pure string formatting on top of lib/time.ts — deterministic, so server and client output match.
 */
import type { AvailabilityKind } from "@/components/ui/status";
import type { EventLocation, ISODate, LocalTime } from "@/content/types";
import { dateParts, describeTime, formatDate, formatTime, zoneAbbreviation } from "@/lib/time";
import type { ScheduleEntry } from "./entries";

/** Copy for an event whose time hasn't been announced (`time.kind === "tba"`). */
export const TIME_FORTHCOMING = "Time forthcoming";
/** Copy for a location that hasn't been announced. */
export const LOCATION_FORTHCOMING = "Location forthcoming";

/** Line style that encodes certainty: solid = confirmed, dashed = planned/window, dotted = TBA/forthcoming. */
export type Certainty = "solid" | "dashed" | "dotted";

export function entryCertainty(entry: Pick<ScheduleEntry, "status" | "time">): Certainty {
  if (entry.time.kind !== "exact") return "dotted";
  if (entry.status === "confirmed" || entry.status === "canceled") return "solid";
  if (entry.status === "tentative") return "dotted";
  return "dashed";
}

/** Office-hours rows describe an availability window (exact) or an approximate one. */
export function entryAvailabilityKind(entry: Pick<ScheduleEntry, "time">): AvailabilityKind {
  return entry.time.kind === "exact" ? "window" : "window-approx";
}

export interface GutterTime {
  kind: "exact" | "part-of-day" | "tba";
  /** Large figure: "10:00", "Morning", "Time forthcoming". */
  primary: string;
  /** "AM"/"PM" for exact times. */
  period: string | null;
  /** Second line: "–11:30 AM", "before noon". */
  secondary: string | null;
}

function bound(time: LocalTime): string {
  if (time === "12:00") return "noon";
  if (time === "00:00") return "midnight";
  return formatTime(time);
}

/** Compact time for the agenda gutter. */
export function gutterTime(entry: Pick<ScheduleEntry, "time">): GutterTime {
  const t = entry.time;
  if (t.kind === "exact") {
    const d = describeTime(t);
    return {
      kind: "exact",
      primary: d.start!.clock,
      period: d.start!.period,
      secondary: d.end ? `–${d.end.clock} ${d.end.period}` : null,
    };
  }
  if (t.kind === "part-of-day") {
    const part = t.part.charAt(0).toUpperCase() + t.part.slice(1);
    const secondary =
      t.after && t.before
        ? `${bound(t.after)}–${bound(t.before)}`
        : t.before
          ? `before ${bound(t.before)}`
          : t.after
            ? `after ${bound(t.after)}`
            : null;
    return { kind: "part-of-day", primary: part, period: null, secondary };
  }
  return { kind: "tba", primary: TIME_FORTHCOMING, period: null, secondary: null };
}

/**
 * The entry's time as one line of text: "6:00–8:00 PM CT", "Morning, before noon CT",
 * "Time forthcoming". Pass `{ zone: false }` to drop the "CT" suffix.
 */
export function entryTimeText(entry: Pick<ScheduleEntry, "time">, options: { zone?: boolean } = {}): string {
  if (entry.time.kind === "tba") return TIME_FORTHCOMING;
  const d = describeTime(entry.time);
  return options.zone === false ? d.bare : d.label;
}

/** Start time only, for compact lists: "6:00 PM", "Morning", "Time forthcoming". */
export function entryStartText(entry: Pick<ScheduleEntry, "time">): { text: string; dateTime: string | null } {
  const g = gutterTime(entry);
  if (g.kind === "exact" && entry.time.kind === "exact") {
    return { text: `${g.primary} ${g.period}`, dateTime: entry.time.start };
  }
  return { text: g.primary, dateTime: null };
}

/** "Tue, Sep 29 · 6:00–8:00 PM CT" — date and time on one line (featured cards, metadata). */
export function entryWhenText(entry: Pick<ScheduleEntry, "date" | "time">): string {
  return `${formatDate(entry.date, "short")} · ${entryTimeText(entry)}`;
}

/** One-line location: "Illinois Conference Center", "Virtual · Zoom", "Location forthcoming". */
export function locationSummary(location: EventLocation): string {
  switch (location.kind) {
    case "in-person":
      return [location.venue, location.room].filter(Boolean).join(" · ");
    case "hybrid":
      return `${[location.venue, location.room].filter(Boolean).join(" · ")} + online`;
    case "virtual":
      return location.platform ? `Virtual · ${location.platform}` : "Virtual";
    case "tba":
    default:
      return LOCATION_FORTHCOMING;
  }
}

function utcOffsetLabel(abbr: "CDT" | "CST"): string {
  return `UTC−${abbr === "CDT" ? 5 : 6}`;
}

/** "Central Time (CDT, UTC−5)" for the date/time an entry happens. */
export function timeZoneNote(date: ISODate, time?: LocalTime): string {
  const abbr = zoneAbbreviation(date, time);
  return `Central Time (${abbr}, ${utcOffsetLabel(abbr)})`;
}

/** Compact form: "CDT · UTC−5". */
export function timeZoneShort(date: ISODate, time?: LocalTime): string {
  const abbr = zoneAbbreviation(date, time);
  return `${abbr} · ${utcOffsetLabel(abbr)}`;
}

/** Start time for zone lookups (exact start, or noon when the time is approximate). */
export function referenceTime(entry: Pick<ScheduleEntry, "time">): LocalTime | undefined {
  return entry.time.kind === "exact" ? entry.time.start : undefined;
}

/** Day header labels: { mono: "THU · OCT 01", long: "Thursday, October 1", short: "Thu, Oct 1" }. */
export function dayLabels(date: ISODate) {
  const p = dateParts(date);
  return {
    mono: `${p.weekdayShort} · ${p.monthShort} ${p.dayPadded}`.toUpperCase(),
    weekday: p.weekdayShort,
    monthDay: `${p.monthShort} ${p.day}`,
    long: formatDate(date, "long"),
    full: formatDate(date, "full"),
    short: formatDate(date, "short"),
  };
}

/** "Mon Sep 28 – Sat Oct 3" for the first and last day of the calendar. */
export function dateRangeLabel(first: ISODate, last: ISODate): string {
  const a = dateParts(first);
  const b = dateParts(last);
  if (first === last) return `${a.weekdayShort} ${a.monthShort} ${a.day}`;
  return `${a.weekdayShort} ${a.monthShort} ${a.day} – ${b.weekdayShort} ${b.monthShort} ${b.day}`;
}

/** Featured rank as an index numeral: 1 → "01". */
export function rankNumeral(rank: number): string {
  return String(rank).padStart(2, "0");
}

/** Split a description into paragraphs on blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "A", "A and B", "A, B and C". */
export function listText(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
