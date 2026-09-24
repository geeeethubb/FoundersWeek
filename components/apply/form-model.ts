/**
 * Pure helpers behind the application form: steps, field order, DOM ids for focus management,
 * client-side validation with the SAME zod schema the API uses, and the wording of prefill notices.
 * No React here, so it can be unit tested.
 */
import type { ApplicationCatalog, CatalogMentor } from "@/lib/applications/catalog";
import { LIMITS, STAGE_OPTIONS, YEAR_OPTIONS } from "@/lib/applications/constants";
import type { OptionPresentation } from "@/lib/applications/option-presentation";
import type { ApplicationPrefill, PrefillMergeOutcome } from "@/lib/applications/prefill";
import {
  createApplicationSchema,
  toFieldErrors,
  type ApplicationFormValues,
} from "@/lib/applications/schema";

/** Form state held in React. The idempotency key and elapsed time are added at submit. */
export type FormState = Omit<ApplicationFormValues, "idempotencyKey" | "elapsedMs">;

export type FieldErrors = Record<string, string>;

export type SectionId = "mentors" | "about" | "team" | "project" | "links" | "confirm";

export interface SectionDef {
  id: SectionId;
  index: string;
  title: string;
  /** Short label for the progress panel and the review checklist. */
  short: string;
  optional?: boolean;
  /** Error keys that belong to this section (prefix match for per-mentor availability). */
  fields: string[];
}

/**
 * Mentors come first: it's why students are here, and a mentor preselected from a profile or a
 * calendar entry is visible (and adjustable) the moment the application opens.
 */
export const SECTIONS: SectionDef[] = [
  {
    id: "mentors",
    index: "01",
    title: "Who you’d like to meet",
    short: "Mentors & times",
    fields: ["mentorIds", "firstChoiceMentorId", "availability", "availabilityNotes"],
  },
  { id: "about", index: "02", title: "About you", short: "About you", fields: ["fullName", "email", "year", "major"] },
  {
    id: "team",
    index: "03",
    title: "Solo or with a team",
    short: "Solo or team",
    fields: ["participation", "teamName", "teammates"],
  },
  {
    id: "project",
    index: "04",
    title: "What you’re working on",
    short: "Your project",
    fields: ["stage", "workingOn", "question"],
  },
  { id: "links", index: "05", title: "A link, if you have one", short: "Link", optional: true, fields: ["link"] },
  {
    id: "confirm",
    index: "06",
    title: "Confirm",
    short: "Confirm",
    fields: ["acknowledgeNoGuarantee", "consentToShare"],
  },
];

export const SECTION_COUNT = String(SECTIONS.length).padStart(2, "0");

export function sectionDomId(id: SectionId): string {
  return `apply-section-${id}`;
}

/** The review-and-submit block at the end of the form. */
export const SUBMIT_BLOCK_ID = "apply-submit";

/** Stable DOM id for a simple field. */
export function fieldId(name: string): string {
  return `apply-${name.replace(/[^a-zA-Z0-9-]/g, "-")}`;
}

export function mentorCheckboxId(mentorId: string): string {
  return `apply-mentor-${mentorId}`;
}

/** The list item that holds a mentor's card (scroll target after a prefill merge). */
export function mentorRowId(mentorId: string): string {
  return `apply-mentor-row-${mentorId}`;
}

export function firstChoiceRadioId(mentorId: string): string {
  return `apply-first-choice-${mentorId}`;
}

export function optionCheckboxId(key: string): string {
  return `apply-option-${key.replace(/[^a-zA-Z0-9-]/g, "-")}`;
}

/** Id of the element that carries an error message for `key` (for aria-describedby). */
export function errorElementId(key: string): string {
  return `${fieldId(key)}-error`;
}

export function sectionOfError(key: string): SectionId | null {
  const base = key.startsWith("availability.") ? "availability" : key;
  return SECTIONS.find((s) => s.fields.includes(base))?.id ?? null;
}

/** Selected availability that belongs to currently selected mentors (deselecting keeps choices in state). */
export function effectiveAvailability(state: Pick<FormState, "availability" | "mentorIds">, catalog: ApplicationCatalog) {
  const selected = new Set(state.mentorIds);
  return state.availability.filter((key) =>
    catalog.mentors.some((m) => selected.has(m.id) && m.options.some((o) => o.key === key)),
  );
}

/** One selected mentor is automatically the first choice. */
export function effectiveFirstChoice(state: Pick<FormState, "mentorIds" | "firstChoiceMentorId">): string {
  if (state.mentorIds.length === 1) return state.mentorIds[0];
  return state.mentorIds.includes(state.firstChoiceMentorId) ? state.firstChoiceMentorId : "";
}

