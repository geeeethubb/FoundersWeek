/**
 * Office-hours application vocabulary shared by the public form, the API, the student
 * status page and the organizer view. Database values are the keys.
 */
import type { SessionRule } from "@/lib/schedule/sessions";

export const APPLICATION_STATUSES = [
  "submitted",
  "under_review",
  "selected",
  "waitlisted",
  "confirmed",
  "canceled",
  "attended",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  selected: "Selected, awaiting confirmation",
  waitlisted: "Waitlisted",
  confirmed: "Confirmed",
  canceled: "Canceled",
  attended: "Attended",
};

/** Student-facing explanation of each status (status page, emails). */
export const APPLICATION_STATUS_DESCRIPTIONS: Record<ApplicationStatus, string> = {
  submitted:
    "Your application is in. Founders will match applicants by interests and availability, then email selected students to confirm.",
  under_review: "Founders is reviewing applications and checking mentor availability.",
  selected:
    "You’ve been selected for an appointment. Check your Illinois email and reply to confirm your time. It isn’t final until you do.",
  waitlisted: "Appointments are full for now. Founders will email you if a spot opens up.",
  confirmed: "Your appointment is confirmed. The details are below and in your email.",
  canceled: "This application is no longer active.",
  attended: "Thanks for meeting with a mentor during Founders Week.",
};

export const APPOINTMENT_STATUSES = ["proposed", "confirmed", "canceled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  proposed: "Proposed, awaiting confirmation",
  confirmed: "Confirmed",
  canceled: "Canceled",
};

export const YEAR_OPTIONS = [
  { value: "freshman", label: "Freshman" },
  { value: "sophomore", label: "Sophomore" },
  { value: "junior", label: "Junior" },
  { value: "senior", label: "Senior" },
  { value: "fifth-plus", label: "Fifth year or beyond" },
  { value: "masters", label: "Master’s student" },
  { value: "phd", label: "PhD student" },
  { value: "other", label: "Other" },
] as const;
export type YearValue = (typeof YEAR_OPTIONS)[number]["value"];

export const STAGE_OPTIONS = [
  { value: "exploring", label: "Exploring", description: "Curious about startups, but no specific idea yet." },
  { value: "idea", label: "Have an idea", description: "An idea you want to pressure-test." },
  { value: "building", label: "Building", description: "Working on a prototype, MVP or early version." },
  { value: "launched", label: "Launched", description: "Live with users or customers." },
] as const;
export type StageValue = (typeof STAGE_OPTIONS)[number]["value"];

export const PARTICIPATION_OPTIONS = [
  { value: "individual", label: "Individually" },
  { value: "team", label: "With a team" },
] as const;
export type ParticipationValue = (typeof PARTICIPATION_OPTIONS)[number]["value"];

export const LIMITS = {
  fullName: 100,
  major: 100,
  teamName: 100,
  teammates: 400,
  longAnswerWords: 100,
  longAnswerChars: 1000,
  availabilityNotes: 400,
  link: 500,
  /** Submissions faster than this are treated as automated. */
  minFillMs: 3000,
} as const;

/** Copy used wherever the application is described. Keep consistent. */
export const APPLICATION_COPY = {
  limited:
    "Appointments are limited. Founders will match applicants by interests and availability, then email selected students to confirm.",
  noReservation: "Submitting an application doesn’t reserve a time slot.",
} as const;

/** The part of the session rule (`site.officeHours`) students need where they apply and hear back. */
export type SessionLength = Pick<SessionRule, "sessionMinutes">;

/**
 * The session rule as each application surface says it, built from `site.officeHours` (never a
 * hard-coded number). Students apply to windows; if they're matched, Founders emails them one
 * specific session inside it. Each surface says this once, and applying still reserves nothing.
 */
export const SESSION_COPY = {
  /**
   * Application form, under "Can you make these times?": "Sessions are 25 minutes. If you’re
   * matched, Founders will email you a specific session time inside the window you picked."
   * (without the last part when a listed time is already a specific slot).
   */
  formTimes: (rule: SessionLength, windowsOnly: boolean) =>
    `Sessions are ${rule.sessionMinutes} minutes. If you’re matched, Founders will email you a specific session time${
      windowsOnly ? " inside the window you picked" : ""
    }.`,
  /** Application form, end of the broad-availability hint when no times are listed: "Sessions are 25 minutes." */
  formLength: (rule: SessionLength) => `Sessions are ${rule.sessionMinutes} minutes.`,
  /** Confirmation screen: "… Founders will email you@illinois.edu with a specific time for a 25-minute session." */
  confirmation: (rule: SessionLength) => `with a specific time for a ${rule.sessionMinutes}-minute session`,
  /** Acknowledgment email, after APPLICATION_COPY.limited. */
  email: (rule: SessionLength) =>
    `Each session is ${rule.sessionMinutes} minutes, and if you’re matched, that email will include a specific session time.`,
  /** Status page, while there's no appointment yet. */
  status: (rule: SessionLength) =>
    `No appointment yet. If you’re matched, your ${rule.sessionMinutes}-minute session will show up here.`,
} as const;
