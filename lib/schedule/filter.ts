/**
 * Schedule filtering, search, facet counts and overlap detection. Pure — safe on server and
 * client, and shared by the /schedule calendar, the event detail page and the tests.
 *
 * Filters follow the shareable URL contract in ./url.ts (day, view, type, q).
 */
import type { EventType, ISODate } from "@/content/types";
import { EVENT_TYPE_LABELS, type ScheduleEntry } from "./entries";
import { DEFAULT_SCHEDULE_FILTERS, EVENT_TYPES, type ScheduleFilters } from "./url";

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Lowercase, strip accents and collapse punctuation so "Café" matches "cafe" and "CAFE". */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Query → normalized tokens ("  Isbell  Quantum" → ["isbell", "quantum"]). */
export function queryTokens(query: string): string[] {
  return normalizeSearchText(query).split(" ").filter(Boolean);
}

/**
 * Everything a student might search for: title, summary, description, speakers, organizer,
 * topics, venue, mentor and, for program blocks, every sub-session's title and people
 * ("Isbell", "quantum", "Doss" all find the Founders Showcase day program).
 */
export function entrySearchText(entry: ScheduleEntry): string {
  const loc = entry.location;
  const place =
    loc.kind === "in-person" || loc.kind === "hybrid"
      ? [loc.venue, loc.room, loc.address]
      : loc.kind === "virtual"
        ? [loc.platform, "virtual online"]
        : [];
  const parts = [
    entry.title,
    entry.summary,
    entry.description,
    entry.organizer,
    ...entry.speakers.flatMap((s) => [s.name, s.title]),
    ...entry.topics,
    ...place,
    ...entry.types.map((t) => EVENT_TYPE_LABELS[t]),
    entry.mentor?.name,
    entry.mentor?.company,
    entry.mentor?.role,
    ...entry.sessions.flatMap((s) => [s.title, ...s.people.flatMap((p) => [p.name, p.title])]),
  ];
  return normalizeSearchText(parts.filter(Boolean).join(" "));
}

/** Every word of the query must appear somewhere (prefix matches count: "aero" finds "Aerospace"). */
export function matchesQuery(entry: ScheduleEntry, query: string): boolean {
  const tokens = queryTokens(query);
  if (!tokens.length) return true;
  const haystack = entrySearchText(entry);
  return tokens.every((t) => haystack.includes(t));
}

// ---------------------------------------------------------------------------
// Filtering and facet counts
// ---------------------------------------------------------------------------

type Dimension = "day" | "view" | "types" | "q";

function matches(entry: ScheduleEntry, filters: ScheduleFilters, ignore?: Dimension): boolean {
  if (ignore !== "day" && filters.day && entry.date !== filters.day) return false;
  if (ignore !== "view" && filters.view === "picks" && !entry.foundersPick) return false;
  if (ignore !== "types" && filters.types.length && !entry.types.some((t) => filters.types.includes(t))) return false;
  if (ignore !== "q" && filters.q.trim() && !matchesQuery(entry, filters.q)) return false;
  return true;
}

/** Entries matching every active filter (types are "any of"). Order is preserved. */
export function filterEntries(entries: ScheduleEntry[], filters: ScheduleFilters): ScheduleEntry[] {
  return entries.filter((e) => matches(e, filters));
}

/** Per-day counts under the other active filters (so tabs show where matches are). */
export function dayCounts(entries: ScheduleEntry[], days: readonly ISODate[], filters: ScheduleFilters) {
  const pool = entries.filter((e) => matches(e, filters, "day"));
  return {
    all: pool.length,
    byDay: Object.fromEntries(days.map((d) => [d, pool.filter((e) => e.date === d).length])) as Record<ISODate, number>,
  };
}

/**
 * Types that always get a filter chip, even with zero entries. Office hours lead: they're the
 * site's first priority.
 */
export const CORE_FILTER_TYPES: EventType[] = ["office-hours", "talk", "panel", "networking"];

