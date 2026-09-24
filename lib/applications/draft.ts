/**
 * In-progress application drafts, kept in the browser's sessionStorage so a student can visit a
 * mentor's profile (or reload) and come back to their answers. Pure helpers only — the form does
 * the actual storage access (wrapped in try/catch; storage can be unavailable).
 *
 * - Everything the student typed or chose is kept EXCEPT the honeypot.
 * - The idempotency key and the time the form was first opened travel with the draft, so a retry
 *   after navigating away still counts as the same submission (one stored application), and the
 *   anti-spam fill-time check measures the real time spent on the form.
 * - Restored drafts are re-validated against the current catalog: unknown mentors or options are
 *   dropped, unknown select values are cleared, over-long text is trimmed.
 * - Drafts expire after DRAFT_TTL_MS and are cleared after a successful submission.
 */
import type { ApplicationCatalog } from "./catalog";
import { LIMITS, PARTICIPATION_OPTIONS, STAGE_OPTIONS, YEAR_OPTIONS } from "./constants";
import type { ApplicationFormValues } from "./schema";

/** Answers that are saved in a draft (no honeypot, no per-submission metadata). */
export type DraftValues = Omit<ApplicationFormValues, "idempotencyKey" | "elapsedMs" | "nickname">;

export interface ApplicationDraft {
  /** Idempotency key of this form session, or null when the stored one was unusable. */
  key: string | null;
  /** When the form was first opened (ms since epoch). */
  startedAt: number;
  values: DraftValues;
}

export const DRAFT_VERSION = 1;
/** Drafts older than this are ignored (sessionStorage normally ends with the tab anyway). */
export const DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Storage key, scoped to this site and year so other sites on the same origin never collide. */
export function draftStorageKey(site: { shortName: string; year: number }): string {
  const slug = site.shortName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug || "site"}-${site.year}:office-hours-application:v${DRAFT_VERSION}`;
}

export function blankDraftValues(): DraftValues {
  return {
    fullName: "",
    email: "",
    year: "",
    major: "",
    participation: "individual",
    teamName: "",
    teammates: "",
    stage: "",
    workingOn: "",
    question: "",
    mentorIds: [],
    firstChoiceMentorId: "",
    availability: [],
    availabilityNotes: "",
    link: "",
    acknowledgeNoGuarantee: false,
    consentToShare: false,
    referrerMentorId: "",
  };
}

/** Pick exactly the draft fields out of a larger form state (drops the honeypot and anything else). */
export function toDraftValues(state: DraftValues & Record<string, unknown>): DraftValues {
  const blank = blankDraftValues();
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(blank) as (keyof DraftValues)[]) out[key] = state[key];
  return out as unknown as DraftValues;
}

/** True when nothing worth restoring has been entered. */
export function isBlankDraft(values: DraftValues): boolean {
  const blank = blankDraftValues();
  return (Object.keys(blank) as (keyof DraftValues)[]).every((key) => {
    const v = values[key];
    const b = blank[key];
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === "string") return v.trim() === (b as string);
    return v === b;
  });
}

export function serializeDraft(draft: ApplicationDraft, now: number = Date.now()): string {
  return JSON.stringify({
    v: DRAFT_VERSION,
    savedAt: now,
    key: draft.key,
    startedAt: draft.startedAt,
    values: toDraftValues(draft.values as DraftValues & Record<string, unknown>),
  });
}

// ---------------------------------------------------------------------------
// Parsing (never trust what comes back from storage)
// ---------------------------------------------------------------------------

/** Generous caps: the schema reports the real limits; this only stops absurd stored values. */
const TEXT_CAPS: Record<string, number> = {
  fullName: LIMITS.fullName * 2,
  email: 254,
  major: LIMITS.major * 2,
  teamName: LIMITS.teamName * 2,
  teammates: LIMITS.teammates * 2,
  workingOn: LIMITS.longAnswerChars * 2,
  question: LIMITS.longAnswerChars * 2,
  availabilityNotes: LIMITS.availabilityNotes * 2,
  link: LIMITS.link * 2,
};

function text(value: unknown, cap: number): string {
  return typeof value === "string" ? value.slice(0, cap) : "";
}

function oneOf(value: unknown, allowed: readonly { value: string }[], fallback: string): string {
  return typeof value === "string" && allowed.some((o) => o.value === value) ? value : fallback;
}

function uniqueStrings(value: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && allowed.has(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

/**
 * Parse a stored draft. Returns null for anything missing, malformed, from another version,
 * expired, or blank.
 */
export function parseDraft(raw: string | null, catalog: ApplicationCatalog, now: number = Date.now()): ApplicationDraft | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, unknown>;
  if (d.v !== DRAFT_VERSION) return null;
  const savedAt = typeof d.savedAt === "number" && Number.isFinite(d.savedAt) ? d.savedAt : NaN;
  if (!(savedAt <= now) || now - savedAt > DRAFT_TTL_MS) return null;
  const v = d.values && typeof d.values === "object" && !Array.isArray(d.values) ? (d.values as Record<string, unknown>) : null;
  if (!v) return null;

  const mentorIdSet = new Set(catalog.mentors.map((m) => m.id));
  const optionKeys = new Set(catalog.mentors.flatMap((m) => m.options.map((o) => o.key)));
  const mentorIds = uniqueStrings(v.mentorIds, mentorIdSet);
  const firstChoice = typeof v.firstChoiceMentorId === "string" && mentorIds.includes(v.firstChoiceMentorId) ? v.firstChoiceMentorId : "";
  const referrer = typeof v.referrerMentorId === "string" && mentorIdSet.has(v.referrerMentorId) ? v.referrerMentorId : "";

  const values: DraftValues = {
    fullName: text(v.fullName, TEXT_CAPS.fullName),
    email: text(v.email, TEXT_CAPS.email),
    year: oneOf(v.year, YEAR_OPTIONS, ""),
    major: text(v.major, TEXT_CAPS.major),
    participation: oneOf(v.participation, PARTICIPATION_OPTIONS, "individual"),
    teamName: text(v.teamName, TEXT_CAPS.teamName),
    teammates: text(v.teammates, TEXT_CAPS.teammates),
    stage: oneOf(v.stage, STAGE_OPTIONS, ""),
    workingOn: text(v.workingOn, TEXT_CAPS.workingOn),
    question: text(v.question, TEXT_CAPS.question),
    mentorIds,
    firstChoiceMentorId: firstChoice,
    availability: uniqueStrings(v.availability, optionKeys),
    availabilityNotes: text(v.availabilityNotes, TEXT_CAPS.availabilityNotes),
    link: text(v.link, TEXT_CAPS.link),
    acknowledgeNoGuarantee: v.acknowledgeNoGuarantee === true,
    consentToShare: v.consentToShare === true,
    referrerMentorId: referrer,
  };
  if (isBlankDraft(values)) return null;

  const startedAt =
    typeof d.startedAt === "number" && Number.isFinite(d.startedAt) && d.startedAt <= savedAt ? d.startedAt : savedAt;
  const key = typeof d.key === "string" && UUID.test(d.key) ? d.key : null;
  return { key, startedAt, values };
}
