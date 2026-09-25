/**
 * View helpers for the Office Hours page (mentor cards), mentor profiles and the home-page
 * preview. Pure — safe on server and client. Everything here is derived only from the (already
 * public) mentor data it is given: nothing is inferred, embellished or defaulted to a guess.
 *
 * Inputs are expected to come from `getMentors()` (content/index.ts), which strips organizer notes
 * and draft copy unless draft preview is on. Draft fields that survive (preview only) are surfaced
 * with `draft: true` so the UI can label them.
 *
 * Expertise items carry an internal `basis` (where each item comes from) for organizers and
 * reviewers. Public UI shows the labels only — never the basis (see `helpLabels`).
 */
import { AVAILABILITY_KIND_LABELS, type AvailabilityKind } from "@/components/ui/status";
import type { AppointmentSlot, AvailabilityWindow, Draftable, Mentor, SessionFormat } from "@/content/types";
import { buildApplicationCatalog, type AvailabilityOption } from "@/lib/applications/catalog";
import {
  EXACT_TIME_TO_BE_CONFIRMED,
  INTEREST_COPY,
  mentorApplyHref,
  mentorCtaLabel,
  SCHEDULING_IN_PROGRESS_LABEL,
  schedulingStatus,
  type SchedulingStatus,
} from "@/lib/mentors";
import {
  applyHref,
  mentorAffiliation,
  mentorAppearances,
  type MentorAppearance,
  type ScheduleEntry,
} from "@/lib/schedule/entries";
import { sessionRuleText, type SessionRule } from "@/lib/schedule/sessions";
import {
  describeTime,
  formatDate,
  formatTime,
  formatTimeRange,
  minutesOfDay,
  timeSortMinutes,
  TZ_LABEL,
} from "@/lib/time";

// ---------------------------------------------------------------------------
// Draftable fields
// ---------------------------------------------------------------------------

export interface VisibleField<T> {
  value: T;
  /** True only in draft preview (never on the public site — the loader strips drafts). */
  draft: boolean;
  /** Organizer context for a draft (shown next to the Draft badge in preview only). */
  draftNote: string | null;
}

