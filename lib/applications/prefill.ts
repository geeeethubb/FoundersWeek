/**
 * Deep links into the application preselect a mentor and, optionally, one of their availability
 * options: `/office-hours?mentor=<id>[&window=<id>|&slot=<id>]#apply` (see `applyHref` /
 * `mentorApplyHref`). Old `/apply?…` links redirect there with the same parameters.
 *
 * - `resolvePrefill` turns URL parameters into a validated selection (server: first render).
 * - `mergePrefill` folds a selection into answers the student has already given (client: a CTA on
 *   the same page changed the URL while the form was open). It only ever ADDS — nothing the
 *   student entered is cleared.
 *
 * Anything that doesn't match the current catalog is ignored silently: an old shared link should
 * still open a working form rather than an error. Pure — safe on server and client.
 */
import type { ApplicationCatalog } from "./catalog";
import { optionKey } from "./catalog";

export interface ApplicationPrefill {
  mentorIds: string[];
  firstChoiceMentorId: string;
  availability: string[];
  /** Mentor the student arrived from (stored for organizers), or "". */
  referrerMentorId: string;
}

export type ApplySearchParams = Record<string, string | string[] | undefined>;

/** The URL parameters the application reads. */
export const PREFILL_PARAMS = ["mentor", "window", "slot"] as const;

export const EMPTY_PREFILL: ApplicationPrefill = {
  mentorIds: [],
  firstChoiceMentorId: "",
  availability: [],
  referrerMentorId: "",
};

function firstValue(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v.trim().slice(0, 200) : "";
}

/** The prefill-relevant part of a query string (URLSearchParams from `useSearchParams`). */
export function prefillParamsFrom(search: Pick<URLSearchParams, "get">): ApplySearchParams {
  const out: ApplySearchParams = {};
  for (const key of PREFILL_PARAMS) {
    const value = search.get(key);
    if (value) out[key] = value;
  }
  return out;
}

/** Stable identity of the prefill parameters, to notice when they change. */
export function prefillParamsKey(params: ApplySearchParams): string {
  return PREFILL_PARAMS.map((key) => firstValue(params[key])).join("|");
}

export function resolvePrefill(catalog: ApplicationCatalog, params: ApplySearchParams): ApplicationPrefill {
  const mentorParam = firstValue(params.mentor);
  const windowParam = firstValue(params.window);
  const slotParam = firstValue(params.slot);

  let mentor = mentorParam ? catalog.mentors.find((m) => m.id === mentorParam) : undefined;

  // A slot is more specific than a window, so it wins when both are present.
  const requestedKey = slotParam ? optionKey("slot", slotParam) : windowParam ? optionKey("window", windowParam) : "";
  const owner = requestedKey ? catalog.mentors.find((m) => m.options.some((o) => o.key === requestedKey)) : undefined;

  // `?window=…` alone is enough to identify the mentor.
  if (!mentor && !mentorParam && owner) mentor = owner;
  if (!mentor) return EMPTY_PREFILL;

  const availability = owner && owner.id === mentor.id ? [requestedKey] : [];
  return {
    mentorIds: [mentor.id],
    firstChoiceMentorId: mentor.id,
    availability,
    referrerMentorId: mentor.id,
  };
}

// ---------------------------------------------------------------------------
// Merging into answers already given
// ---------------------------------------------------------------------------

/** The slice of form state a prefill can touch. Everything else passes through untouched. */
export interface PrefillTarget {
  mentorIds: string[];
  firstChoiceMentorId: string;
  availability: string[];
  referrerMentorId: string;
}

export interface PrefillMergeOutcome {
  mentorId: string;
  /** False when the mentor was already selected. */
  mentorAdded: boolean;
  /** True when this merge made the mentor the first choice (there was none yet). */
  madeFirstChoice: boolean;
  /** Option key newly selected by this merge, if any. */
  optionAdded: string | null;
}

export interface PrefillMergeResult<S extends PrefillTarget> {
  /** The same object when nothing changed. */
  state: S;
  /** What the merge did (for the live announcement); null when the prefill was empty/invalid. */
  outcome: PrefillMergeOutcome | null;
  changed: boolean;
}

/** One selected mentor is the first choice automatically; otherwise it must be chosen. */
function currentFirstChoice(state: Pick<PrefillTarget, "mentorIds" | "firstChoiceMentorId">): string {
  if (state.mentorIds.length === 1) return state.mentorIds[0];
  return state.mentorIds.includes(state.firstChoiceMentorId) ? state.firstChoiceMentorId : "";
}

/**
 * Add a prefilled mentor (and option) to the current answers without clearing anything:
 * - the mentor is appended if not already selected;
 * - it becomes the first choice only when there is no first choice yet — an existing (explicit or
 *   implicit single-mentor) first choice is kept and made explicit;
 * - a valid option is added to the selected times;
 * - the referrer is recorded only if none was recorded yet.
 */
export function mergePrefill<S extends PrefillTarget>(state: S, prefill: ApplicationPrefill): PrefillMergeResult<S> {
  const mentorId = prefill.mentorIds[0];
  if (!mentorId) return { state, outcome: null, changed: false };

  const mentorAdded = !state.mentorIds.includes(mentorId);
  const mentorIds = mentorAdded ? [...state.mentorIds, mentorId] : state.mentorIds;
  const existingFirst = currentFirstChoice(state);
  const firstChoiceMentorId = existingFirst || mentorId;
  const option = prefill.availability[0];
  const optionAdded = option && !state.availability.includes(option) ? option : null;
  const availability = optionAdded ? [...state.availability, optionAdded] : state.availability;
  const referrerMentorId = state.referrerMentorId || prefill.referrerMentorId;

  const changed =
    mentorAdded ||
    optionAdded !== null ||
    firstChoiceMentorId !== state.firstChoiceMentorId ||
    referrerMentorId !== state.referrerMentorId;

  return {
    state: changed ? { ...state, mentorIds, firstChoiceMentorId, availability, referrerMentorId } : state,
    outcome: {
      mentorId,
      mentorAdded,
      madeFirstChoice: !existingFirst,
      optionAdded,
    },
    changed,
  };
}

/** `mergePrefill` straight from URL parameters (invalid parameters change nothing). */
export function mergeSearchParams<S extends PrefillTarget>(
  state: S,
  catalog: ApplicationCatalog,
  params: ApplySearchParams,
): PrefillMergeResult<S> {
  return mergePrefill(state, resolvePrefill(catalog, params));
}
