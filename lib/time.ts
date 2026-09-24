/**
 * Time utilities. Every event time in /content is a wall-clock time in America/Chicago.
 *
 * Rules:
 * - Formatting of content dates/times is pure string math, so server and client render
 *   identical output regardless of the machine's timezone (no hydration mismatches).
 * - Converting to real instants (calendar export, overlap checks, appointments) goes through
 *   `zonedTimeToUtc`, which asks Intl for the zone offset, so DST is handled correctly.
 */
import type { ISODate, LocalTime, TimeSpec } from "@/content/types";

export const EVENT_TIMEZONE = "America/Chicago";
/** Short label shown next to every displayed time. */
export const TZ_LABEL = "CT";
export const TZ_NAME = "Central Time";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function isISODate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isLocalTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function parseISODate(date: ISODate): { year: number; month: number; day: number } {
  const m = DATE_RE.exec(date);
  if (!m || !isISODate(date)) throw new Error(`Invalid date "${date}" (expected YYYY-MM-DD)`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function parseLocalTime(time: LocalTime): { hour: number; minute: number } {
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`Invalid time "${time}" (expected HH:mm, 24-hour)`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** Minutes after local midnight. */
export function minutesOfDay(time: LocalTime): number {
  const { hour, minute } = parseLocalTime(time);
  return hour * 60 + minute;
}

// ---------------------------------------------------------------------------
// Zone conversion
// ---------------------------------------------------------------------------

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = offsetFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(timeZone, f);
  }
  return f;
}

/** UTC offset of `timeZone` at `instant`, in minutes (America/Chicago: -300 in CDT, -360 in CST). */
export function timeZoneOffsetMinutes(instant: Date, timeZone: string = EVENT_TIMEZONE): number {
  const parts = offsetFormatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const hour = get("hour") === 24 ? 0 : get("hour");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60000);
}

/**
 * Convert a wall-clock date/time in `timeZone` to the UTC instant.
 * Handles DST: e.g. 2026-10-03 18:00 Chicago → 2026-10-03T23:00:00Z (CDT, UTC-5),
 * 2026-12-03 18:00 Chicago → 2026-12-04T00:00:00Z (CST, UTC-6).
 */
export function zonedTimeToUtc(date: ISODate, time: LocalTime, timeZone: string = EVENT_TIMEZONE): Date {
  const { year, month, day } = parseISODate(date);
  const { hour, minute } = parseLocalTime(time);
  const naive = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = timeZoneOffsetMinutes(new Date(naive), timeZone);
  let result = naive - firstOffset * 60000;
  const secondOffset = timeZoneOffsetMinutes(new Date(result), timeZone);
  if (secondOffset !== firstOffset) result = naive - secondOffset * 60000;
  return new Date(result);
}

/** The Central Time calendar date and wall-clock time for an instant. */
export function utcToZoned(instant: Date, timeZone: string = EVENT_TIMEZONE): { date: ISODate; time: LocalTime } {
  const parts = offsetFormatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
}

/** Short zone abbreviation in effect on that date (CDT/CST). */
export function zoneAbbreviation(date: ISODate, time: LocalTime = "12:00"): "CDT" | "CST" {
  const offset = timeZoneOffsetMinutes(zonedTimeToUtc(date, time));
  return offset === -300 ? "CDT" : "CST";
}

// ---------------------------------------------------------------------------
// Deterministic formatting of content dates/times
// ---------------------------------------------------------------------------

export interface DateParts {
  year: number;
  month: number;
  day: number;
  weekdayLong: string;
  weekdayShort: string;
  monthLong: string;
  monthShort: string;
  /** Two-digit day, e.g. "01". */
  dayPadded: string;
}

export function dateParts(date: ISODate): DateParts {
  const { year, month, day } = parseISODate(date);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return {
    year,
    month,
    day,
    weekdayLong: WEEKDAYS_LONG[weekday],
    weekdayShort: WEEKDAYS_SHORT[weekday],
    monthLong: MONTHS_LONG[month - 1],
    monthShort: MONTHS_SHORT[month - 1],
    dayPadded: String(day).padStart(2, "0"),
  };
}

export type DateStyle =
  /** "Thursday, October 1" */
  | "long"
  /** "Thursday, October 1, 2026" */
  | "full"
  /** "Thu, Oct 1" */
  | "short"
  /** "Oct 1" */
  | "month-day"
  /** "Thu" */
  | "weekday";

export function formatDate(date: ISODate, style: DateStyle = "long"): string {
  const p = dateParts(date);
  switch (style) {
    case "full":
      return `${p.weekdayLong}, ${p.monthLong} ${p.day}, ${p.year}`;
    case "short":
      return `${p.weekdayShort}, ${p.monthShort} ${p.day}`;
    case "month-day":
      return `${p.monthShort} ${p.day}`;
    case "weekday":
      return p.weekdayShort;
    case "long":
    default:
      return `${p.weekdayLong}, ${p.monthLong} ${p.day}`;
  }
}

