/**
 * Office-hours application vocabulary shared by the public form, the API, the student
 * status page and the organizer view. Database values are the keys.
 */

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
    "Your application was received. Founders will match applicants based on interests and availability, then email selected students to confirm.",
  under_review: "Founders is reviewing applications and mentor availability.",
  selected:
    "You’ve been selected for an appointment. Check your Illinois email and reply to confirm your time — it isn’t final until you do.",
  waitlisted: "Appointments are full for now. Founders will email you if a spot opens up.",
  confirmed: "Your appointment is confirmed. The details are below and in your email.",
  canceled: "This application is no longer active.",
  attended: "Thanks for meeting with a mentor during Founders Week.",
};

export const APPOINTMENT_STATUSES = ["proposed", "confirmed", "canceled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  proposed: "Proposed — awaiting confirmation",
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
  { value: "exploring", label: "Exploring", description: "Curious about startups — no specific idea yet." },
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
    "Appointments are limited. Founders will match applicants based on interests and availability, then email selected students to confirm.",
  noReservation: "Submitting an application does not reserve a time slot.",
} as const;
