/**
 * Content validation. Runs when content is loaded (dev, build, tests), so a bad edit to
 * /content fails loudly instead of rendering something wrong.
 */
import { z } from "zod";
import { isISODate, isLocalTime, minutesOfDay } from "@/lib/time";
import type { Mentor, ScheduleEvent } from "./types";

const isoDate = z.string().refine(isISODate, "Expected a real date as YYYY-MM-DD");
const localTime = z.string().refine(isLocalTime, "Expected 24-hour time as HH:mm");
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase-kebab-case ids");
const httpsUrl = z.url({ protocol: /^https?$/ });

const timeSpec = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("exact"), start: localTime, end: localTime.optional() }),
    z.object({
      kind: z.literal("part-of-day"),
      part: z.enum(["morning", "afternoon", "evening"]),
      before: localTime.optional(),
      after: localTime.optional(),
    }),
    z.object({ kind: z.literal("tba") }),
  ])
  .superRefine((t, ctx) => {
    if (t.kind === "exact" && t.end && minutesOfDay(t.end) <= minutesOfDay(t.start)) {
      ctx.addIssue({ code: "custom", message: "End time must be after start time (same day)" });
    }
    if (t.kind === "part-of-day" && t.before && t.after && minutesOfDay(t.before) <= minutesOfDay(t.after)) {
      ctx.addIssue({ code: "custom", message: "`before` must be after `after`" });
    }
  });

const source = z.object({
  label: z.string().min(1),
  url: httpsUrl.optional(),
  note: z.string().optional(),
  checked: isoDate.optional(),
});

const location = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("in-person"),
    venue: z.string().min(1),
    room: z.string().optional(),
    address: z.string().optional(),
    mapUrl: httpsUrl.optional(),
  }),
  z.object({ kind: z.literal("virtual"), platform: z.string().optional(), url: httpsUrl.optional() }),
  z.object({
    kind: z.literal("hybrid"),
    venue: z.string().min(1),
    room: z.string().optional(),
    address: z.string().optional(),
    url: httpsUrl.optional(),
  }),
  z.object({ kind: z.literal("tba"), note: z.string().optional() }),
]);

const speaker = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  verified: z.boolean(),
  role: z.enum(["moderator", "host"]).optional(),
  mentorId: slug.optional(),
  profileUrl: httpsUrl.optional(),
});

const programSession = z
  .object({
    start: localTime,
    end: localTime,
    title: z.string().min(1).max(200),
    people: z.array(speaker),
    peopleNote: z.string().optional(),
  })
  .refine((s) => minutesOfDay(s.end) > minutesOfDay(s.start), { message: "Session end must be after its start" });

const eventSchema = z.object({
  id: slug,
  title: z.string().min(1).max(140),
  date: isoDate,
  time: timeSpec,
  status: z.enum(["confirmed", "planned", "tentative", "canceled"]),
  statusNote: z.string().optional(),
  types: z
    .array(z.enum(["talk", "panel", "workshop", "networking", "office-hours", "pitch", "social", "other"]))
    .min(1),
  involvement: z.enum(["hosted", "cohosted", "supported", "week"]).nullable(),
  foundersPick: z.boolean(),
  organizer: z.string().min(1).nullable(),
  location,
  summary: z.string().min(1).max(280),
  description: z.string().min(1),
  speakers: z.array(speaker),
  topics: z.array(z.string().min(1)),
  registration: z.object({ url: httpsUrl, label: z.string().optional() }).nullable(),
  links: z.array(z.object({ label: z.string().min(1), url: httpsUrl })).optional(),
  sessions: z.array(programSession).optional(),
  featured: z.object({ rank: z.number().int().min(2).max(99) }).optional(),
  related: z.boolean().optional(),
  callout: z.object({ title: z.string().min(1), body: z.string().min(1) }).optional(),
  sources: z.array(source),
  demo: z.boolean().optional(),
});

const draftable = <T extends z.ZodType>(value: T) =>
  z.object({ status: z.enum(["draft", "approved"]), value, note: z.string().optional() }).nullable();