/** The exact values that are validated and sent. */
export function toSubmissionValues(
  state: FormState,
  catalog: ApplicationCatalog,
  meta: { idempotencyKey: string; elapsedMs: number },
): ApplicationFormValues {
  const team = state.participation === "team";
  return {
    ...state,
    teamName: team ? state.teamName : "",
    teammates: team ? state.teammates : "",
    firstChoiceMentorId: effectiveFirstChoice(state),
    availability: effectiveAvailability(state, catalog),
    idempotencyKey: meta.idempotencyKey,
    elapsedMs: meta.elapsedMs,
  };
}

/** A syntactically valid placeholder so progress checks don't depend on the real key. */
export const PLACEHOLDER_KEY = "00000000-0000-4000-8000-000000000000";

function isMentorKey(key: string): boolean {
  return key === "mentorIds" || key === "firstChoiceMentorId" || key === "availability" || key.startsWith("availability.");
}

export function createValidator(catalog: ApplicationCatalog, emailDomains: string[]) {
  const schema = createApplicationSchema({ catalog, emailDomains });
  // Known-valid answers for everything except the mentor choices (see below).
  const standIns: ApplicationFormValues = {
    idempotencyKey: PLACEHOLDER_KEY,
    fullName: "Stand In",
    email: `stand.in@${emailDomains[0] ?? "illinois.edu"}`,
    year: YEAR_OPTIONS[0].value,
    major: "Undeclared",
    participation: "individual",
    teamName: "",
    teammates: "",
    stage: STAGE_OPTIONS[0].value,
    workingOn: "Stand-in answer",
    question: "Stand-in answer",
    mentorIds: [],
    firstChoiceMentorId: "",
    availability: [],
    availabilityNotes: "",
    link: "",
    acknowledgeNoGuarantee: true,
    consentToShare: true,
    referrerMentorId: "",
    nickname: "",
    elapsedMs: LIMITS.minFillMs,
  };
  return (values: ApplicationFormValues): FieldErrors => {
    const result = schema.safeParse(values);
    if (result.success) return {};
    const errors = toFieldErrors(result.error);
    // Zod skips the schema's cross-field checks (unknown mentor, first choice, a time per mentor)
    // while any other field is invalid. Run the same schema with valid stand-ins for the other
    // fields so those errors show up together with the rest instead of on a second submit.
    const cross = schema.safeParse({
      ...standIns,
      mentorIds: values.mentorIds,
      firstChoiceMentorId: values.firstChoiceMentorId,
      availability: values.availability,
    });
    if (!cross.success) {
      for (const [key, message] of Object.entries(toFieldErrors(cross.error))) {
        if (isMentorKey(key) && !(key in errors)) errors[key] = message;
      }
    }
    // "Choose at least one mentor" already covers this; a first choice needs mentors to pick from.
    if (values.mentorIds.length === 0) delete errors.firstChoiceMentorId;
    return errors;
  };
}

/** Field order for the error summary: the order of the form (per-mentor times follow the directory). */
export function orderErrors(errors: FieldErrors, mentorOrder: string[]): [string, string][] {
  const order = [
    "mentorIds",
    "firstChoiceMentorId",
    "availability",
    ...mentorOrder.map((id) => `availability.${id}`),
    "availabilityNotes",
    "fullName",
    "email",
    "year",
    "major",
    "participation",
    "teamName",
    "teammates",
    "stage",
    "workingOn",
    "question",
    "link",
    "acknowledgeNoGuarantee",
    "consentToShare",
  ];
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i < 0 ? order.length : i;
  };
  return Object.entries(errors).sort((a, b) => rank(a[0]) - rank(b[0]));
}

/**
 * The element that should receive focus for an error. Groups focus their first (or checked)
 * control; unknown keys (e.g. an expired form key) have no field.
 */
export function focusTargetId(key: string, state: FormState, catalog: ApplicationCatalog): string | null {
  switch (key) {
    case "participation":
      return fieldId(`participation-${state.participation || "individual"}`);
    case "stage":
      return fieldId(`stage-${state.stage || "exploring"}`);
    case "mentorIds": {
      const first = state.mentorIds[0] ?? catalog.mentors[0]?.id;
      return first ? mentorCheckboxId(first) : null;
    }
    case "firstChoiceMentorId": {
      // Directory order, like the cards on screen.
      const first = catalog.mentors.find((m) => state.mentorIds.includes(m.id))?.id ?? state.mentorIds[0];
      return first ? firstChoiceRadioId(first) : null;
    }
    case "availability": {
      const mentor = catalog.mentors.find((m) => state.mentorIds.includes(m.id) && m.options.length > 0);
      return mentor ? optionCheckboxId(mentor.options[0].key) : null;
    }
    case "idempotencyKey":
    case "form":
    case "referrerMentorId":
    case "nickname":
    case "elapsedMs":
      return null;
    default:
      if (key.startsWith("availability.")) {
        const mentor = catalog.mentors.find((m) => m.id === key.slice("availability.".length));
        return mentor?.options[0] ? optionCheckboxId(mentor.options[0].key) : null;
      }
      return fieldId(key);
  }
}