/** "18:00" → { clock: "6:00", period: "PM" } */
export function to12Hour(time: LocalTime): { clock: string; period: "AM" | "PM" } {
  const { hour, minute } = parseLocalTime(time);
  const period = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return { clock: `${h}:${String(minute).padStart(2, "0")}`, period };
}

/** "18:00" → "6:00 PM"; "12:00" → "12:00 PM" */
export function formatTime(time: LocalTime): string {
  const { clock, period } = to12Hour(time);
  return `${clock} ${period}`;
}

/** "10:00","11:30" → "10:00–11:30 AM"; "11:00","13:00" → "11:00 AM–1:00 PM" */
export function formatTimeRange(start: LocalTime, end?: LocalTime): string {
  if (!end) return formatTime(start);
  const s = to12Hour(start);
  const e = to12Hour(end);
  if (s.period === e.period) return `${s.clock}–${e.clock} ${e.period}`;
  return `${s.clock} ${s.period}–${e.clock} ${e.period}`;
}

const PART_LABEL = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;

function boundLabel(time: LocalTime): string {
  if (time === "12:00") return "noon";
  if (time === "00:00") return "midnight";
  return formatTime(time);
}

export interface TimeDescription {
  /** Full label including zone, e.g. "10:00–11:30 AM CT", "Morning, before noon CT", "Time TBA". */
  label: string;
  /** Label without the zone suffix. */
  bare: string;
  /** Compact start for agenda gutters, e.g. { clock: "10:00", period: "AM" }; null when not exact. */
  start: { clock: string; period: "AM" | "PM" } | null;
  end: { clock: string; period: "AM" | "PM" } | null;
  /** True when start (and end, if any) are exact. */
  exact: boolean;
}

export function describeTime(spec: TimeSpec): TimeDescription {
  switch (spec.kind) {
    case "exact": {
      const bare = formatTimeRange(spec.start, spec.end);
      return {
        label: `${bare} ${TZ_LABEL}`,
        bare,
        start: to12Hour(spec.start),
        end: spec.end ? to12Hour(spec.end) : null,
        exact: true,
      };
    }
    case "part-of-day": {
      let bare: string = PART_LABEL[spec.part];
      if (spec.after && spec.before) bare += `, ${boundLabel(spec.after)}–${boundLabel(spec.before)}`;
      else if (spec.before) bare += `, before ${boundLabel(spec.before)}`;
      else if (spec.after) bare += `, after ${boundLabel(spec.after)}`;
      return { label: `${bare} ${TZ_LABEL}`, bare, start: null, end: null, exact: false };
    }
    case "tba":
    default:
      return { label: "Time TBA", bare: "Time TBA", start: null, end: null, exact: false };
  }
}

const PART_DEFAULT_START = { morning: 6 * 60, afternoon: 12 * 60, evening: 17 * 60 } as const;

/** Sort key (minutes after midnight). Rough times sort at their earliest bound; TBA sorts last. */
export function timeSortMinutes(spec: TimeSpec): number {
  switch (spec.kind) {
    case "exact":
      return minutesOfDay(spec.start);
    case "part-of-day":
      return spec.after ? minutesOfDay(spec.after) : PART_DEFAULT_START[spec.part];
    case "tba":
    default:
      return 24 * 60;
  }
}

/** Real UTC interval for an exact time with an end. `null` otherwise. */
export function exactInterval(date: ISODate, spec: TimeSpec): { start: Date; end: Date } | null {
  if (spec.kind !== "exact" || !spec.end) return null;
  return { start: zonedTimeToUtc(date, spec.start), end: zonedTimeToUtc(date, spec.end) };
}

// ---------------------------------------------------------------------------
// Formatting real instants (timestamps from the database, deadlines)
// ---------------------------------------------------------------------------

const instantFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "Wed, Sep 23, 2:15 PM CT" — for timestamps (submission times, activity log). */
export function formatInstant(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return `${instantFormatter.format(d)} ${TZ_LABEL}`;
}

/** "Monday, September 28 at 11:59 PM CT" — for deadlines given as ISO timestamps. */
export function formatDeadline(iso: string): string {
  const instant = new Date(iso);
  const { date, time } = utcToZoned(instant);
  return `${formatDate(date, "long")} at ${formatTime(time)} ${TZ_LABEL}`;
}

/** ISO date `days` after `date`. */
export function addDays(date: ISODate, days: number): ISODate {
  const { year, month, day } = parseISODate(date);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return d.toISOString().slice(0, 10);
}
