/**
 * Pure helpers for the home page and the social images (no React, no '@/content'). Everything the
 * home page says is derived here from public content — mentors from `getMentors()`, entries from
 * `getScheduleEntries()`, settings from `getSite()` — so nothing is hard-coded.
 *
 * Dates use the house style of the home page and social cards: "Sept 28", "Mon, Sept 28",
 * "Sept 30 – Oct 3".
 */
import type { EventLocation, Involvement, ISODate, Mentor, SiteSettings, TimeSpec } from "@/content/types";
import { EXACT_TIME_TO_BE_CONFIRMED, SCHEDULING_IN_PROGRESS_LABEL, schedulingStatus } from "@/lib/mentors";
import { featuredEntries, type ScheduleEntry } from "@/lib/schedule/entries";
import { eventHref } from "@/lib/schedule/url";
import { dateParts, describeTime, timeSortMinutes } from "@/lib/time";

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** "Sep" → "Sept" (AP style); other months keep their three-letter form. */
function monthAbbr(date: ISODate): string {
  const p = dateParts(date);
  return p.monthShort === "Sep" ? "Sept" : p.monthShort;
}

/** "Sept 28" */
export function monthDay(date: ISODate): string {
  return `${monthAbbr(date)} ${dateParts(date).day}`;
}

/** "Mon, Sept 28" */
export function shortDate(date: ISODate): string {
  return `${dateParts(date).weekdayShort}, ${monthDay(date)}`;
}

/** "Monday, Sept 28" */
export function longDate(date: ISODate): string {
  return `${dateParts(date).weekdayLong}, ${monthDay(date)}`;
}

/** "Sept 30 – Oct 3" · "Oct 1–3" · "Oct 1" */
export function dateRange(start: ISODate, end: ISODate): string {
  if (start === end) return monthDay(start);
  const a = dateParts(start);
  const b = dateParts(end);
  if (a.year === b.year && a.month === b.month) return `${monthAbbr(start)} ${a.day}–${b.day}`;
  return `${monthDay(start)} – ${monthDay(end)}`;
}

/** The official Founders Week dates, e.g. "Sept 30 – Oct 3", or null when not published. */
export function officialDates(site: Pick<SiteSettings, "week">): string | null {
  const d = site.week.dates;
  return d ? dateRange(d.start, d.end) : null;
}

/** Entries that are actually happening (canceled entries never count). */
export function liveEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
  return entries.filter((e) => e.status !== "canceled");
}

/**
 * The first date of a live listing before the official program starts ("Sept 28"), or null when
 * nothing on the calendar comes before the official dates.
 */
export function relatedEventsStart(entries: ScheduleEntry[], site: Pick<SiteSettings, "week">): string | null {
  const start = site.week.dates?.start;
  if (!start) return null;
  const earlier = liveEntries(entries)
    .map((e) => e.date)
    .filter((d) => d < start)
    .sort();
  return earlier.length ? monthDay(earlier[0]) : null;
}

/**
 * The note next to the calendar link:
 * "The official Founders Week program runs Sept 30 – Oct 3, and related events begin Sept 28."
 */
export function calendarNote(entries: ScheduleEntry[], site: Pick<SiteSettings, "week">): string | null {
  const official = officialDates(site);
  if (!official) return null;
  const related = relatedEventsStart(entries, site);
  return `The official ${site.week.name} program runs ${official}${related ? `, and related events begin ${related}` : ""}.`;
}

/**
 * The one sentence that explains office hours (hero). Accurate to the data: who arranges them,
 * when, and that one application covers every mentor. It never promises one-on-one time.
 */
export function officeHoursSentence(site: Pick<SiteSettings, "week" | "org">): string {
  const official = officialDates(site);
  return `During ${site.week.name}${official ? ` (${official})` : ""}, ${site.org.name} is setting up office hours with startup founders and investors, and one short application covers every mentor.`;
}

// ---------------------------------------------------------------------------
// Times and places
// ---------------------------------------------------------------------------

export const TIME_TO_BE_ANNOUNCED = "Time to be announced";
export const PLACE_TO_BE_ANNOUNCED = "Location to be announced";

/** "4:00 PM CT" · "6:00–8:00 PM CT" · "Morning, before noon CT" · "Time to be announced" */
export function timeText(time: TimeSpec): string {
  return time.kind === "tba" ? TIME_TO_BE_ANNOUNCED : describeTime(time).label;
}

