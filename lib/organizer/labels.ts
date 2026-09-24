/**
 * Organizer-view vocabulary: compact status labels, answer labels and activity-log sentences.
 * Pure — safe on server and client.
 */
import {
  APPLICATION_STATUS_LABELS,
  PARTICIPATION_OPTIONS,
  STAGE_OPTIONS,
  YEAR_OPTIONS,
  type ApplicationStatus,
} from "@/lib/applications/constants";

/** Short labels for the dashboard's status strip (full labels are on the badges). */
export const STATUS_SHORT_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "In review",
  selected: "Selected",
  waitlisted: "Waitlisted",
  confirmed: "Confirmed",
  canceled: "Canceled",
  attended: "Attended",
};

function optionLabel(options: readonly { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export const yearLabel = (v: string) => optionLabel(YEAR_OPTIONS, v);
export const stageLabel = (v: string) => optionLabel(STAGE_OPTIONS, v);
export const participationLabel = (v: string) => optionLabel(PARTICIPATION_OPTIONS, v);
export const stageDescription = (v: string) => STAGE_OPTIONS.find((o) => o.value === v)?.description ?? null;

function statusLabel(value: unknown): string {
  return typeof value === "string" && value in APPLICATION_STATUS_LABELS
    ? APPLICATION_STATUS_LABELS[value as ApplicationStatus]
    : String(value ?? "—");
}

export interface ActivityDescription {
  /** Sentence fragment after the actor, e.g. "changed status". */
  title: string;
  /** Secondary detail line, if any. */
  detail: string | null;
}

/**
 * Human sentence for an activity-log entry. `describeSlot` resolves slot ids to labels.
 * Unknown actions (e.g. written by other parts of the app) are humanized, never hidden.
 */
export function describeActivity(
  action: string,
  detail: Record<string, unknown>,
  describeSlot: (slotId: string, startsAt?: string, endsAt?: string) => string,
): ActivityDescription {
  const slot = () =>
    typeof detail.slotId === "string"
      ? describeSlot(
          detail.slotId,
          typeof detail.startsAt === "string" ? detail.startsAt : undefined,
          typeof detail.endsAt === "string" ? detail.endsAt : undefined,
        )
      : null;
  switch (action) {
    case "submitted":
    case "application_submitted":
      return { title: "Application submitted", detail: null };
    case "status_changed":
      return {
        title: "Status changed",
        detail: `${statusLabel(detail.from)} → ${statusLabel(detail.to)}${
          detail.reason === "no_confirmed_appointments" ? " · no confirmed appointments remain" : ""
        }`,
      };
    case "notes_updated":
      return { title: "Organizer notes updated", detail: null };
    case "appointment_proposed":
      return { title: "Appointment proposed", detail: slot() };
    case "appointment_confirmed":
      return { title: "Appointment confirmed", detail: slot() };
    case "appointment_canceled":
      return {
        title: "Appointment canceled",
        detail: [slot(), detail.reason === "application_canceled" ? "application canceled" : null]
          .filter(Boolean)
          .join(" · ") || null,
      };
    default: {
      const words = action.replace(/[_-]+/g, " ").trim();
      return { title: words ? words[0].toUpperCase() + words.slice(1) : "Activity", detail: null };
    }
  }
}
