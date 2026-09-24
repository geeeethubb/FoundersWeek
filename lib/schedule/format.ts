/**
 * Display helpers for schedule entries (agenda rows, previews, the event page).
 * Pure string formatting on top of lib/time.ts — deterministic, so server and client output match.
 */
import type { AvailabilityKind } from "@/components/ui/status";
import type { EventLocation, ISODate, LocalTime } from "@/content/types";
import { dateParts, describeTime, formatDate, formatTime, TZ_NAME } from "@/lib/time";
import type { ScheduleEntry } from "./entries";

/** Copy for an event whose time hasn't been announced (`time.kind === "tba"`). */
export const TIME_FORTHCOMING = "Time to be announced";
/** Copy for a location that hasn't been announced. */
export const LOCATION_FORTHCOMING = "Location to be announced";

/** Office-hours rows describe an availability window (exact) or an approximate one. */
export function entryAvailabilityKind(entry: Pick<ScheduleEntry, "time">): AvailabilityKind {
  return entry.time.kind === "exact" ? "window" : "window-approx";
}

function bound(time: LocalTime): string {
  if (time === "12:00") return "noon";
  if (time === "00:00") return "midnight";
  return formatTime(time);
}

/**
 * The agenda's time column as two short lines: "4:00 PM" / "to 6:00 PM", "Morning" / "before noon",
 * "Time to be announced" / null. `start`/`end` are `HH:mm` for <time dateTime> (exact times only).
 */
export function agendaTime(entry: Pick<ScheduleEntry, "time">): {
  main: string;
  sub: string | null;
  start: LocalTime | null;
  end: LocalTime | null;
} {
  const t = entry.time;
  if (t.kind === "exact") {
    const end = t.end ?? null;
    return { main: formatTime(t.start), sub: end ? `to ${formatTime(end)}` : null, start: t.start, end };
  }
  if (t.kind === "part-of-day") {
    const part = t.part.charAt(0).toUpperCase() + t.part.slice(1);
    const sub =
      t.after && t.before
        ? `${bound(t.after)}–${bound(t.before)}`
        : t.before
          ? `before ${bound(t.before)}`
          : t.after
            ? `after ${bound(t.after)}`
            : null;
    return { main: part, sub, start: null, end: null };
  }
  return { main: TIME_FORTHCOMING, sub: null, start: null, end: null };
}

/**
 * The entry's time as one line of text: "6:00–8:00 PM CT", "Morning, before noon CT",
 * "Time to be announced". Pass `{ zone: false }` to drop the "CT" suffix.
 */
export function entryTimeText(entry: Pick<ScheduleEntry, "time">, options: { zone?: boolean } = {}): string {
  if (entry.time.kind === "tba") return TIME_FORTHCOMING;
  const d = describeTime(entry.time);
  return options.zone === false ? d.bare : d.label;
}

/** Start time only, for compact lists: "6:00 PM", "Morning", "Time to be announced". */
export function entryStartText(entry: Pick<ScheduleEntry, "time">): { text: string; dateTime: string | null } {
  const t = agendaTime(entry);
  return { text: t.main, dateTime: t.start };
}

/** One-line location: "Illinois Conference Center", "Virtual · Zoom", "Location to be announced". */
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

/**
 * Location as display lines for the event page: venue, room, street address
 * (["Beckman Institute", "Auditorium (Room 1025)", "405 N. Mathews Ave., Urbana, IL 61801"]).
 */
export function locationLines(location: EventLocation): string[] {
  switch (location.kind) {
    case "in-person":
      return [location.venue, location.room, location.address].filter((s): s is string => Boolean(s));
    case "hybrid":
      return [location.venue, location.room, location.address, "Also online"].filter((s): s is string => Boolean(s));
    case "virtual":
      return [location.platform ? `Virtual · ${location.platform}` : "Virtual"];
    case "tba":
    default:
      return [LOCATION_FORTHCOMING];
  }
}

/** Day labels: { weekday: "Thu", monthDay: "Oct 1", long: "Thursday, October 1", short: "Thu, Oct 1" }. */
export function dayLabels(date: ISODate) {
  const p = dateParts(date);
  return {
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

/** AP-style month abbreviations for running text ("Sept 30", "Oct 3"). */
const AP_MONTHS = ["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

/** "2026-09-30" → "Sept 30". */
export function apMonthDay(date: ISODate): string {
  const p = dateParts(date);
  return `${AP_MONTHS[p.month - 1]} ${p.day}`;
}

/**
 * The calendar's one-line introduction, from the official dates and the first listed day:
 * "Founders Week runs Sept 30 – Oct 3, and related events begin Sept 28. All times Central Time."
 */
export function calendarIntro(
  weekName: string,
  dates: { start: ISODate; end: ISODate } | null,
  firstDay: ISODate | null,
): string {
  const zone = `All times ${TZ_NAME}.`;
  if (!dates) return `The ${weekName} calendar. ${zone}`;
  const runs =
    dates.start === dates.end
      ? `${weekName} is ${apMonthDay(dates.start)}`
      : `${weekName} runs ${apMonthDay(dates.start)} – ${apMonthDay(dates.end)}`;
  const related = firstDay && firstDay < dates.start ? `, and related events begin ${apMonthDay(firstDay)}` : "";
  return `${runs}${related}. ${zone}`;
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