export const EVENT_TYPE_PLURALS: Record<EventType, string> = {
  talk: "Talks",
  panel: "Panels",
  workshop: "Workshops",
  networking: "Networking",
  "office-hours": "Office hours",
  pitch: "Pitches",
  social: "Socials",
  other: "Other",
};

export interface TypeFacet {
  type: EventType;
  label: string;
  /** Matches for this type under the other active filters (day, view, search). */
  count: number;
}

/**
 * Chips to show: the core types, plus any other type present in the content (or currently
 * selected via a shared link), in a stable order.
 */
export function typeFacets(entries: ScheduleEntry[], filters: ScheduleFilters): TypeFacet[] {
  const present = new Set<EventType>(entries.flatMap((e) => e.types));
  const pool = entries.filter((e) => matches(e, filters, "types"));
  const order: EventType[] = [...CORE_FILTER_TYPES, ...EVENT_TYPES.filter((t) => !CORE_FILTER_TYPES.includes(t))];
  return order
    .filter((t) => CORE_FILTER_TYPES.includes(t) || present.has(t) || filters.types.includes(t))
    .map((type) => ({
      type,
      label: EVENT_TYPE_PLURALS[type],
      count: pool.filter((e) => e.types.includes(type)).length,
    }));
}

export interface Relaxation {
  dimension: Dimension;
  /** Result count if only this filter were cleared. */
  count: number;
  filters: ScheduleFilters;
}

/**
 * For empty states: what would come back if each active filter were cleared on its own.
 * Sorted by how many results it would bring back.
 */
export function relaxations(entries: ScheduleEntry[], filters: ScheduleFilters): Relaxation[] {
  const out: Relaxation[] = [];
  const push = (dimension: Dimension, patch: Partial<ScheduleFilters>) => {
    const next = { ...filters, ...patch };
    out.push({ dimension, count: filterEntries(entries, next).length, filters: next });
  };
  if (filters.day) push("day", { day: null });
  if (filters.view === "picks") push("view", { view: "all" });
  if (filters.types.length) push("types", { types: [] });
  if (filters.q.trim()) push("q", { q: "" });
  return out.sort((a, b) => b.count - a.count);
}

export function isDefaultFilters(filters: ScheduleFilters): boolean {
  return (
    filters.day === DEFAULT_SCHEDULE_FILTERS.day &&
    filters.view === DEFAULT_SCHEDULE_FILTERS.view &&
    filters.types.length === 0 &&
    !filters.q.trim()
  );
}

// ---------------------------------------------------------------------------
// Grouping and overlaps
// ---------------------------------------------------------------------------

export interface DayGroup {
  date: ISODate;
  entries: ScheduleEntry[];
}

/** Group chronologically sorted entries by date (input order is kept within a day). */
export function groupByDay(entries: ScheduleEntry[]): DayGroup[] {
  const groups = new Map<ISODate, ScheduleEntry[]>();
  for (const e of entries) {
    const list = groups.get(e.date);
    if (list) list.push(e);
    else groups.set(e.date, [e]);
  }
  return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, list]) => ({ date, entries: list }));
}

/** Entries with a real interval that can clash: exact start + end, and not canceled. */
function interval(entry: ScheduleEntry): { start: number; end: number } | null {
  if (entry.status === "canceled" || !entry.startsAt || !entry.endsAt) return null;
  return { start: Date.parse(entry.startsAt), end: Date.parse(entry.endsAt) };
}

/** True when both entries have exact times on the same day and their intervals intersect. */
export function entriesOverlap(a: ScheduleEntry, b: ScheduleEntry): boolean {
  if (a.id === b.id || a.date !== b.date) return false;
  const x = interval(a);
  const y = interval(b);
  if (!x || !y) return false;
  // Back-to-back (one ends when the next starts) is not an overlap.
  return x.start < y.end && y.start < x.end;
}

