/**
 * Pure helpers behind the application form: field order, DOM ids for focus management, client-side
 * validation with the SAME zod schema the API uses, and the wording of prefill notices.
 * No React here, so it can be unit tested.
 */
import type { ApplicationCatalog, AvailabilityOption, CatalogMentor } from "@/lib/applications/catalog";
import { mentorNeedsBroadAvailability } from "@/lib/applications/catalog";
import { LIMITS, STAGE_OPTIONS, YEAR_OPTIONS } from "@/lib/applications/constants";
import type { OptionPresentation } from "@/lib/applications/option-presentation";
import {
  PREFILL_PARAMS,
  prefillParamsFrom,
  resolvePrefill,
  type ApplicationPrefill,
  type ApplySearchParams,
  type PrefillMergeOutcome,
} from "@/lib/applications/prefill";
import {
  createApplicationSchema,
  emptyApplicationValues,
  toFieldErrors,
  type ApplicationFormValues,
} from "@/lib/applications/schema";
import { APPLY_ANCHOR, APPLY_PATH } from "@/lib/schedule/entries";

/** Form state held in React. The idempotency key and elapsed time are added at submit. */
export type FormState = Omit<ApplicationFormValues, "idempotencyKey" | "elapsedMs">;

export type FieldErrors = Record<string, string>;

export function emptyFormState(): FormState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { idempotencyKey, elapsedMs, ...empty } = emptyApplicationValues("");
  return empty;
}

/** The three groups of the form, in order, with the error keys each one owns. */
export const FORM_GROUPS = [
  {
    id: "about",
    title: "About you",
    fields: ["fullName", "email", "year", "major", "participation", "teamName", "teammates"],
  },
  {
    id: "interests",
    title: "Your interests",
    fields: [
      "mentorIds",
      "firstChoiceMentorId",
      "availability",
      "availabilityNotes",
      "stage",
      "workingOn",
      "question",
      "link",
    ],
  },
  { id: "submit", title: "Submit", fields: ["acknowledgeNoGuarantee", "consentToShare"] },
] as const;

export type FormGroupId = (typeof FORM_GROUPS)[number]["id"];

/** Every field in on-screen order (used to order the error summary). */
export const FIELD_ORDER: string[] = FORM_GROUPS.flatMap((g) => [...g.fields]);

export function groupDomId(id: FormGroupId): string {
  return `apply-group-${id}`;
}

/** Stable DOM id for a simple field. */
export function fieldId(name: string): string {
  return `apply-${name.replace(/[^a-zA-Z0-9-]/g, "-")}`;
}

export function mentorCheckboxId(mentorId: string): string {
  return `apply-mentor-${mentorId}`;
}

/** The list item that holds a mentor's row (scroll target after a prefill merge). */
export function mentorRowId(mentorId: string): string {
  return `apply-mentor-row-${mentorId}`;
}

export function firstChoiceRadioId(mentorId: string): string {
  return `apply-first-choice-${mentorId}`;
}

