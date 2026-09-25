/**
 * Normalized schedule entries: what every schedule view (home preview, agenda, event page,
 * calendar export) consumes. Pure functions — safe on server and client.
 *
 * Office-hours entries are generated from mentor availability windows so a time only ever
 * lives in one place (content/mentors.ts).
 */
import type {
  AvailabilityWindow,
  ConfirmationStatus,
  EventLocation,
  EventType,
  ISODate,
  Involvement,
  Mentor,
  ProgramSession,
  ScheduleEvent,
  SiteSettings,
  SourceRef,
  Speaker,
  TimeSpec,
} from "@/content/types";
import { OFFICE_HOURS_ID_PREFIX } from "@/content/validate";
import { APPLICATION_COPY } from "@/lib/applications/constants";
import { describeTime, exactInterval, formatDate, timeSortMinutes } from "@/lib/time";
import { sessionRuleText } from "./sessions";

export type CalendarAvailability = { available: true } | { available: false; reason: string };

export interface ScheduleEntry {
  id: string;
  kind: "event" | "office-hours";
  title: string;
  date: ISODate;
  time: TimeSpec;
  /** Display override for the time (e.g. "Friday morning · Exact times TBA"). */
  timeLabel: string | null;
  status: ConfirmationStatus;
  statusNote: string | null;
  types: EventType[];
  involvement: Involvement | null;
  foundersPick: boolean;
  /** Who runs it; null when the source doesn't say. */
  organizer: string | null;
  location: EventLocation;
  summary: string;
  description: string;
  /** Verified speakers only. */
  speakers: Speaker[];
  topics: string[];
  /** External registration, or the internal application link for office hours. */
  registration: { url: string; label: string; internal: boolean } | null;
  /** Official information links (e.g. "Event information"). */
  links: { label: string; url: string }[];
  /** Timed sub-sessions of a program block (verified people only). Empty for single events. */
  sessions: ProgramSession[];
  /**
   * Priority for featured placement (1 = office hours, 2 = Dan Caruso, 3 = Sep 29 panel…).
   * null = not featured. Agenda order stays chronological regardless.
   */
  featuredRank: number | null;
  /** Related event outside the official Founders Week program. */
  related: boolean;
  /** Informational note for the event page (no call to action). */
  callout: { title: string; body: string } | null;
  /**
   * Office hours with an exact window: how sessions run, from `site.officeHours` ("Each session is
   * 25 minutes, with a 5-minute break between sessions."). Never a session count. `null` for events
   * and for rough windows (part of day, time to be confirmed), as on mentor profiles.
   */
  sessionRule: string | null;
  sources: SourceRef[];
  mentor: {
    id: string;
    name: string;
    firstName: string;
    role: string | null;
    company: string | null;
    windowId: string;
  } | null;
  demo: boolean;
  /** Minutes after local midnight, for chronological sorting. */
  sortMinutes: number;
  /** UTC ISO timestamps when the time is exact (with an end), else null. */
  startsAt: string | null;
  endsAt: string | null;
  calendar: CalendarAvailability;
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  talk: "Talk",
  panel: "Panel",
  workshop: "Workshop",
  networking: "Networking",
  "office-hours": "Office hours",
  pitch: "Pitch",
  social: "Social",
  other: "Other",
};

export const INVOLVEMENT_LABELS: Record<Involvement, string> = {
  hosted: "Hosted by Founders",
  cohosted: "Co-hosted by Founders",
  supported: "Supported by Founders",
  week: "Part of Founders Week",
};

export const INVOLVEMENT_DESCRIPTIONS: Record<Involvement, string> = {
  hosted: "Organized and run by Founders – Illinois Entrepreneurs.",
  cohosted: "Organized jointly by Founders – Illinois Entrepreneurs and another host.",
  supported: "Organized by another group, with support from Founders.",
  week: "Part of the Founders Week series, organized by another group.",
};

/** Strongest Founders involvement first (hosted → cohosted → supported → week → none). */
export const INVOLVEMENT_ORDER: Involvement[] = ["hosted", "cohosted", "supported", "week"];

/** Label for events outside the official Founders Week program. */
export const RELATED_EVENT_LABEL = "Related event";

/** Featured rank reserved for office hours (always the top priority). */
export const OFFICE_HOURS_FEATURED_RANK = 1;

export const STATUS_LABELS: Record<ConfirmationStatus, string> = {
  confirmed: "Confirmed",
  planned: "Planned",
  tentative: "Tentative",
  canceled: "Canceled",
};

export const STATUS_DESCRIPTIONS: Record<ConfirmationStatus, string> = {
  confirmed: "Date, time and place confirmed by the organizer.",
  planned: "Announced, but the organizer hasn’t confirmed the final details yet.",
  tentative: "Still being arranged, so details may change.",
  canceled: "This event was canceled.",
};