/** A draftable field as it should render, or `null` when there is nothing to show. */
export function visibleField<T>(field: Draftable<T> | null | undefined): VisibleField<T> | null {
  if (!field) return null;
  if (Array.isArray(field.value) && field.value.length === 0) return null;
  const draft = field.status !== "approved";
  return { value: field.value, draft, draftNote: draft ? (field.note ?? null) : null };
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** "CEO & Co-Founder, Samara Aerospace" · "Stakehouse" · null (verified fields only). */
export { mentorAffiliation };

/** A factual one-liner built only from verified fields: "Patrick Haddox · CEO & Co-Founder, Samara Aerospace". */
export function factualOneLiner(mentor: Pick<Mentor, "name" | "role" | "company">): string {
  const affiliation = mentorAffiliation(mentor);
  return affiliation ? `${mentor.name} · ${affiliation}` : mentor.name;
}

/** Public profile page for a mentor. */
export function mentorProfileHref(id: string): string {
  return `/office-hours/${encodeURIComponent(id)}`;
}

/** In-page anchor of a mentor's card on /office-hours (`/office-hours#mentor-<id>`). */
export function mentorSectionId(id: string): string {
  return `mentor-${id}`;
}

/**
 * Index caption: (0, 4) → "01 / 04". Kept for the OG images; the Office Hours page and mentor
 * profiles don't show decorative numbering.
 */
export function mentorIndexCaption(index: number, total: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(index + 1)} / ${pad(total)}`;
}

/** Trim text to `max` characters at a word boundary, adding an ellipsis when shortened. */
export function excerpt(text: string, max = 180): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : clean.slice(0, max)).replace(/[\s,;:.\u2013\u2014-]+$/u, "");
  return `${base}…`;
}

// ---------------------------------------------------------------------------
// Expertise (grounded in verified information, each item with its internal basis)
// ---------------------------------------------------------------------------

export interface ExpertiseItem {
  label: string;
  /** Where the item comes from, e.g. "Founders Showcase panelist". Internal — never rendered publicly. */
  basis: string;
}

/** Expertise as it should render (approved; drafts only in draft preview), or null. */
export function visibleExpertise(mentor: Pick<Mentor, "expertise">): VisibleField<ExpertiseItem[]> | null {
  return visibleField(mentor.expertise);
}

/** Expertise labels only, for one-line summaries ("Revenue optimization · Financial forecasting"). */
export function expertiseSummary(mentor: Pick<Mentor, "expertise">): string | null {
  const field = visibleExpertise(mentor);
  if (!field || field.draft) return null;
  return field.value.map((e) => e.label).join(" · ");
}

/**
 * "Can help with" labels for public display — approved items only, labels only (the internal
 * basis is never included), at most `max` of them (all when omitted).
 */
export function helpLabels(mentor: Pick<Mentor, "expertise">, max?: number): string[] {
  const field = visibleExpertise(mentor);
  if (!field || field.draft) return [];
  const labels = field.value.map((e) => e.label);
  return max === undefined ? labels : labels.slice(0, max);
}

/**
 * The first sentence of an approved bio ("St. Louis" is not a sentence break), or null when the
 * bio is missing or still a draft.
 */
export function bioFirstSentence(mentor: Pick<Mentor, "bio">): string | null {
  const bio = visibleField(mentor.bio);
  if (!bio || bio.draft) return null;
  const clean = bio.value.replace(/\s+/g, " ").trim();
  // A sentence ends before a capital letter or an opening quote (\u201C curly, \x22 straight).
  const match = /^.*?(?<!\bSt)[.!?](?=\s+[A-Z\u201C\x22]|$)/u.exec(clean);
  return (match?.[0] ?? clean) || null;
}

// ---------------------------------------------------------------------------
// Founders Week appearances (sessions a mentor speaks at)
// ---------------------------------------------------------------------------

export interface AppearanceView {
  key: string;
  /** Event page on the calendar. */
  href: string;
  /** The session title when the mentor appears in a sub-session, else the event title. */
  title: string;
  /** The program block around the session ("Founders Showcase Day Sessions"), or null. */
  context: string | null;
  date: string;
  /** "Fri, Oct 2" */
  dateShort: string;
  /** "1:55–2:25 PM CT" · null when the time isn't exact. */
  timeLabel: string | null;
  /** "1:55 PM" · null when the time isn't exact. */
  startLabel: string | null;
  /** Local "2026-10-02T13:55" (or the date) for <time dateTime>. */
  dateTime: string;
  /** "Speaking" · "Moderating" · "Hosting" */
  roleLabel: string;
  venue: string | null;
}

export function appearanceView(a: MentorAppearance): AppearanceView {
  return {
    key: `${a.entryId}:${a.sessionTitle ?? ""}:${a.start ?? ""}`,
    href: `/schedule/${encodeURIComponent(a.entryId)}`,
    title: a.sessionTitle ?? a.entryTitle,
    context: a.sessionTitle ? a.entryTitle : null,
    date: a.date,
    dateShort: formatDate(a.date, "short"),
    timeLabel: a.start ? `${formatTimeRange(a.start, a.end ?? undefined)} ${TZ_LABEL}` : null,
    startLabel: a.start ? formatTime(a.start) : null,
    dateTime: a.start ? `${a.date}T${a.start}` : a.date,
    roleLabel: a.role === "moderator" ? "Moderating" : a.role === "host" ? "Hosting" : "Speaking",
    venue: a.venue,
  };
}

/** Chronological appearance views for one mentor. */
export function mentorAppearanceViews(entries: ScheduleEntry[], mentorId: string): AppearanceView[] {
  return mentorAppearances(entries, mentorId)
    .slice()
    .sort((a, b) =>
      a.date === b.date
        ? minutesOfDay(a.start ?? "23:59") - minutesOfDay(b.start ?? "23:59")
        : a.date.localeCompare(b.date),
    )
    .map(appearanceView);
}

/**
 * Appearances for several mentors, keyed by mentor id — the shape `MentorPreviewList` and
 * `MentorLineup` take: `appearancesByMentor(getScheduleEntries(), mentors)`.
 */
export function appearancesByMentor(
  entries: ScheduleEntry[],
  mentors: Pick<Mentor, "id">[],
): Record<string, AppearanceView[]> {
  return Object.fromEntries(mentors.map((m) => [m.id, mentorAppearanceViews(entries, m.id)]));
}

/**
 * "Speaking Fri, Oct 2 · 1:20–1:55 PM CT" · "Hosting Wed, Sep 30 · 5:00–7:00 PM CT" — the line above
 * each appearance on a profile: role, date, and the time range labeled CT (just the date when the
 * time isn't exact).
 */
export function appearanceLabel(a: AppearanceView): string {
  return `${a.roleLabel} ${a.dateShort}${a.timeLabel ? ` · ${a.timeLabel}` : ""}`;
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

export const SESSION_FORMAT_LABELS: Record<SessionFormat, string> = {
  "in-person": "In person",
  virtual: "Virtual",
  hybrid: "Hybrid",
};

/** Exact windows are "Availability window"; rough ones ("Friday morning") are "Exact times TBA". */
export function windowKind(
  window: Pick<AvailabilityWindow, "time">,
): Extract<AvailabilityKind, "window" | "window-approx"> {
  return window.time.kind === "exact" ? "window" : "window-approx";
}

/** "1 student or team" · "Up to 3 students or teams" */
export function capacityLabel(capacity: number): string {
  return capacity === 1 ? "1 student or team" : `Up to ${capacity} students or teams`;
}

export interface SlotView {
  id: string;
  kind: Extract<AvailabilityKind, "proposed" | "confirmed">;
  date: string;
  /** e.g. "2:00–2:25 PM CT" */
  timeLabel: string;
  /** `start` as HH:mm, for <time dateTime>. */
  start: string;
  capacity: number;
  capacityLabel: string;
  /** e.g. "In person · Demo Hall, Room 202"; null when neither is set. */
  where: string | null;
}

export interface WindowView {
  id: string;
  kind: Extract<AvailabilityKind, "window" | "window-approx">;
  date: string;
  /** "Thu, Oct 1" */
  dateShort: string;
  /** "Thursday, October 1" */
  dateLong: string;
  /** Precise time from the data: "10:00–11:30 AM CT" · "Morning, before noon CT" · "Exact time to be confirmed". */
  timeLabel: string;
  /** Content's display override, e.g. "Friday morning, before noon · Exact window pending". */
  label: string | null;
  note: string | null;
  /** Specific appointment times inside this window, earliest first. */
  slots: SlotView[];
}

export interface AvailabilityView {
  status: SchedulingStatus;
  windows: WindowView[];
  /** Total specific slots across windows. */
  slotCount: number;
}

function slotView(slot: AppointmentSlot): SlotView {
  const where = [slot.format ? SESSION_FORMAT_LABELS[slot.format] : null, slot.location ?? null]
    .filter(Boolean)
    .join(" · ");
  return {
    id: slot.id,
    kind: slot.status,
    date: slot.date,
    timeLabel: `${formatTimeRange(slot.start, slot.end)} ${TZ_LABEL}`,
    start: slot.start,
    capacity: slot.capacity,
    capacityLabel: capacityLabel(slot.capacity),
    where: where || null,
  };
}

/** Windows (chronological) with their slots nested inside them. */
export function availabilityView(mentor: Pick<Mentor, "availability" | "slots">): AvailabilityView {
  const windows = [...mentor.availability]
    .sort((a, b) =>
      a.date === b.date ? timeSortMinutes(a.time) - timeSortMinutes(b.time) : a.date.localeCompare(b.date),
    )
    .map<WindowView>((w) => ({
      id: w.id,
      kind: windowKind(w),
      date: w.date,
      dateShort: formatDate(w.date, "short"),
      dateLong: formatDate(w.date, "long"),
      // A date-only window reads the same everywhere students see it (profile, metadata, CTAs).
      timeLabel: w.time.kind === "tba" ? EXACT_TIME_TO_BE_CONFIRMED : describeTime(w.time).label,
      label: w.label ?? null,
      note: w.note ?? null,
      slots: mentor.slots
        .filter((s) => s.windowId === w.id)
        .sort((a, b) => minutesOfDay(a.start) - minutesOfDay(b.start))
        .map(slotView),
    }));
  return {
    status: schedulingStatus(mentor),
    windows,
    slotCount: windows.reduce((n, w) => n + w.slots.length, 0),
  };
}

/**
 * The strongest certainty a mentor's published availability reaches — used for one-badge
 * summaries: confirmed slot > proposed slot > exact window > rough window > in progress.
 */
export function strongestAvailabilityKind(view: AvailabilityView): AvailabilityKind {
  if (view.status === "in-progress") return "in-progress";
  const slots = view.windows.flatMap((w) => w.slots);
  if (slots.some((s) => s.kind === "confirmed")) return "confirmed";
  if (slots.some((s) => s.kind === "proposed")) return "proposed";
  if (view.windows.some((w) => w.kind === "window")) return "window";
  return "window-approx";
}

export interface AvailabilityItem {
  key: string;
  kind: Exclude<AvailabilityKind, "in-progress">;
  date: string;
  /** "Thu, Oct 1" */
  dateShort: string;
  /** "10:00–11:30 AM CT" · "Morning, before noon CT" · "2:00–2:25 PM CT" */
  timeLabel: string;
  /** Value for <time dateTime>: "2026-10-01" or local "2026-10-01T14:00". */
  dateTime: string;
  /** Seats in a specific slot; null for windows. */
  capacity: number | null;
}

/**
 * Flat, chronological list of what a student can pick — the same shape the application uses:
 * a window that has specific slots is represented by its slots; a window without slots stands alone.
 */
export function availabilityItems(view: AvailabilityView): AvailabilityItem[] {
  return view.windows.flatMap<AvailabilityItem>((w) =>
    w.slots.length
      ? w.slots.map((s) => ({
          key: `slot:${s.id}`,
          kind: s.kind,
          date: s.date,
          dateShort: formatDate(s.date, "short"),
          timeLabel: s.timeLabel,
          dateTime: `${s.date}T${s.start}`,
          capacity: s.capacity,
        }))
      : [
          {
            key: `window:${w.id}`,
            kind: w.kind,
            date: w.date,
            dateShort: w.dateShort,
            timeLabel: w.timeLabel,
            dateTime: w.date,
            capacity: null,
          },
        ],
  );
}

/** Plain-text one-liner for metadata and compact summaries, e.g. "Thu, Oct 1 · 10:00–11:30 AM CT". */
export function availabilityOneLiner(view: AvailabilityView): string {
  if (view.status === "in-progress") return "Scheduling in progress";
  return view.windows.map((w) => `${w.dateShort} · ${w.timeLabel}`).join("; ");
}

export const TIMES_TO_BE_ANNOUNCED = "Times to be announced";

export interface AvailabilityHeadline {
  kind: AvailabilityKind;
  /** "Availability window" · "Exact times TBA" · "Scheduling in progress" · … */
  label: string;
  /** "Thu, Oct 1" · null while scheduling is in progress. */
  date: string | null;
  /** Value for <time dateTime>, or null. */
  dateTime: string | null;
  /** "10:00–11:30 AM CT" · "Morning, before noon CT" · "Times to be announced". */
  time: string;
  /** How many further windows/slots exist beyond the first. */
  more: number;
}

/**
 * The first (chronological) thing a student could pick, for compact cards: its certainty label,
 * date and time — or "Scheduling in progress" / "Times to be announced". Never implies a booking.
 */
export function availabilityHeadline(mentor: Pick<Mentor, "availability" | "slots">): AvailabilityHeadline {
  const view = availabilityView(mentor);
  const items = availabilityItems(view);
  const first = items[0];
  if (view.status === "in-progress" || !first) {
    return {
      kind: "in-progress",
      label: AVAILABILITY_KIND_LABELS["in-progress"],
      date: null,
      dateTime: null,
      time: TIMES_TO_BE_ANNOUNCED,
      more: 0,
    };
  }
  return {
    kind: first.kind,
    label: AVAILABILITY_KIND_LABELS[first.kind],
    date: first.dateShort,
    dateTime: first.dateTime,
    time: first.timeLabel,
    more: items.length - 1,
  };
}

// ---------------------------------------------------------------------------
// Session details
// ---------------------------------------------------------------------------

export const TO_BE_CONFIRMED = "To be confirmed";

/** "25 minutes" · "1 hour" · "90 minutes" */
export function durationLabel(minutes: number): string {
  if (minutes === 60) return "1 hour";
  return `${minutes} minutes`;
}

/**
 * Short format/length line. Shows whatever is known and says plainly what isn't:
 * "In person · 25 min" · "Virtual · Length to be confirmed" · "Format and length to be confirmed".
 */
export function sessionSummary(session: Mentor["session"]): string {
  const format = session.format ? SESSION_FORMAT_LABELS[session.format] : null;
  const length = session.durationMinutes ? `${session.durationMinutes} min` : null;
  if (format && length) return `${format} · ${length}`;
  if (format) return `${format} · Length to be confirmed`;
  if (length) return `${length} · Format to be confirmed`;
  return "Format and length to be confirmed";
}

export interface SessionDetail {
  label: string;
  value: string;
  known: boolean;
}

/** Definition-list rows for "Session details". Unknown values read "To be confirmed". */
export function sessionDetails(session: Mentor["session"]): SessionDetail[] {
  const row = (label: string, value: string | null): SessionDetail => ({
    label,
    value: value ?? TO_BE_CONFIRMED,
    known: value !== null,
  });
  return [
    row("Format", session.format ? SESSION_FORMAT_LABELS[session.format] : null),
    row("Length", session.durationMinutes ? durationLabel(session.durationMinutes) : null),
    row("Location", session.location ? [session.location, session.address].filter(Boolean).join(", ") : null),
    row("Sessions", session.sessionCount),
  ];
}

// ---------------------------------------------------------------------------
// Calls to action
// ---------------------------------------------------------------------------

/** The options this mentor offers in the application form (same catalog the form and API use). */
export function applicationOptions(mentor: Mentor): AvailabilityOption[] {
  return buildApplicationCatalog([mentor]).mentors[0]?.options ?? [];
}

/** When a mentor offers exactly one window/slot, the application can preselect it. */
export function preselectedOption(mentor: Mentor): Pick<AvailabilityOption, "kind" | "id" | "label"> | null {
  const options = applicationOptions(mentor);
  return options.length === 1 ? { kind: options[0].kind, id: options[0].id, label: options[0].label } : null;
}

/**
 * Short display label for a preselected option, in the same words the availability blocks use:
 * "Thu, Oct 1 · 10:00–11:30 AM CT" · "Fri, Oct 2 · Morning, before noon CT".
 */
function preselectDisplayLabel(mentor: Mentor, option: Pick<AvailabilityOption, "kind" | "id" | "label">): string {
  const item = availabilityItems(availabilityView(mentor)).find((i) => i.key === `${option.kind}:${option.id}`);
  return item ? `${item.dateShort} · ${item.timeLabel}` : option.label;
}

export type MentorCta =
  | {
      kind: "apply" | "interest";
      label: string;
      /** /office-hours?mentor=<id>[&window|slot=<id>]#apply */
      href: string;
      /** The availability option the link preselects (e.g. "Thu, Oct 1 · 10:00–11:30 AM CT"), or null. */
      preselects: string | null;
    }
  | { kind: "closed"; label: string; href: null; reason: string };

/**
 * The CTA for a mentor: "Apply to meet <first name>" (with the single window/slot preselected when
 * there is exactly one) or "Express interest" while scheduling is in progress. Both land on the
 * application section of the Office Hours page (#apply) with the mentor preselected.
 */
export function mentorCta(
  mentor: Mentor,
  options: { applicationsOpen: boolean } = { applicationsOpen: true },
): MentorCta {
  if (!options.applicationsOpen) {
    return {
      kind: "closed",
      label: "Applications closed",
      href: null,
      reason: "We aren’t taking office-hours applications right now.",
    };
  }
  if (!mentor.acceptingApplications) {
    return {
      kind: "closed",
      label: "Not accepting applications",
      href: null,
      reason: `${mentor.firstName} isn’t taking office-hours applications right now.`,
    };
  }
  const label = mentorCtaLabel(mentor);
  if (schedulingStatus(mentor) === "in-progress") {
    return { kind: "interest", label, href: mentorApplyHref(mentor.id), preselects: null };
  }
  const pre = preselectedOption(mentor);
  if (pre) {
    return {
      kind: "apply",
      label,
      href: applyHref({ mentorId: mentor.id, optionKind: pre.kind, optionId: pre.id }),
      preselects: preselectDisplayLabel(mentor, pre),
    };
  }
  return { kind: "apply", label, href: mentorApplyHref(mentor.id), preselects: null };
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/** Meta description for a mentor profile, from verified fields only. */
export function mentorMetaDescription(mentor: Mentor): string {
  const affiliation = mentorAffiliation(mentor);
  const who = affiliation ? `${mentor.name} (${affiliation})` : mentor.name;
  const view = availabilityView(mentor);
  const when =
    view.status === "in-progress"
      ? `Scheduling is in progress, but you can apply now. ${INTEREST_COPY.followUp}`
      : `Availability: ${availabilityOneLiner(view)}. Apply to request a time.`;
  return `Founders Office Hours with ${who} during Founders Week at UIUC. ${when}`;
}

// ---------------------------------------------------------------------------
// Office Hours cards and profiles
// ---------------------------------------------------------------------------

/** One line of availability, e.g. "Thu, Oct 1 · 10:00–11:30 AM CT". Never implies a booking. */
export interface AvailabilityLine {
  /** True while scheduling is in progress (no windows or slots published yet). */
  pending: boolean;
  /** "Thu, Oct 1" · null while scheduling is in progress. */
  date: string | null;
  /** Value for <time dateTime>: "2026-10-01" or local "2026-10-01T14:00"; null when pending. */
  dateTime: string | null;
  /** "10:00–11:30 AM CT" · "Morning, exact window pending" · "Scheduling in progress". */
  detail: string;
  /** The whole line as plain text: "Fri, Oct 2 · Morning, exact window pending". */
  text: string;
}

const PENDING_LINE: AvailabilityLine = {
  pending: true,
  date: null,
  dateTime: null,
  detail: SCHEDULING_IN_PROGRESS_LABEL,
  text: SCHEDULING_IN_PROGRESS_LABEL,
};

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Every published window/slot as a line, chronologically (a window with specific slots is
 * represented by its slots, like the application). Exact windows read "10:00–11:30 AM CT"; rough
 * ones say plainly that the exact window is pending. Empty while scheduling is in progress.
 */
export function availabilityLines(mentor: Pick<Mentor, "availability" | "slots">): AvailabilityLine[] {
  const view = availabilityView(mentor);
  if (view.status === "in-progress") return [];
  const windows = new Map(mentor.availability.map((w) => [w.id, w]));
  return availabilityItems(view).map((item) => {
    let detail = item.timeLabel;
    if (item.key.startsWith("window:")) {
      const time = windows.get(item.key.slice("window:".length))?.time;
      if (time?.kind === "part-of-day") detail = `${capitalize(time.part)}, exact window pending`;
      else if (time?.kind === "tba") detail = EXACT_TIME_TO_BE_CONFIRMED;
    }
    return { pending: false, date: item.dateShort, dateTime: item.dateTime, detail, text: `${item.dateShort} · ${detail}` };
  });
}

/**
 * The one availability line a mentor card shows: the first published window/slot (plus "+N more"
 * when there are several) or "Scheduling in progress".
 */
export function availabilityLine(mentor: Pick<Mentor, "availability" | "slots">): AvailabilityLine & { more: number } {
  const lines = availabilityLines(mentor);
  const first = lines[0];
  if (!first) return { ...PENDING_LINE, more: 0 };
  const more = lines.length - 1;
  return { ...first, more, text: more > 0 ? `${first.text} · +${more} more` : first.text };
}

/**
 * The short, public note under a mentor's office-hours line on their profile: the window's own
 * note from content (e.g. "Patrick is free during this window, but it isn’t a booked appointment. …"), or the follow-up
 * promise while scheduling is in progress. Organizer notes are never used.
 */
export function availabilityNote(mentor: Pick<Mentor, "availability" | "slots">): string | null {
  if (schedulingStatus(mentor) === "in-progress") return INTEREST_COPY.followUp;
  const view = availabilityView(mentor);
  const notes = view.windows.map((w) => w.note).filter((n): n is string => Boolean(n));
  return notes.length === 1 ? notes[0] : null;
}

/**
 * The one line under a profile's office-hours lines that states the session rule ("Each session is
 * 25 minutes, with a 5-minute break between sessions." from `site.officeHours`). Shown when the
 * mentor has an exact window (or specific slots), so sessions follow the grid, or while scheduling
 * is in progress; `null` for rough windows only (part of day, time to be confirmed). Never a
 * session count: how many sessions a mentor holds is theirs to say (content `session.sessionCount`).
 */
export function sessionRuleLine(mentor: Pick<Mentor, "availability" | "slots">, rule: SessionRule): string | null {
  const exact = mentor.slots.length > 0 || mentor.availability.some((w) => w.time.kind === "exact");
  return exact || schedulingStatus(mentor) === "in-progress" ? sessionRuleText(rule) : null;
}

export interface OfficeHoursPlace {
  /** e.g. "Business Instructional Facility (BIF)" */
  venue: string;
  /** e.g. "515 E. Gregory Drive, Champaign, IL 61820", or null when only the building is known. */
  address: string | null;
}

/**
 * Where a mentor's office hours happen, once the organizers have set the place
 * (`session.location`, plus `session.address` when known). `null` while the location is pending.
 */
export function officeHoursPlace(mentor: Pick<Mentor, "session">): OfficeHoursPlace | null {
  const { location, address } = mentor.session;
  return location ? { venue: location, address: address ?? null } : null;
}

/** Visible label of a mentor card's action (the accessible name adds the mentor's name). */
export const SELECT_MENTOR_LABEL = "Select mentor";

/** "Apply to meet Patrick" — the profile's action, whatever the mentor's scheduling status. */
export function applyToMeetLabel(mentor: Pick<Mentor, "firstName">): string {
  return `Apply to meet ${mentor.firstName}`;
}

export type MentorAction =
  | {
      open: true;
      /** /office-hours?mentor=<id>[&window|slot=<id>]#apply — the single window/slot preselected. */
      href: string;
    }
  | { open: false; label: string; reason: string };

/** Where a mentor's "Select mentor" / "Apply to meet …" action goes, or why it's unavailable. */
export function mentorAction(mentor: Mentor, options: { applicationsOpen: boolean }): MentorAction {
  const cta = mentorCta(mentor, options);
  return cta.kind === "closed" ? { open: false, label: cta.label, reason: cta.reason } : { open: true, href: cta.href };
}

export interface MentorCardView {
  id: string;
  /** In-page anchor of the card (`mentor-<id>`). */
  anchor: string;
  name: string;
  role: string | null;
  company: string | null;
  headshot: Mentor["headshot"];
  /** Up to three approved "Can help with" labels (never the basis). */
  help: string[];
  /** First sentence of the approved bio — only when there are no approved help labels. */
  intro: string | null;
  availability: AvailabilityLine & { more: number };
  action: MentorAction;
  profileHref: string;
  demo: boolean;
}

/** Everything a mentor card on /office-hours shows — and nothing more. */
export function mentorCardView(mentor: Mentor, options: { applicationsOpen: boolean }): MentorCardView {
  const help = helpLabels(mentor, 3);
  return {
    id: mentor.id,
    anchor: mentorSectionId(mentor.id),
    name: mentor.name,
    role: mentor.role,
    company: mentor.company,
    headshot: mentor.headshot,
    help,
    intro: help.length ? null : bioFirstSentence(mentor),
    availability: availabilityLine(mentor),
    action: mentorAction(mentor, options),
    profileHref: mentorProfileHref(mentor.id),
    demo: Boolean(mentor.demo),
  };
}
