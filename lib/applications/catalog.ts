/**
 * The mentor/availability options a student can choose in the application, derived from
 * content. Serializable, so the server can pass it to the client form, and the API
 * validates submissions against the exact same catalog.
 */
import type { Mentor } from "@/content/types";
import { schedulingStatus, type SchedulingStatus } from "@/lib/mentors";
import { mentorAffiliation } from "@/lib/schedule/entries";
import { describeTime, formatDate, formatTimeRange, TZ_LABEL } from "@/lib/time";

export type AvailabilityOptionKind = "window" | "slot";

export interface AvailabilityOption {
  /** Form/API value: "window:<id>" or "slot:<id>". */
  key: string;
  kind: AvailabilityOptionKind;
  id: string;
  mentorId: string;
  /**
   * - `window`: general availability — no appointment time set yet.
   * - `proposed`: a specific time proposed, not yet confirmed by the mentor.
   * - `confirmed`: a confirmed appointment slot.
   */
  certainty: "window" | "proposed" | "confirmed";
  date: string;
  /** e.g. "Thu, Oct 1 · 10:00–11:30 AM CT" */
  label: string;
  /** e.g. "Availability window. Exact appointment times aren’t set yet." */
  detail: string;
  /** False for a date-only window (time not set yet): students still need to say when they're free. */
  timeKnown: boolean;
}

export interface CatalogMentor {
  id: string;
  name: string;
  firstName: string;
  affiliation: string | null;
  demo: boolean;
  /**
   * `in-progress`: no times published yet — students express interest without choosing a time
   * (`options` is empty). `available`: students must pick at least one option.
   */
  scheduling: SchedulingStatus;
  options: AvailabilityOption[];
}

export interface ApplicationCatalog {
  mentors: CatalogMentor[];
}

export function optionKey(kind: AvailabilityOptionKind, id: string): string {
  return `${kind}:${id}`;
}

export function parseOptionKey(key: string): { kind: AvailabilityOptionKind; id: string } | null {
  const m = /^(window|slot):([a-z0-9-]+)$/.exec(key);
  return m ? { kind: m[1] as AvailabilityOptionKind, id: m[2] } : null;
}

/**
 * Mentors whose times aren't set: no options at all (scheduling in progress) or only date-only
 * windows (e.g. "Thu, Oct 1 · Exact time to be confirmed"). Applicants choosing them must describe
 * when they're free. Shared by the schema and the form so both apply the same rule.
 */
export function mentorNeedsBroadAvailability(mentor: Pick<CatalogMentor, "options">): boolean {
  return mentor.options.every((o) => !o.timeKnown);
}

/**
 * Windows that already have slots are represented by their slots; windows without slots
 * are offered as-is ("I'm available during this window").
 */
export function buildApplicationCatalog(mentors: Mentor[]): ApplicationCatalog {
  return {
    mentors: mentors
      .filter((m) => m.acceptingApplications)
      .map((m) => {
        const windowsWithSlots = new Set(m.slots.map((s) => s.windowId));
        const windowOptions: AvailabilityOption[] = m.availability
          .filter((w) => !windowsWithSlots.has(w.id))
          .map((w) => ({
            key: optionKey("window", w.id),
            kind: "window",
            id: w.id,
            mentorId: m.id,
            certainty: "window",
            date: w.date,
            label: w.label
              ? `${formatDate(w.date, "short")} · ${w.label}`
              : `${formatDate(w.date, "short")} · ${describeTime(w.time).label}`,
            detail:
              w.time.kind === "exact"
                ? "Availability window. Exact appointment times aren’t set yet."
                : "Availability window. Exact times to be announced.",
            timeKnown: w.time.kind !== "tba",
          }));
        const slotOptions: AvailabilityOption[] = m.slots.map((s) => {
          const extras = [s.format === "virtual" ? "Virtual" : s.format === "hybrid" ? "Hybrid" : null, s.location]
            .filter(Boolean)
            .join(" · ");
          return {
            key: optionKey("slot", s.id),
            kind: "slot",
            id: s.id,
            mentorId: m.id,
            certainty: s.status,
            date: s.date,
            label: `${formatDate(s.date, "short")} · ${formatTimeRange(s.start, s.end)} ${TZ_LABEL}`,
            detail:
              s.status === "confirmed"
                ? `Confirmed slot${extras ? ` · ${extras}` : ""}`
                : `Proposed time, not yet confirmed by ${m.firstName}${extras ? ` · ${extras}` : ""}`,
            timeKnown: true,
          };
        });
        return {
          id: m.id,
          name: m.name,
          firstName: m.firstName,
          affiliation: mentorAffiliation(m),
          demo: Boolean(m.demo),
          scheduling: schedulingStatus(m),
          options: [...slotOptions, ...windowOptions].sort((a, b) => a.date.localeCompare(b.date)),
        };
      }),
  };
}