export function calendarAvailability(
  kind: ScheduleEntry["kind"],
  status: ConfirmationStatus,
  time: TimeSpec,
): CalendarAvailability {
  if (kind === "office-hours") {
    return {
      available: false,
      reason: "Office hours are by application. Selected students get their confirmed time by email.",
    };
  }
  if (status === "canceled") return { available: false, reason: "This event was canceled." };
  if (status !== "confirmed") {
    return { available: false, reason: "Calendar export opens once the organizer confirms the date and time." };
  }
  if (time.kind !== "exact") {
    return { available: false, reason: "Calendar export opens once an exact time is announced." };
  }
  if (!time.end) {
    return { available: false, reason: "Calendar export opens once an end time is announced." };
  }
  return { available: true };
}

function withInterval(date: ISODate, time: TimeSpec) {
  const interval = exactInterval(date, time);
  return {
    startsAt: interval ? interval.start.toISOString() : null,
    endsAt: interval ? interval.end.toISOString() : null,
  };
}

export function eventToEntry(event: ScheduleEvent): ScheduleEntry {
  return {
    id: event.id,
    kind: "event",
    title: event.title,
    date: event.date,
    time: event.time,
    timeLabel: null,
    status: event.status,
    statusNote: event.statusNote ?? null,
    types: event.types,
    involvement: event.involvement,
    foundersPick: event.foundersPick,
    organizer: event.organizer,
    location: event.location,
    summary: event.summary,
    description: event.description,
    speakers: event.speakers.filter((s) => s.verified),
    topics: event.topics,
    registration: event.registration
      ? { url: event.registration.url, label: event.registration.label ?? "Register", internal: false }
      : null,
    links: event.links ?? [],
    sessions: (event.sessions ?? []).map((s) => ({ ...s, people: s.people.filter((p) => p.verified) })),
    featuredRank: event.featured?.rank ?? null,
    related: Boolean(event.related),
    callout: event.callout ?? null,
    sessionRule: null,
    sources: event.sources,
    mentor: null,
    demo: Boolean(event.demo),
    sortMinutes: timeSortMinutes(event.time),
    ...withInterval(event.date, event.time),
    calendar: calendarAvailability("event", event.status, event.time),
  };
}

export function mentorAffiliation(mentor: Pick<Mentor, "role" | "company">): string | null {
  if (mentor.role && mentor.company) return `${mentor.role}, ${mentor.company}`;
  return mentor.company ?? mentor.role ?? null;
}

export function officeHoursEntryId(window: Pick<AvailabilityWindow, "id">): string {
  return `${OFFICE_HOURS_ID_PREFIX}${window.id}`;
}

/** Where the office-hours application lives: a section of the Office Hours page. */
export const APPLY_PATH = "/office-hours";
export const APPLY_ANCHOR = "apply";

/**
 * Link to the office-hours application with preferences prefilled, e.g.
 * /office-hours?mentor=patrick-haddox&window=patrick-haddox-2026-10-01-am#apply
 */
export function applyHref(
  params: { mentorId?: string; optionKind?: "window" | "slot"; optionId?: string } = {},
): string {
  const q = new URLSearchParams();
  if (params.mentorId) q.set("mentor", params.mentorId);
  if (params.optionKind && params.optionId) q.set(params.optionKind, params.optionId);
  const s = q.toString();
  return `${APPLY_PATH}${s ? `?${s}` : ""}#${APPLY_ANCHOR}`;
}