/** Venue and room: "Beckman Institute, Auditorium (Room 1025)" · "Online" · "Location to be announced". */
export function placeText(location: EventLocation): string {
  switch (location.kind) {
    case "in-person":
      return [location.venue, location.room].filter(Boolean).join(", ");
    case "hybrid":
      return `${[location.venue, location.room].filter(Boolean).join(", ")} and online`;
    case "virtual":
      return location.platform ? `Online · ${location.platform}` : "Online";
    case "tba":
    default:
      return PLACE_TO_BE_ANNOUNCED;
  }
}

/** Street address when one is published, else null. */
export function addressText(location: EventLocation): string | null {
  return location.kind === "in-person" || location.kind === "hybrid" ? (location.address ?? null) : null;
}

// ---------------------------------------------------------------------------
// Mentor previews
// ---------------------------------------------------------------------------

export type PreviewAvailability =
  | {
      known: true;
      /** "Thu, Oct 1" */
      date: string;
      /** "10:00–11:30 AM CT" · "Morning, before noon CT" · "Exact time to be confirmed" */
      time: string;
      /** For <time dateTime>. */
      dateTime: ISODate;
      /** Further published windows beyond the first. */
      more: number;
    }
  | { known: false; label: string };

export interface MentorPreview {
  id: string;
  name: string;
  /** Verified role and company (either may be missing). */
  role: string | null;
  company: string | null;
  headshot: Mentor["headshot"];
  /** The mentor's profile page. */
  href: string;
  availability: PreviewAvailability;
}

/** Public profile page for a mentor. */
export function mentorProfilePath(id: string): string {
  return `/office-hours/${encodeURIComponent(id)}`;
}

/**
 * One availability line: the mentor's earliest published window ("Thu, Oct 1 · 10:00–11:30 AM CT",
 * or "Thu, Oct 1 · Exact time to be confirmed" for a date-only window, as on the profile) or
 * "Scheduling in progress". A window is general availability, never a booking.
 */
export function previewAvailability(mentor: Pick<Mentor, "availability" | "slots">): PreviewAvailability {
  const windows = [...mentor.availability].sort((a, b) =>
    a.date === b.date ? timeSortMinutes(a.time) - timeSortMinutes(b.time) : a.date.localeCompare(b.date),
  );
  const first = windows[0];
  if (schedulingStatus(mentor) === "in-progress" || !first) {
    return { known: false, label: SCHEDULING_IN_PROGRESS_LABEL };
  }
  return {
    known: true,
    date: shortDate(first.date),
    time: first.time.kind === "tba" ? EXACT_TIME_TO_BE_CONFIRMED : timeText(first.time),
    dateTime: first.date,
    more: windows.length - 1,
  };
}

/** Every mentor, in content order, as a compact preview. */
export function mentorPreviews(mentors: Mentor[]): MentorPreview[] {
  return mentors.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    company: m.company,
    headshot: m.headshot,
    href: mentorProfilePath(m.id),
    availability: previewAvailability(m),
  }));
}

/** "Patrick Haddox, Arnav Mishra, … and Rishab Veldur" */
export function namesText(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// ---------------------------------------------------------------------------
// Featured events
// ---------------------------------------------------------------------------

/**
 * The featured events after office hours, in priority order — Dan Caruso's fireside chat, the Sept 29
 * panel, the Sept 30 happy hour at Legends, then Founder Failure Lab. Office hours have the hero;
 * canceled entries are never featured.
 */
export function homeFeaturedEvents(entries: ScheduleEntry[], limit = 4): ScheduleEntry[] {
  return featuredEntries(entries)
    .filter((e) => e.kind === "event")
    .slice(0, Math.max(0, limit));
}

export interface FeaturedEventView {
  id: string;
  title: string;
  /** The event page. */
  href: string;
  involvement: Involvement | null;
  /** "Monday, Sept 28" */
  date: string;
  /** "4:00 PM CT" */
  time: string;
  /** Local "2026-09-28T16:00" (or the date) for <time dateTime>. */
  dateTime: string;
  place: string;
  address: string | null;
}

export function featuredEventView(entry: ScheduleEntry): FeaturedEventView {
  return {
    id: entry.id,
    title: entry.title,
    href: eventHref(entry.id),
    involvement: entry.involvement,
    date: longDate(entry.date),
    time: timeText(entry.time),
    dateTime: entry.time.kind === "exact" ? `${entry.date}T${entry.time.start}` : entry.date,
    place: placeText(entry.location),
    address: addressText(entry.location),
  };
}
