/**
 * Content lookups for the organizer view: mentor, availability-window and slot ids stored with
 * applications resolve to names and labels here. Built from `getMentorsForOrganizers()` in
 * pages/route handlers, or from fixture mentors in tests, so service code never reads env.
 *
 * Pure and serializable-friendly (plain objects) — safe to import from client components.
 */
import type { AppointmentSlot, AvailabilityWindow, ISODate, LocalTime, Mentor, TimeSpec } from "@/content/types";
import { schedulingStatus, type SchedulingStatus } from "@/lib/mentors";
import { mentorAffiliation } from "@/lib/schedule/entries";
import { describeTime, formatDate, formatTimeRange, TZ_LABEL, utcToZoned } from "@/lib/time";

export interface MentorInfo {
  id: string;
  name: string;
  firstName: string;
  /** Verified role/company (null when unverified — never guessed). */
  role: string | null;
  company: string | null;
  affiliation: string | null;
  headshot: Mentor["headshot"];
  demo: boolean;
  scheduling: SchedulingStatus;
  acceptingApplications: boolean;
}

export interface SlotInfo {
  id: string;
  mentorId: string;
  mentorName: string;
  mentorFirstName: string;
  windowId: string;
  date: ISODate;
  start: LocalTime;
  end: LocalTime;
  capacity: number;
  status: AppointmentSlot["status"];
  format: AppointmentSlot["format"] | null;
  location: string | null;
  demo: boolean;
  /** "Thu, Oct 1 · 2:00–2:25 PM CT" */
  label: string;
}

export interface WindowInfo {
  id: string;
  mentorId: string;
  mentorName: string;
  date: ISODate;
  time: TimeSpec;
  /** `window` = exact window; `window-approx` = part of day / exact times forthcoming. */
  kind: "window" | "window-approx";
  demo: boolean;
  /** "Thu, Oct 1 · 10:00–11:30 AM CT" or "Fri, Oct 2 · Friday morning · Exact times TBA" */
  label: string;
}

export interface OrganizerDirectory {
  /** Content order (production mentors first, then demo). */
  mentors: MentorInfo[];
  mentorsById: ReadonlyMap<string, MentorInfo>;
  slots: SlotInfo[];
  slotsById: ReadonlyMap<string, SlotInfo>;
  windows: WindowInfo[];
  windowsById: ReadonlyMap<string, WindowInfo>;
}

export function slotLabel(slot: Pick<AppointmentSlot, "date" | "start" | "end">): string {
  return `${formatDate(slot.date, "short")} · ${formatTimeRange(slot.start, slot.end)} ${TZ_LABEL}`;
}

export function windowLabel(window: Pick<AvailabilityWindow, "date" | "time" | "label">): string {
  if (!window.label) return `${formatDate(window.date, "short")} · ${describeTime(window.time).label}`;
  // "Friday morning, before noon · …" already names the day: "Oct 2 · Friday morning…", not "Fri, Oct 2 · Friday…".
  const weekday = formatDate(window.date, "long").split(",")[0].toLowerCase();
  const date = window.label.toLowerCase().startsWith(weekday)
    ? formatDate(window.date, "month-day")
    : formatDate(window.date, "short");
  return `${date} · ${window.label}`;
}

/** Label for a stored appointment interval (UTC instants) in Central Time. */
export function intervalLabel(startsAt: Date | string, endsAt: Date | string): string {
  const s = utcToZoned(new Date(startsAt));
  const e = utcToZoned(new Date(endsAt));
  return `${formatDate(s.date, "short")} · ${formatTimeRange(s.time, e.time)} ${TZ_LABEL}`;
}

