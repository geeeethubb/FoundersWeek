/**
 * Shareable schedule URLs. The query string is the single source of truth for filters:
 *
 *   /schedule                          all days, all events
 *   /schedule?day=2026-10-01           one day
 *   /schedule?view=picks               Founders picks only
 *   /schedule?type=talk,workshop       event types (any of)
 *   /schedule?q=aerospace              search title, speaker, organizer, topic
 *   /schedule/<event-id>               a single event (shareable detail page)
 */
import type { EventType, ISODate } from "@/content/types";

export const EVENT_TYPES: EventType[] = [
  "talk",
  "panel",
  "workshop",
  "networking",
  "office-hours",
  "pitch",
  "social",
  "other",
];

export interface ScheduleFilters {
  /** null = all days */
  day: ISODate | null;
  view: "all" | "picks";
  types: EventType[];
  q: string;
}

export const DEFAULT_SCHEDULE_FILTERS: ScheduleFilters = { day: null, view: "all", types: [], q: "" };

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(source: ParamSource, key: string): string | undefined {
  if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
  const v = source[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Parse filters, dropping anything invalid (unknown day, unknown type…). */
export function parseScheduleFilters(source: ParamSource, validDays?: readonly string[]): ScheduleFilters {
  const day = read(source, "day");
  const view = read(source, "view");
  const types = (read(source, "type") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is EventType => (EVENT_TYPES as string[]).includes(t));
  const q = (read(source, "q") ?? "").slice(0, 100);
  return {
    day: day && (!validDays || validDays.includes(day)) && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
    view: view === "picks" ? "picks" : "all",
    types: [...new Set(types)],
    q,
  };
}

export function scheduleQuery(filters: Partial<ScheduleFilters>): string {
  const q = new URLSearchParams();
  if (filters.day) q.set("day", filters.day);
  if (filters.view === "picks") q.set("view", "picks");
  if (filters.types?.length) q.set("type", filters.types.join(","));
  if (filters.q?.trim()) q.set("q", filters.q.trim());
  return q.toString();
}

export function scheduleHref(filters: Partial<ScheduleFilters> = {}): string {
  const q = scheduleQuery(filters);
  return q ? `/schedule?${q}` : "/schedule";
}

export function eventHref(id: string): string {
  return `/schedule/${id}`;
}

export function hasActiveFilters(filters: ScheduleFilters): boolean {
  return Boolean(filters.day || filters.view === "picks" || filters.types.length || filters.q.trim());
}