const sessionFormat = z.enum(["in-person", "virtual", "hybrid"]);

const mentorSchema = z.object({
  id: slug,
  name: z.string().min(1),
  firstName: z.string().min(1),
  role: z.string().min(1).nullable(),
  company: z.string().min(1).nullable(),
  headshot: z
    .object({
      src: z.string().startsWith("/"),
      alt: z.string().min(1),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .nullable(),
  bio: draftable(z.string().min(1)),
  expertise: draftable(z.array(z.object({ label: z.string().min(1), basis: z.string().min(1) }))),
  askMeAbout: draftable(z.array(z.string().min(1))),
  goodFitFor: draftable(z.array(z.string().min(1))),
  backgroundTags: z.array(z.string().min(1).max(40)).max(6).optional(),
  session: z.object({
    format: sessionFormat.nullable(),
    durationMinutes: z.number().int().positive().nullable(),
    location: z.string().min(1).nullable(),
    sessionCount: z.string().min(1).nullable(),
    confirmed: z.boolean(),
    note: z.string().optional(),
  }),
  availability: z.array(
    z.object({
      id: slug,
      date: isoDate,
      time: timeSpec,
      label: z.string().optional(),
      note: z.string().optional(),
    }),
  ),
  slots: z.array(
    z.object({
      id: slug,
      windowId: slug,
      date: isoDate,
      start: localTime,
      end: localTime,
      capacity: z.number().int().min(1).max(50),
      status: z.enum(["proposed", "confirmed"]),
      format: sessionFormat.optional(),
      location: z.string().optional(),
    }),
  ),
  links: z.array(z.object({ label: z.string().min(1), url: httpsUrl })),
  acceptingApplications: z.boolean(),
  organizerNotes: z.string().optional(),
  sources: z.array(source),
  demo: z.boolean().optional(),
});

export class ContentValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid content in /content:\n  - ${problems.join("\n  - ")}`);
    this.name = "ContentValidationError";
  }
}

function formatZodIssues(prefix: string, error: z.ZodError): string[] {
  return error.issues.map((i) => `${prefix}${i.path.length ? "." + i.path.join(".") : ""}: ${i.message}`);
}

/** Office-hours schedule entries are generated with this id prefix. */
export const OFFICE_HOURS_ID_PREFIX = "office-hours-";

export function validateContent(input: {
  events: ScheduleEvent[];
  mentors: Mentor[];
  /** When true, items flagged `demo` are rejected (production data must be real). */
  forbidDemo: boolean;
}): void {
  const problems: string[] = [];
  const seenEventIds = new Set<string>();
  const seenMentorIds = new Set<string>();
  const seenOptionIds = new Set<string>();
  const mentorIds = new Set(input.mentors.map((m) => m.id));
  const seenFeaturedRanks = new Map<number, string>();

  input.events.forEach((event, i) => {
    const label = `events[${i}] (${event?.id ?? "?"})`;
    const parsed = eventSchema.safeParse(event);
    if (!parsed.success) problems.push(...formatZodIssues(label, parsed.error));
    if (seenEventIds.has(event.id)) problems.push(`${label}: duplicate event id`);
    seenEventIds.add(event.id);
    if (event.id.startsWith(OFFICE_HOURS_ID_PREFIX)) {
      problems.push(`${label}: ids starting with "${OFFICE_HOURS_ID_PREFIX}" are reserved for generated office hours`);
    }
    if (input.forbidDemo && event.demo) problems.push(`${label}: demo content is not allowed in production data`);

    const people = [...(event.speakers ?? []), ...(event.sessions ?? []).flatMap((s) => s.people ?? [])];
    for (const p of people) {
      if (p.mentorId && !mentorIds.has(p.mentorId)) {
        problems.push(`${label}: speaker "${p.name}" links to unknown mentor "${p.mentorId}"`);
      }
    }

    if (event.featured) {
      const other = seenFeaturedRanks.get(event.featured.rank);
      if (other) problems.push(`${label}: featured rank ${event.featured.rank} is also used by "${other}"`);
      seenFeaturedRanks.set(event.featured.rank, event.id);
    }

    // Program sessions: chronological and inside the block's exact time.
    const sessions = event.sessions ?? [];
    if (sessions.length) {
      if (event.time?.kind !== "exact" || !event.time.end) {
        problems.push(`${label}: an event with sessions needs an exact start and end`);
      } else {
        const blockStart = minutesOfDay(event.time.start);
        const blockEnd = minutesOfDay(event.time.end);
        let previousStart = -1;
        for (const s of sessions) {
          if (!isLocalTime(s.start) || !isLocalTime(s.end)) continue;
          const start = minutesOfDay(s.start);
          const end = minutesOfDay(s.end);
          if (start < blockStart || end > blockEnd) {
            problems.push(`${label}: session "${s.title}" falls outside the event's ${event.time.start}–${event.time.end}`);
          }
          if (start < previousStart) problems.push(`${label}: sessions must be listed in chronological order`);
          previousStart = start;
        }
      }
    }
  });

  input.mentors.forEach((mentor, i) => {
    const label = `mentors[${i}] (${mentor?.id ?? "?"})`;
    const parsed = mentorSchema.safeParse(mentor);
    if (!parsed.success) {
      problems.push(...formatZodIssues(label, parsed.error));
      return;
    }
    if (seenMentorIds.has(mentor.id)) problems.push(`${label}: duplicate mentor id`);
    seenMentorIds.add(mentor.id);
    if (input.forbidDemo && mentor.demo) problems.push(`${label}: demo content is not allowed in production data`);
    // No windows/slots is valid: the mentor is shown as "Scheduling in progress".

    const windows = new Map(mentor.availability.map((w) => [w.id, w]));
    for (const w of mentor.availability) {
      if (seenOptionIds.has(w.id)) problems.push(`${label}: availability/slot id "${w.id}" is not unique`);
      seenOptionIds.add(w.id);
    }
    for (const slot of mentor.slots) {
      if (seenOptionIds.has(slot.id)) problems.push(`${label}: availability/slot id "${slot.id}" is not unique`);
      seenOptionIds.add(slot.id);
      if (minutesOfDay(slot.end) <= minutesOfDay(slot.start)) {
        problems.push(`${label}: slot "${slot.id}" ends before it starts`);
      }
      const window = windows.get(slot.windowId);
      if (!window) {
        problems.push(`${label}: slot "${slot.id}" references unknown window "${slot.windowId}"`);
        continue;
      }
      if (window.date !== slot.date) problems.push(`${label}: slot "${slot.id}" is not on its window's date`);
      if (window.time.kind === "exact" && window.time.end) {
        const inside =
          minutesOfDay(slot.start) >= minutesOfDay(window.time.start) &&
          minutesOfDay(slot.end) <= minutesOfDay(window.time.end);
        if (!inside) problems.push(`${label}: slot "${slot.id}" falls outside window "${window.id}"`);
      }
      if (window.time.kind === "part-of-day" && window.time.before) {
        if (minutesOfDay(slot.end) > minutesOfDay(window.time.before)) {
          problems.push(`${label}: slot "${slot.id}" ends after window "${window.id}" (${window.time.before})`);
        }
      }
    }
    // Slots within one mentor must not overlap each other.
    const sorted = [...mentor.slots].sort((a, b) =>
      a.date === b.date ? minutesOfDay(a.start) - minutesOfDay(b.start) : a.date.localeCompare(b.date),
    );
    for (let k = 1; k < sorted.length; k++) {
      const prev = sorted[k - 1];
      const cur = sorted[k];
      if (prev.date === cur.date && minutesOfDay(cur.start) < minutesOfDay(prev.end)) {
        problems.push(`${label}: slots "${prev.id}" and "${cur.id}" overlap`);
      }
    }
  });

  if (problems.length) throw new ContentValidationError(problems);
}