export type SectionProgress = { id: SectionId; complete: boolean; started: boolean };

/** Complete = no validation errors in the section; "started" distinguishes untouched optional sections. */
export function sectionProgress(state: FormState, allErrors: FieldErrors): SectionProgress[] {
  const errored = new Set(
    Object.keys(allErrors)
      .map(sectionOfError)
      .filter(Boolean),
  );
  return SECTIONS.map((s) => {
    const started =
      s.id === "links"
        ? state.link.trim() !== ""
        : s.id === "team"
          ? true
          : s.fields.some((f) => {
              const v = (state as unknown as Record<string, unknown>)[f];
              return Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : v === true;
            });
    return { id: s.id, complete: !errored.has(s.id) && (started || Boolean(s.optional)), started };
  });
}

/** Required steps done / total, for progress displays. */
export function requiredProgress(progress: SectionProgress[]): { done: number; total: number } {
  const required = progress.filter((p) => !SECTIONS.find((s) => s.id === p.id)?.optional);
  return { done: required.filter((p) => p.complete).length, total: required.length };
}

export function mentorsById(catalog: ApplicationCatalog): Map<string, CatalogMentor> {
  return new Map(catalog.mentors.map((m) => [m.id, m]));
}

// ---------------------------------------------------------------------------
// Prefill notices (initial deep link, and merges while the form is open)
// ---------------------------------------------------------------------------

type Presentations = Record<string, Pick<OptionPresentation, "label">>;

function optionLabel(catalog: ApplicationCatalog, key: string, presentations: Presentations): string | null {
  const option = catalog.mentors.flatMap((m) => m.options).find((o) => o.key === key);
  return option ? (presentations[key]?.label ?? option.label) : null;
}

/** Context line when the application opens with a mentor preselected from a link. */
export function prefillNote(
  catalog: ApplicationCatalog,
  prefill: ApplicationPrefill,
  presentations: Presentations,
): string | null {
  const mentor = catalog.mentors.find((m) => m.id === prefill.mentorIds[0]);
  if (!mentor) return null;
  if (mentor.options.length === 0) {
    return `${mentor.name} is preselected. Scheduling is still in progress, so there’s no time to pick — you’re expressing interest. Add more mentors if you like.`;
  }
  const label = prefill.availability[0] ? optionLabel(catalog, prefill.availability[0], presentations) : null;
  return label
    ? `${mentor.name} is preselected, with ${label}. Add more mentors if you like — one application covers them all.`
    : `${mentor.name} is preselected. Pick a time below, and add more mentors if you like.`;
}

/** Live announcement after a link on the page added a mentor (or time) to an open application. */
export function mergeAnnouncement(
  catalog: ApplicationCatalog,
  outcome: PrefillMergeOutcome,
  presentations: Presentations,
): string {
  const mentor = catalog.mentors.find((m) => m.id === outcome.mentorId);
  if (!mentor) return "";
  const label = outcome.optionAdded ? optionLabel(catalog, outcome.optionAdded, presentations) : null;
  const parts: string[] = [];
  if (outcome.mentorAdded) {
    parts.push(`${mentor.name} added to your mentors.`);
    if (label) parts.push(`${label} selected.`);
  } else if (label) {
    parts.push(`${label} selected for ${mentor.name}.`);
  } else {
    parts.push(`${mentor.name} is already in your mentors.`);
  }
  if (outcome.madeFirstChoice) parts.push(`${mentor.firstName} is your first choice.`);
  if (outcome.mentorAdded && mentor.options.length === 0) {
    parts.push("Scheduling is in progress, so there’s no time to pick — you’re expressing interest.");
  } else if (outcome.mentorAdded && !label) {
    parts.push(`Pick a time that works for you with ${mentor.firstName}.`);
  }
  return parts.join(" ");
}

/**
 * Break points for labels like "Thu, Oct 1 · 10:00–11:30 AM CT": lines may wrap only after " ·" or
 * " —", so a date or a time range never splits across lines on a phone.
 */
export function splitPhrases(text: string): string[] {
  return text.split(/(?<= [·—]) /u);
}

/** Browsers without crypto.randomUUID (non-secure contexts) still get a v4 UUID. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
