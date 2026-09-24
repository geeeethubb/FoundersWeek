/**
 * iCalendar (RFC 5545) export for schedule entries.
 *
 * - Times are exported as Central Time wall-clock values with `TZID=America/Chicago` and an
 *   embedded VTIMEZONE, so calendars show the time the organizer published (and follow DST),
 *   instead of a UTC conversion that could drift if the zone rules are applied differently.
 * - Only calendar-eligible entries (`entry.calendar.available`: confirmed, exact start + end,
 *   not office hours) are exported. Events whose time is still forthcoming never are.
 * - Program blocks export as one event (as the organizer published them) with their timed
 *   sub-sessions listed in DESCRIPTION.
 * - Output uses CRLF line endings and folds lines at 75 octets without splitting UTF-8 sequences.
 *
 * Pure: pass the site origin and "now" in, so output is deterministic in tests.
 */
import type { ISODate, LocalTime } from "@/content/types";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import { sessionLineText } from "@/lib/schedule/program";
import { EVENT_TIMEZONE, TZ_NAME } from "@/lib/time";

export const ICS_CONTENT_TYPE = "text/calendar; charset=utf-8";
const CRLF = "\r\n";
const PRODID = "-//Founders Illinois Entrepreneurs//Founders Week Guide//EN";
const UID_DOMAIN = "founders-week";

/**
 * America/Chicago since 2007: DST starts the 2nd Sunday of March at 02:00 (CST → CDT)
 * and ends the 1st Sunday of November at 02:00 (CDT → CST).
 */
const VTIMEZONE_CHICAGO = [
  "BEGIN:VTIMEZONE",
  `TZID:${EVENT_TIMEZONE}`,
  `X-LIC-LOCATION:${EVENT_TIMEZONE}`,
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:-0600",
  "TZOFFSETTO:-0500",
  "TZNAME:CDT",
  "DTSTART:19700308T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:-0500",
  "TZOFFSETTO:-0600",
  "TZNAME:CST",
  "DTSTART:19701101T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

/** Escape a TEXT value: backslash, semicolon, comma and newlines (RFC 5545 §3.3.11). */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Fold a content line so no physical line exceeds 75 octets (RFC 5545 §3.1). Continuation lines
 * start with a single space (which counts toward their 75). Splits only between code points, so a
 * multi-byte UTF-8 character is never cut in half.
 */
export function foldIcsLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    if (bytes + n > 75) {
      parts.push(current);
      current = " ";
      bytes = 1;
    }
    current += ch;
    bytes += n;
  }
  parts.push(current);
  return parts.join(CRLF);
}

/** "2026-10-01" + "10:30" → "20261001T103000" (local wall-clock, no zone suffix). */
export function icsLocalDateTime(date: ISODate, time: LocalTime): string {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

/** UTC timestamp for DTSTAMP: "20260923T171500Z". */
export function icsUtcDateTime(instant: Date): string {
  return instant.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Absolute URL of an entry's detail page. */
export function entryUrl(siteUrl: string, id: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/schedule/${id}`;
}

/** Location as a single line for calendar apps. `null` when not announced. */
export function icsLocation(entry: Pick<ScheduleEntry, "location">): string | null {
  const loc = entry.location;
  switch (loc.kind) {
    case "in-person":
      return [loc.venue, loc.room, loc.address].filter(Boolean).join(", ");
    case "hybrid":
      return [loc.venue, loc.room, loc.address, loc.url ? `Online: ${loc.url}` : "Also online"]
        .filter(Boolean)
        .join(", ");
    case "virtual":
      return [loc.platform ? `Virtual (${loc.platform})` : "Virtual", loc.url].filter(Boolean).join(", ");
    case "tba":
    default:
      return null;
  }
}

/**
 * Plain-text description: the summary; for program blocks, the timed sub-sessions (Central Time)
 * with their people; official information links; then a link back to the full listing.
 */
export function icsDescription(
  entry: Pick<ScheduleEntry, "id" | "summary"> & Partial<Pick<ScheduleEntry, "sessions" | "links">>,
  siteUrl: string,
): string {
  const sections = [entry.summary];
  const sessions = entry.sessions ?? [];
  if (sessions.length) {
    sections.push([`Program (${TZ_NAME}):`, ...sessions.map(sessionLineText)].join("\n"));
  }
  const links = entry.links ?? [];
  if (links.length) sections.push(links.map((l) => `${l.label}: ${l.url}`).join("\n"));
  sections.push(`Details and updates: ${entryUrl(siteUrl, entry.id)}`);
  return sections.join("\n\n");
}

/** Whether an entry can be exported (and the exact times it would use). */
export function calendarTimes(entry: ScheduleEntry): { start: LocalTime; end: LocalTime } | null {
  if (!entry.calendar.available) return null;
  if (entry.time.kind !== "exact" || !entry.time.end) return null;
  return { start: entry.time.start, end: entry.time.end };
}

function veventLines(entry: ScheduleEntry, opts: { siteUrl: string; now: Date }): string[] {
  const times = calendarTimes(entry);
  if (!times) return [];
  const location = icsLocation(entry);
  return [
    "BEGIN:VEVENT",
    `UID:${entry.id}@${UID_DOMAIN}`,
    `DTSTAMP:${icsUtcDateTime(opts.now)}`,
    `DTSTART;TZID=${EVENT_TIMEZONE}:${icsLocalDateTime(entry.date, times.start)}`,
    `DTEND;TZID=${EVENT_TIMEZONE}:${icsLocalDateTime(entry.date, times.end)}`,
    `SUMMARY:${escapeIcsText(entry.title)}`,
    `DESCRIPTION:${escapeIcsText(icsDescription(entry, opts.siteUrl))}`,
    ...(location ? [`LOCATION:${escapeIcsText(location)}`] : []),
    `URL:${entryUrl(opts.siteUrl, entry.id)}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "END:VEVENT",
  ];
}

/**
 * A complete VCALENDAR for the given entries. Ineligible entries are skipped, so callers can pass
 * a whole schedule. `name` becomes the calendar's display name in apps that support it.
 */
export function buildIcsCalendar(
  entries: ScheduleEntry[],
  opts: { siteUrl: string; now?: Date; name?: string },
): string {
  const now = opts.now ?? new Date();
  const events = entries.flatMap((e) => veventLines(e, { siteUrl: opts.siteUrl, now }));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(opts.name ? [`X-WR-CALNAME:${escapeIcsText(opts.name)}`] : []),
    `X-WR-TIMEZONE:${EVENT_TIMEZONE}`,
    ...VTIMEZONE_CHICAGO,
    ...events,
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join(CRLF) + CRLF;
}

/** Download filename for an entry: "<id>.ics". Ids are validated kebab-case slugs. */
export function icsFilename(id: string): string {
  return `${id.replace(/[^a-z0-9-]/gi, "-")}.ics`;
}
