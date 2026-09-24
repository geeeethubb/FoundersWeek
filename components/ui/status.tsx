/**
 * The four scheduling concepts, always visually distinct (use these everywhere):
 *
 * 1. Availability window   — when a mentor is generally free. Not an appointment.   neutral · dashed
 *    (exact times forthcoming — a rough window like "Friday morning")               neutral · dotted
 *    (scheduling in progress — no availability published yet)                       muted   · dotted
 * 2. Proposed slot / appointment — a specific time not yet confirmed.                amber   · dashed
 * 3. Confirmed slot / appointment — time confirmed.                                  green   · solid
 * 4. Application status — where a student's application stands (ApplicationStatusBadge).
 */
import {
  APPLICATION_STATUS_LABELS,
  APPOINTMENT_STATUS_LABELS,
  type ApplicationStatus,
  type AppointmentStatus,
} from "@/lib/applications/constants";
import { Badge, type BadgeTone, type LineStyle } from "./badge";

export type AvailabilityKind = "window" | "window-approx" | "in-progress" | "proposed" | "confirmed";

export const AVAILABILITY_KIND_LABELS: Record<AvailabilityKind, string> = {
  window: "Availability window",
  "window-approx": "Exact times forthcoming",
  "in-progress": "Scheduling in progress",
  proposed: "Proposed slot",
  confirmed: "Confirmed slot",
};

export const AVAILABILITY_KIND_DESCRIPTIONS: Record<AvailabilityKind, string> = {
  window: "When the mentor is generally available. Not a booked appointment.",
  "window-approx": "The mentor is available in this part of the day; exact times will be shared once confirmed.",
  "in-progress": "Availability isn’t finalized yet. You can still express interest — Founders will follow up.",
  proposed: "A specific time proposed to the mentor, not yet confirmed.",
  confirmed: "A specific appointment time confirmed by the mentor.",
};

const availabilityStyles: Record<AvailabilityKind, { tone: BadgeTone; line: LineStyle }> = {
  window: { tone: "neutral", line: "dashed" },
  "window-approx": { tone: "neutral", line: "dotted" },
  "in-progress": { tone: "muted", line: "dotted" },
  proposed: { tone: "warning", line: "dashed" },
  confirmed: { tone: "success", line: "solid" },
};

export function AvailabilityBadge({ kind, className }: { kind: AvailabilityKind; className?: string }) {
  const s = availabilityStyles[kind];
  return (
    <Badge tone={s.tone} line={s.line} className={className} title={AVAILABILITY_KIND_DESCRIPTIONS[kind]}>
      {AVAILABILITY_KIND_LABELS[kind]}
    </Badge>
  );
}

/** Line style + color classes for custom availability blocks (e.g. a bordered time box). */
export const AVAILABILITY_BORDER_CLASSES: Record<AvailabilityKind, string> = {
  window: "border-dashed border-line-strong",
  "window-approx": "border-dotted border-line-strong",
  "in-progress": "border-dotted border-line",
  proposed: "border-dashed border-warning/45",
  confirmed: "border-solid border-success/45",
};

const applicationStyles: Record<ApplicationStatus, { tone: BadgeTone; line: LineStyle }> = {
  submitted: { tone: "neutral", line: "solid" },
  under_review: { tone: "info", line: "dashed" },
  selected: { tone: "accent", line: "dashed" },
  waitlisted: { tone: "warning", line: "dotted" },
  confirmed: { tone: "success", line: "solid" },
  canceled: { tone: "danger", line: "solid" },
  attended: { tone: "muted", line: "solid" },
};

export function ApplicationStatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  const s = applicationStyles[status];
  return (
    <Badge tone={s.tone} line={s.line} className={className}>
      {APPLICATION_STATUS_LABELS[status]}
    </Badge>
  );
}

const appointmentStyles: Record<AppointmentStatus, { tone: BadgeTone; line: LineStyle }> = {
  proposed: { tone: "warning", line: "dashed" },
  confirmed: { tone: "success", line: "solid" },
  canceled: { tone: "danger", line: "solid" },
};

export function AppointmentStatusBadge({ status, className }: { status: AppointmentStatus; className?: string }) {
  const s = appointmentStyles[status];
  return (
    <Badge tone={s.tone} line={s.line} className={className}>
      {APPOINTMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
