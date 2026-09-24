/**
 * Organizer dashboard filters. The query string is the source of truth, so filtered views are
 * linkable, work as a plain GET form without JavaScript, and the CSV export receives the same
 * filters as the table.
 *
 *   /organizers?mentor=ron-lewis&choice=first   first choice = Ron
 *   /organizers?availability=slot:<id>          selected a specific slot (or window:<id>)
 *   /organizers?availability=none               interest only (no time selected)
 *   /organizers?status=under_review&q=aero&sort=oldest
 *
 * Pure — safe on server and client.
 */
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/applications/constants";

export type ApplicationSort = "newest" | "oldest";

export interface ApplicationFilters {
  /** Mentor id, or null for all mentors. */
  mentor: string | null;
  /** Only applications whose FIRST choice is `mentor`. Ignored without a mentor. */
  firstChoiceOnly: boolean;
  /** "window:<id>", "slot:<id>", "none" (no time selected), or null for any. */
  availability: string | null;
  status: ApplicationStatus | null;
  /** Free text: name, email, major, team name, teammates. */
  q: string;
  sort: ApplicationSort;
}

export const DEFAULT_APPLICATION_FILTERS: ApplicationFilters = {
  mentor: null,
  firstChoiceOnly: false,
  availability: null,
  status: null,
  q: "",
  sort: "newest",
};

export const NO_TIME_SELECTED = "none";
export const SEARCH_MAX_LENGTH = 100;

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const OPTION_RE = /^(window|slot):([a-z0-9]+(?:-[a-z0-9]+)*)$/;

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const v = source[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Parse filters, dropping anything malformed. */
export function parseApplicationFilters(source: ParamSource): ApplicationFilters {
  const mentor = read(source, "mentor")?.trim() ?? "";
  const availability = read(source, "availability")?.trim() ?? "";
  const status = read(source, "status")?.trim() ?? "";
  const validMentor = mentor.length <= 100 && ID_RE.test(mentor) ? mentor : null;
  return {
    mentor: validMentor,
    firstChoiceOnly: Boolean(validMentor) && read(source, "choice") === "first",
    availability:
      availability === NO_TIME_SELECTED || (availability.length <= 120 && OPTION_RE.test(availability))
        ? availability
        : null,
    status: (APPLICATION_STATUSES as readonly string[]).includes(status) ? (status as ApplicationStatus) : null,
    q: (read(source, "q") ?? "").trim().slice(0, SEARCH_MAX_LENGTH),
    sort: read(source, "sort") === "oldest" ? "oldest" : "newest",
  };
}

/** Canonical query string (no leading "?"), omitting defaults. */
export function applicationFiltersQuery(filters: Partial<ApplicationFilters>): string {
  const q = new URLSearchParams();
  if (filters.mentor) q.set("mentor", filters.mentor);
  if (filters.mentor && filters.firstChoiceOnly) q.set("choice", "first");
  if (filters.availability) q.set("availability", filters.availability);
  if (filters.status) q.set("status", filters.status);
  if (filters.q) q.set("q", filters.q);
  if (filters.sort === "oldest") q.set("sort", "oldest");
  return q.toString();
}

export function organizersHref(filters: Partial<ApplicationFilters>): string {
  const q = applicationFiltersQuery(filters);
  return q ? `/organizers?${q}` : "/organizers";
}

export function exportHref(filters: Partial<ApplicationFilters>): string {
  const q = applicationFiltersQuery(filters);
  return q ? `/api/organizer/export?${q}` : "/api/organizer/export";
}

/** Number of filters that narrow results (sort doesn't count). */
export function activeFilterCount(filters: ApplicationFilters): number {
  return [filters.mentor, filters.availability, filters.status, filters.q].filter(Boolean).length;
}

/**
 * Drop filter values that don't exist in content (unknown mentor ids, window/slot ids), so the
 * form always reflects what's applied. Events are never mentors: an event id such as
 * "dan-caruso-fireside-chat" is not a mentor filter.
 */
export function restrictToDirectory(
  filters: ApplicationFilters,
  directory: {
    mentorsById: ReadonlyMap<string, unknown>;
    slotsById: ReadonlyMap<string, unknown>;
    windowsById: ReadonlyMap<string, unknown>;
  },
): ApplicationFilters {
  const mentor = filters.mentor && directory.mentorsById.has(filters.mentor) ? filters.mentor : null;
  let availability = filters.availability;
  if (availability && availability !== NO_TIME_SELECTED) {
    const [kind, id] = availability.split(":");
    const known = kind === "slot" ? directory.slotsById.has(id) : directory.windowsById.has(id);
    if (!known) availability = null;
  }
  return { ...filters, mentor, firstChoiceOnly: Boolean(mentor) && filters.firstChoiceOnly, availability };
}