export function optionCheckboxId(key: string): string {
  return `apply-option-${key.replace(/[^a-zA-Z0-9-]/g, "-")}`;
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

/** Selected mentors in directory order. */
export function selectedMentors(state: Pick<FormState, "mentorIds">, catalog: ApplicationCatalog): CatalogMentor[] {
  return catalog.mentors.filter((m) => state.mentorIds.includes(m.id));
}

/**
 * Times a student can tick ("I can make …"): the published options of the selected mentors.
 * Mentors whose schedule is still pending have none (see `mentorsWithoutTimes`).
 */
export function knownTimes(
  state: Pick<FormState, "mentorIds">,
  catalog: ApplicationCatalog,
): { mentor: CatalogMentor; option: AvailabilityOption }[] {
  return selectedMentors(state, catalog).flatMap((mentor) => mentor.options.map((option) => ({ mentor, option })));
}

/**
 * Selected mentors whose times aren't set yet (scheduling in progress, or a date with the time still
 * to be confirmed), in the order they were chosen. Same rule as the schema.
 */
export function mentorsWithoutTimes(state: Pick<FormState, "mentorIds">, catalog: ApplicationCatalog): CatalogMentor[] {
  return state.mentorIds.flatMap((id) => {
    const mentor = catalog.mentors.find((m) => m.id === id);
    return mentor && mentorNeedsBroadAvailability(mentor) ? [mentor] : [];
  });
}

/** "Vik", "Vik and Ron", "Vik, Elliott and Ron" (same wording as the schema's messages). */
export function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * Hint for "Broad availability", and whether it's required right now. Mirrors the schema's rule:
 * it's needed for any selected mentor whose times aren't set yet; otherwise a ticked time or the
 * note is enough.
 */
export function broadAvailabilityGuidance(
  state: Pick<FormState, "mentorIds" | "availability">,
  catalog: ApplicationCatalog,
): { hint: string; required: boolean } {
  const ask = "When are you generally free during Founders Week? e.g. Thursday morning, anytime Friday.";
  const pending = mentorsWithoutTimes(state, catalog);
  if (pending.length) {
    // Mentors with a set date but no time yet (e.g. Rishab on Thu, Oct 1): ask for that day.
    const dated = pending
      .filter((m) => m.options.length)
      .map((m) => `${m.firstName} has office hours on ${joinNames([...new Set(m.options.map((o) => o.label.split(" · ")[0]))])}, so include when you’re free that day.`);
    return {
      hint: [`${ask} Needed because ${joinNames(pending.map((m) => m.firstName))}’s times aren’t set yet.`, ...dated].join(" "),
      required: true,
    };
  }
  if (knownTimes(state, catalog).length) {
    return { hint: `${ask} Not needed if you tick a time above.`, required: effectiveAvailability(state, catalog).length === 0 };
  }
  return { hint: ask, required: true };
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

/** A syntactically valid placeholder so live validation doesn't depend on the real key. */
export const PLACEHOLDER_KEY = "00000000-0000-4000-8000-000000000000";

/**
 * Errors produced by the schema's cross-field rules (mentors, first choice, availability) — they
 * depend on each other, so changing one of these answers clears the server's errors for all of them.
 */
export const CROSS_FIELD_KEYS: ReadonlySet<string> = new Set([
  "mentorIds",
  "firstChoiceMentorId",
  "availability",
  "availabilityNotes",
]);

export function createValidator(catalog: ApplicationCatalog, emailDomains: string[]) {
  const schema = createApplicationSchema({ catalog, emailDomains });
  // Known-valid answers for everything except the cross-field choices (see below).
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
  const probeMentor = catalog.mentors[0]?.id;

  return (values: ApplicationFormValues): FieldErrors => {
    const result = schema.safeParse(values);
    if (result.success) return {};
    const errors = toFieldErrors(result.error);
    const addCross = (parsed: ReturnType<typeof schema.safeParse>, only?: string) => {
      if (parsed.success) return;
      for (const [key, message] of Object.entries(toFieldErrors(parsed.error))) {
        if (CROSS_FIELD_KEYS.has(key) && (!only || key === only) && !(key in errors)) errors[key] = message;
      }
    };
    // Zod skips the schema's cross-field rules (unknown mentor, first choice, the availability
    // rule) while any other field is invalid. Run the same schema with valid stand-ins for the
    // other fields so those errors show up together with the rest instead of on a second submit.
    addCross(
      schema.safeParse({
        ...standIns,
        mentorIds: values.mentorIds,
        firstChoiceMentorId: values.firstChoiceMentorId,
        availability: values.availability,
        availabilityNotes: values.availabilityNotes,
      }),
    );
    // With no mentor chosen, "Choose at least one mentor" stops the availability rule too — check
    // it on its own so an empty form lists every missing answer at once.
    if (values.mentorIds.length === 0 && probeMentor) {
      addCross(
        schema.safeParse({
          ...standIns,
          mentorIds: [probeMentor],
          firstChoiceMentorId: probeMentor,
          availabilityNotes: values.availabilityNotes,
        }),
        "availabilityNotes",
      );
    }
    // "Choose at least one mentor" already covers this; a first choice needs mentors to pick from.
    if (values.mentorIds.length === 0) delete errors.firstChoiceMentorId;
    return errors;
  };
}

/** Field order for the error summary: the order of the form. */
export function orderErrors(errors: FieldErrors): [string, string][] {
  const rank = (key: string) => {
    const i = FIELD_ORDER.indexOf(key);
    return i < 0 ? FIELD_ORDER.length : i;
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
      return fieldId(`stage-${state.stage || STAGE_OPTIONS[0].value}`);
    case "year":
      return fieldId("year");
    case "mentorIds": {
      const first = selectedMentors(state, catalog)[0]?.id ?? catalog.mentors[0]?.id;
      return first ? mentorCheckboxId(first) : null;
    }
    case "firstChoiceMentorId": {
      const first = selectedMentors(state, catalog)[0]?.id;
      return first ? firstChoiceRadioId(first) : null;
    }
    case "availability": {
      const time = knownTimes(state, catalog)[0];
      return time ? optionCheckboxId(time.option.key) : fieldId("availabilityNotes");
    }
    case "idempotencyKey":
    case "form":
    case "referrerMentorId":
    case "nickname":
    case "elapsedMs":
      return null;
    default:
      return fieldId(key);
  }
}

// ---------------------------------------------------------------------------
// Prefill notices (initial deep link, restored drafts, and merges while the form is open)
// ---------------------------------------------------------------------------

type Presentations = Record<string, Pick<OptionPresentation, "phrase">>;

function optionPhrase(catalog: ApplicationCatalog, key: string, presentations: Presentations): string | null {
  const option = catalog.mentors.flatMap((m) => m.options).find((o) => o.key === key);
  return option ? (presentations[key]?.phrase ?? option.label) : null;
}

/** Context line when the application opens with a mentor preselected from a link. */
export function prefillNote(
  catalog: ApplicationCatalog,
  prefill: ApplicationPrefill,
  presentations: Presentations,
): string | null {
  const mentor = catalog.mentors.find((m) => m.id === prefill.mentorIds[0]);
  if (!mentor) return null;
  const phrase = prefill.availability[0] ? optionPhrase(catalog, prefill.availability[0], presentations) : null;
  return phrase
    ? `${mentor.name} is selected below, with “I can make ${phrase}” ticked. Add anyone else you’d like to meet.`
    : `${mentor.name} is selected below. Add anyone else you’d like to meet.`;
}

/** Plain-language summary of what a merge (a mentor link used while the form is open) changed. */
export function mergeAnnouncement(
  catalog: ApplicationCatalog,
  outcome: PrefillMergeOutcome,
  presentations: Presentations,
): string {
  const mentor = catalog.mentors.find((m) => m.id === outcome.mentorId);
  if (!mentor) return "";
  const phrase = outcome.optionAdded ? optionPhrase(catalog, outcome.optionAdded, presentations) : null;
  const parts: string[] = [];
  if (outcome.mentorAdded) {
    parts.push(`${mentor.name} added to your mentors.`);
    if (phrase) parts.push(`“I can make ${phrase}” is ticked.`);
  } else if (phrase) {
    parts.push(`“I can make ${phrase}” is ticked for ${mentor.name}.`);
  } else {
    parts.push(`${mentor.name} is already in your mentors.`);
  }
  if (outcome.madeFirstChoice) parts.push(`${mentor.firstName} is your first choice.`);
  return parts.join(" ");
}

/**
 * The line shown about a preselection: `top` above the form (a deep link or a restored draft
 * preselected someone); `merge` above the mentors (a link on this page added a mentor while the
 * form was open).
 */
export interface SelectionNotice {
  id: number;
  kind: "top" | "merge";
  message: string;
  mentorId: string;
  /** The time the notice says is ticked, if any. */
  optionKey: string | null;
}

/** The `top` notice for a preselection (null when it preselects nobody). */
export function prefillNotice(
  catalog: ApplicationCatalog,
  prefill: ApplicationPrefill,
  presentations: Presentations,
  id: number,
): SelectionNotice | null {
  const message = prefillNote(catalog, prefill, presentations);
  const mentorId = prefill.mentorIds[0];
  return message && mentorId ? { id, kind: "top", message, mentorId, optionKey: prefill.availability[0] ?? null } : null;
}

/** Whether two preselections select the same mentor and time. */
export function samePrefill(a: ApplicationPrefill, b: ApplicationPrefill): boolean {
  return a.mentorIds[0] === b.mentorIds[0] && a.availability[0] === b.availability[0];
}

/** A notice about a mentor (or a time) the student has since removed is stale: drop it. */
export function noticeAfterRemoval(
  notice: SelectionNotice | null,
  removed: { mentorId?: string; optionKey?: string },
): SelectionNotice | null {
  if (!notice) return null;
  if (removed.mentorId && removed.mentorId === notice.mentorId) return null;
  if (removed.optionKey && removed.optionKey === notice.optionKey) return null;
  return notice;
}

// ---------------------------------------------------------------------------
// The URL's preselection (?mentor=…&window|slot=…) and links on the page
// ---------------------------------------------------------------------------

/** What a query string (e.g. `window.location.search`) preselects, validated against the catalog. */
export function prefillFromSearch(catalog: ApplicationCatalog, search: string): ApplicationPrefill {
  return resolvePrefill(catalog, prefillParamsFrom(new URLSearchParams(search)));
}

/**
 * True when removing this mentor or time undoes what the URL preselected — the parameters are then
 * dropped from the address bar, so a reload doesn't add the mentor back.
 */
export function removesUrlSelection(
  catalog: ApplicationCatalog,
  search: string,
  removed: { mentorId?: string; optionKey?: string },
): boolean {
  const prefill = prefillFromSearch(catalog, search);
  return Boolean(
    (removed.mentorId && prefill.mentorIds.includes(removed.mentorId)) ||
      (removed.optionKey && prefill.availability.includes(removed.optionKey)),
  );
}

/** The same URL (path, other parameters and hash) without the application's preselection parameters. */
export function withoutPrefillParams(href: string): string {
  const url = new URL(href);
  for (const key of PREFILL_PARAMS) url.searchParams.delete(key);
  return `${url.pathname}${url.search}${url.hash}`;
}

export type ApplyLinkAction =
  | { kind: "navigate" }
  | { kind: "scroll" }
  | { kind: "merge"; params: ApplySearchParams };

/**
 * What a click on a link does while the application is open on this page:
 * - `merge`: a mentor link to the URL we're already on. Next wouldn't navigate (so the URL and
 *   useSearchParams wouldn't change): the form merges its selection itself.
 * - `scroll`: a link to the application that selects nobody, to the URL we're on — just bring the
 *   application into view (nothing else would scroll for an unchanged hash).
 * - `navigate`: anything else is left to the browser / Next (a changed URL merges when it changes).
 *
 * A fragment-only href ("#apply", like the hero button) never selects anyone, even though the
 * browser resolves it against the current `?mentor=…` URL. Neither does a link to a mentor who
 * isn't in the catalog, or any link once the application is submitted: those only scroll.
 */
export function applyLinkAction(
  hrefAttribute: string,
  currentHref: string,
  catalog: ApplicationCatalog,
  options: { canMerge: boolean },
): ApplyLinkAction {
  const current = new URL(currentHref);
  let url: URL;
  try {
    url = new URL(hrefAttribute, current);
  } catch {
    return { kind: "navigate" };
  }
  if (current.pathname !== APPLY_PATH || url.origin !== current.origin || url.pathname !== APPLY_PATH) {
    return { kind: "navigate" };
  }
  if (url.hash !== `#${APPLY_ANCHOR}`) return { kind: "navigate" };
  const fragmentOnly = hrefAttribute.trim().startsWith("#");
  if (!fragmentOnly && url.search !== current.search) return { kind: "navigate" };
  const params = fragmentOnly ? {} : prefillParamsFrom(url.searchParams);
  if (options.canMerge && resolvePrefill(catalog, params).mentorIds.length > 0) return { kind: "merge", params };
  return url.hash === current.hash ? { kind: "scroll" } : { kind: "navigate" };
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