export function buildOrganizerDirectory(mentors: Mentor[]): OrganizerDirectory {
  const mentorInfos: MentorInfo[] = mentors.map((m) => ({
    id: m.id,
    name: m.name,
    firstName: m.firstName,
    role: m.role,
    company: m.company,
    affiliation: mentorAffiliation(m),
    headshot: m.headshot,
    demo: Boolean(m.demo),
    scheduling: schedulingStatus(m),
    acceptingApplications: m.acceptingApplications,
  }));
  const slots: SlotInfo[] = mentors.flatMap((m) =>
    m.slots.map((s) => ({
      id: s.id,
      mentorId: m.id,
      mentorName: m.name,
      mentorFirstName: m.firstName,
      windowId: s.windowId,
      date: s.date,
      start: s.start,
      end: s.end,
      capacity: s.capacity,
      status: s.status,
      format: s.format ?? null,
      location: s.location ?? null,
      demo: Boolean(m.demo),
      label: slotLabel(s),
    })),
  );
  const windows: WindowInfo[] = mentors.flatMap((m) =>
    m.availability.map((w) => ({
      id: w.id,
      mentorId: m.id,
      mentorName: m.name,
      date: w.date,
      time: w.time,
      kind: w.time.kind === "exact" ? ("window" as const) : ("window-approx" as const),
      demo: Boolean(m.demo),
      label: windowLabel(w),
    })),
  );
  return {
    mentors: mentorInfos,
    mentorsById: new Map(mentorInfos.map((m) => [m.id, m])),
    slots,
    slotsById: new Map(slots.map((s) => [s.id, s])),
    windows,
    windowsById: new Map(windows.map((w) => [w.id, w])),
  };
}

/** Mentor display name for an id stored in the database (content may have changed since). */
export function mentorName(directory: Pick<OrganizerDirectory, "mentorsById">, id: string): string {
  return directory.mentorsById.get(id)?.name ?? `${id} (no longer listed)`;
}

export type AvailabilityCertainty = "window" | "window-approx" | "proposed" | "confirmed";

export interface ResolvedAvailability {
  key: string;
  kind: "window" | "slot";
  optionId: string;
  mentorId: string;
  mentorName: string;
  label: string;
  /** null when the option no longer exists in content. */
  certainty: AvailabilityCertainty | null;
}

/** Resolve a stored availability selection to a label and certainty. */
export function resolveAvailability(
  directory: OrganizerDirectory,
  row: { kind: "window" | "slot"; optionId: string; mentorId: string },
): ResolvedAvailability {
  const base = {
    key: `${row.kind}:${row.optionId}`,
    kind: row.kind,
    optionId: row.optionId,
    mentorId: row.mentorId,
    mentorName: mentorName(directory, row.mentorId),
  };
  if (row.kind === "slot") {
    const slot = directory.slotsById.get(row.optionId);
    return slot
      ? { ...base, label: slot.label, certainty: slot.status }
      : { ...base, label: `Slot ${row.optionId} (no longer listed)`, certainty: null };
  }
  const window = directory.windowsById.get(row.optionId);
  return window
    ? { ...base, label: window.label, certainty: window.kind }
    : { ...base, label: `Window ${row.optionId} (no longer listed)`, certainty: null };
}

export interface MentorBookability {
  mentorId: string;
  mentorName: string;
  firstName: string;
  scheduling: SchedulingStatus | null;
  /** Appointment slots in content for this mentor. */
  slots: SlotInfo[];
  /** Availability windows (general availability — not bookable by themselves). */
  windows: WindowInfo[];
}

/**
 * For each mentor id (in the given order): the slots and windows content currently has.
 * A mentor with no slots can't receive appointments yet — so an application for them can be
 * reviewed, selected or waitlisted, but not confirmed.
 */
export function mentorBookability(directory: OrganizerDirectory, mentorIds: readonly string[]): MentorBookability[] {
  return mentorIds.map((id) => {
    const info = directory.mentorsById.get(id);
    return {
      mentorId: id,
      mentorName: info?.name ?? `${id} (no longer listed)`,
      firstName: info?.firstName ?? id,
      scheduling: info?.scheduling ?? null,
      slots: directory.slots.filter((s) => s.mentorId === id),
      windows: directory.windows.filter((w) => w.mentorId === id),
    };
  });
}

/** "Ron", "Vik and Ron", "Patrick, Vik and Ron". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