export function officeHoursToEntries(mentor: Mentor, site: SiteSettings): ScheduleEntry[] {
  return mentor.availability.map((window) => {
    const affiliation = mentorAffiliation(mentor);
    const when = window.label ?? `${formatDate(window.date, "long")}, ${describeTime(window.time).label}`;
    const status: ConfirmationStatus =
      mentor.session.confirmed && window.time.kind === "exact" ? "confirmed" : "planned";
    const locationNote = mentor.session.location
      ? null
      : "Location is shared with selected students once confirmed.";
    const location: EventLocation = mentor.session.location
      ? { kind: "in-person", venue: mentor.session.location, ...(mentor.session.address ? { address: mentor.session.address } : {}) }
      : { kind: "tba", note: locationNote ?? undefined };

    const intro = `${mentor.name}${affiliation ? ` (${affiliation})` : ""} is available for office hours: ${when}.`;
    const note = window.note ?? mentor.session.note;
    // Skip the "not a booked appointment" line when the mentor's note already says so.
    const notBooked =
      note && /booked appointment/i.test(note) ? null : "This is an availability window, not a booked appointment.";
    // Exact windows are split into sessions on the site's grid (lib/schedule/sessions.ts).
    const sessionRule = window.time.kind === "exact" ? sessionRuleText(site.officeHours) : null;
    const how = [notBooked, sessionRule, APPLICATION_COPY.limited].filter(Boolean).join(" ");
    const description = [intro, note, how].filter(Boolean).join("\n\n");

    return {
      id: officeHoursEntryId(window),
      kind: "office-hours" as const,
      title: `Office hours with ${mentor.name}`,
      date: window.date,
      time: window.time,
      timeLabel: window.label ?? null,
      status,
      statusNote:
        status === "confirmed"
          ? null
          : (mentor.session.note ?? "Appointment times and location are still being set."),
      types: ["office-hours"],
      involvement: "hosted" as const,
      foundersPick: true,
      organizer: site.org.name,
      location,
      summary: `By application. Meet ${mentor.firstName}${mentor.company ? ` of ${mentor.company}` : ""} during Founders Week. Appointments are limited.`,
      description,
      speakers: [],
      topics: mentor.askMeAbout?.status === "approved" ? mentor.askMeAbout.value : [],
      registration: {
        url: applyHref({ mentorId: mentor.id, optionKind: "window", optionId: window.id }),
        label: `Apply to meet ${mentor.firstName}`,
        internal: true,
      },
      links: [],
      sessions: [],
      featuredRank: OFFICE_HOURS_FEATURED_RANK,
      related: false,
      callout: null,
      sessionRule,
      sources: mentor.sources,
      mentor: {
        id: mentor.id,
        name: mentor.name,
        firstName: mentor.firstName,
        role: mentor.role,
        company: mentor.company,
        windowId: window.id,
      },
      demo: Boolean(mentor.demo),
      sortMinutes: timeSortMinutes(window.time),
      ...withInterval(window.date, window.time),
      calendar: calendarAvailability("office-hours", status, window.time),
    };
  });
}

/**
 * Chronological order: date, then start. Ties (e.g. two events whose time is still TBA) keep the
 * order they're listed in /content — Array.prototype.sort is stable.
 */
export function compareEntries(a: ScheduleEntry, b: ScheduleEntry): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.sortMinutes - b.sortMinutes;
}

export function buildScheduleEntries(input: {
  events: ScheduleEvent[];
  mentors: Mentor[];
  site: SiteSettings;
}): ScheduleEntry[] {
  const entries = [
    ...input.events.map(eventToEntry),
    ...input.mentors.flatMap((m) => officeHoursToEntries(m, input.site)),
  ];
  return entries.sort(compareEntries);
}

/** Distinct dates that have entries, ascending. */
export function scheduleDays(entries: ScheduleEntry[]): ISODate[] {
  return [...new Set(entries.map((e) => e.date))].sort();
}

/**
 * Featured entries in priority order (office hours first, then ranked events), for promotional
 * sections. Canceled entries are never featured.
 */
export function featuredEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
  return entries
    .filter((e) => e.featuredRank !== null && e.status !== "canceled")
    .sort((a, b) => a.featuredRank! - b.featuredRank! || compareEntries(a, b));
}

export interface MentorAppearance {
  entryId: string;
  entryTitle: string;
  date: ISODate;
  /** The sub-session the mentor appears in (null when listed on the event itself). */
  sessionTitle: string | null;
  start: string | null;
  end: string | null;
  role: "speaker" | "moderator" | "host";
  venue: string | null;
  /** The entry's Founders involvement and related-event flag, labeled as on the calendar. */
  involvement: Involvement | null;
  related: boolean;
}

/**
 * Calendar events a mentor speaks at or hosts (the official program and related events), from
 * verified speaker links (`mentorId`).
 */
export function mentorAppearances(entries: ScheduleEntry[], mentorId: string): MentorAppearance[] {
  const out: MentorAppearance[] = [];
  for (const entry of entries) {
    if (entry.kind !== "event" || entry.status === "canceled") continue;
    const venue =
      entry.location.kind === "in-person" || entry.location.kind === "hybrid" ? entry.location.venue : null;
    for (const s of entry.speakers) {
      if (s.mentorId !== mentorId) continue;
      out.push({
        entryId: entry.id,
        entryTitle: entry.title,
        date: entry.date,
        sessionTitle: null,
        start: entry.time.kind === "exact" ? entry.time.start : null,
        end: entry.time.kind === "exact" ? (entry.time.end ?? null) : null,
        role: s.role ?? "speaker",
        venue,
        involvement: entry.involvement,
        related: entry.related,
      });
    }
    for (const session of entry.sessions) {
      const p = session.people.find((person) => person.mentorId === mentorId);
      if (!p) continue;
      out.push({
        entryId: entry.id,
        entryTitle: entry.title,
        date: entry.date,
        sessionTitle: session.title,
        start: session.start,
        end: session.end,
        role: p.role ?? "speaker",
        venue,
        involvement: entry.involvement,
        related: entry.related,
      });
    }
  }
  return out;
}
