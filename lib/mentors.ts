/**
 * Mentor presentation rules shared by the directory, profiles, home preview, application form
 * and organizer view. Pure — safe on server and client.
 */
import type { Mentor } from "@/content/types";

/**
 * - `in-progress`: no availability windows or slots published yet ("Scheduling in progress").
 *   Students can express interest without choosing a time.
 * - `available`: at least one availability window or appointment slot is published.
 */
export type SchedulingStatus = "in-progress" | "available";

export function schedulingStatus(mentor: Pick<Mentor, "availability" | "slots">): SchedulingStatus {
  return mentor.availability.length === 0 && mentor.slots.length === 0 ? "in-progress" : "available";
}

export const SCHEDULING_IN_PROGRESS_LABEL = "Scheduling in progress";

export const INTEREST_COPY = {
  followUp: "Founders will follow up once availability is finalized.",
  noReservation: "Expressing interest does not reserve an appointment.",
} as const;

/** Call-to-action label for a mentor. */
export function mentorCtaLabel(mentor: Pick<Mentor, "firstName" | "availability" | "slots">): string {
  return schedulingStatus(mentor) === "in-progress" ? "Express interest" : `Apply to meet ${mentor.firstName}`;
}

/** Primary sitewide call to action. */
export const PRIMARY_CTA_LABEL = "Apply for Office Hours";

/**
 * Link to the application section of the Office Hours page with this mentor preselected
 * (the application lives at /office-hours#apply).
 */
export function mentorApplyHref(mentorId: string): string {
  return `/office-hours?mentor=${encodeURIComponent(mentorId)}#apply`;
}