/** Other entries (from `pool`) whose exact times intersect `entry`'s. */
export function overlapsFor(entry: ScheduleEntry, pool: ScheduleEntry[]): ScheduleEntry[] {
  return pool.filter((other) => entriesOverlap(entry, other));
}

export interface OverlapRef {
  id: string;
  title: string;
}

export type AgendaBlock =
  | { kind: "single"; entry: ScheduleEntry }
  | {
      kind: "overlap";
      entries: ScheduleEntry[];
      /** Most entries happening at the same instant (≥ 2). */
      maxConcurrent: number;
      /** Earliest start / latest end in the cluster, local wall-clock `HH:mm`. */
      start: string;
      end: string;
      /** For each entry id, the other cluster members it actually overlaps. */
      overlapsWith: Record<string, OverlapRef[]>;
    };

/**
 * Split one day's entries (chronological) into agenda blocks, merging entries whose exact
 * intervals intersect (directly or through a chain) into one overlap cluster. Entries without
 * an exact interval (part-of-day, TBA, no end time) and canceled entries never cluster.
 */
export function agendaBlocks(dayEntries: ScheduleEntry[]): AgendaBlock[] {
  const blocks: AgendaBlock[] = [];
  const timed = dayEntries
    .map((entry, index) => ({ entry, index, iv: interval(entry) }))
    .filter((x): x is { entry: ScheduleEntry; index: number; iv: { start: number; end: number } } => x.iv !== null)
    .sort((a, b) => a.iv.start - b.iv.start || a.index - b.index);

  // Sweep: consecutive (by start) intervals that begin before the running max end share a cluster.
  const clusterOf = new Map<string, number>();
  const clusters: { members: typeof timed; maxEnd: number }[] = [];
  for (const item of timed) {
    const current = clusters[clusters.length - 1];
    if (current && item.iv.start < current.maxEnd) {
      current.members.push(item);
      current.maxEnd = Math.max(current.maxEnd, item.iv.end);
    } else {
      clusters.push({ members: [item], maxEnd: item.iv.end });
    }
    clusterOf.set(item.entry.id, clusters.length - 1);
  }

  const emitted = new Set<number>();
  for (const entry of dayEntries) {
    const ci = clusterOf.get(entry.id);
    const cluster = ci === undefined ? null : clusters[ci];
    if (!cluster || cluster.members.length < 2) {
      blocks.push({ kind: "single", entry });
      continue;
    }
    if (emitted.has(ci!)) continue;
    emitted.add(ci!);
    const members = cluster.members.map((m) => m.entry);
    const overlapsWith: Record<string, OverlapRef[]> = {};
    for (const m of members) {
      overlapsWith[m.id] = members.filter((o) => entriesOverlap(m, o)).map((o) => ({ id: o.id, title: o.title }));
    }
    blocks.push({
      kind: "overlap",
      entries: members,
      maxConcurrent: maxConcurrent(cluster.members.map((m) => m.iv)),
      start: localStart(members[0]),
      end: latestLocalEnd(members),
      overlapsWith,
    });
  }
  return blocks;
}

function maxConcurrent(intervals: { start: number; end: number }[]): number {
  // Ends sort before starts at the same instant, so back-to-back entries don't count as concurrent.
  const points = intervals
    .flatMap((iv) => [
      { t: iv.start, d: 1 },
      { t: iv.end, d: -1 },
    ])
    .sort((a, b) => a.t - b.t || a.d - b.d);
  let current = 0;
  let max = 0;
  for (const p of points) {
    current += p.d;
    max = Math.max(max, current);
  }
  return max;
}

function localStart(entry: ScheduleEntry): string {
  return entry.time.kind === "exact" ? entry.time.start : "";
}

function latestLocalEnd(entries: ScheduleEntry[]): string {
  let latest = "";
  for (const e of entries) {
    if (e.time.kind === "exact" && e.time.end && e.time.end > latest) latest = e.time.end;
  }
  return latest;
}
