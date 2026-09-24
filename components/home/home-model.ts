/**
 * Pure helpers for the home page (no React, no '@/content') — every count and list on the home
 * page is computed here from the public schedule entries and mentors, so nothing is hard-coded.
 */
import type { Involvement, ISODate, Mentor } from "@/content/types";
import { schedulingStatus } from "@/lib/mentors";
import {
  compareEntries,
  featuredEntries,
  INVOLVEMENT_ORDER,
  type ScheduleEntry,
} from "@/lib/schedule/entries";
import { dateRangeLabel } from "@/lib/schedule/format";

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/** 4 → "four" (up to ten, then digits). `capitalize` → "Four". */
export function numberWord(n: number, options: { capitalize?: boolean } = {}): string {
  const word = NUMBER_WORDS[n] ?? String(n);
  return options.capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}

/** Two-digit index: 4 → "04". */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Entries that are actually happening (canceled entries never count toward totals). */
export function liveEntries(entries: ScheduleEntry[]): ScheduleEntry[] {
  return entries.filter((e) => e.status !== "canceled");
}

/** "Mon Sep 28 – Sat Oct 3" for the calendar's first and last day, or null when empty. */
export function weekRange(days: ISODate[]): string | null {
  if (!days.length) return null;
  return dateRangeLabel(days[0], days[days.length - 1]);
}

/**
 * Featured events after office hours (Dan Caruso's fireside chat, then the Sep 29 panel), in
 * priority order. Office hours have their own hero treatment on the home page.
 */
export function homeFeaturedEvents(entries: ScheduleEntry[]): ScheduleEntry[] {
  return featuredEntries(entries).filter((e) => e.kind === "event");
}

/**
 * A short, chronological preview of the rest of the calendar: events that aren't featured above
 * (not office hours, not the ranked events), Founders picks first when trimming to `limit`.
 */
export function agendaPreviewEntries(entries: ScheduleEntry[], limit = 5): ScheduleEntry[] {
  const pool = liveEntries(entries).filter((e) => e.kind === "event" && e.featuredRank === null);
  const picks = pool.filter((e) => e.foundersPick);
  const rest = pool.filter((e) => !e.foundersPick);
  return [...picks, ...rest].slice(0, Math.max(0, limit)).sort(compareEntries);
}

/** The display name of an entry in summaries: all office-hours windows read "Founders Office Hours". */
export function summaryTitle(entry: Pick<ScheduleEntry, "kind" | "title">): string {
  return entry.kind === "office-hours" ? "Founders Office Hours" : entry.title;
}

export interface LabelSummary {
  /** Listings on the calendar with this label (canceled excluded). */
  count: number;
  /** Distinct titles, strongest priority first then chronological (office hours collapse to one). */
  titles: string[];
}

function summarize(list: ScheduleEntry[]): LabelSummary {
  const ordered = [...list].sort(
    (a, b) => (a.featuredRank ?? Number.MAX_SAFE_INTEGER) - (b.featuredRank ?? Number.MAX_SAFE_INTEGER) || compareEntries(a, b),
  );
  return { count: list.length, titles: [...new Set(ordered.map(summaryTitle))] };
}

/** Per-involvement listing counts and titles, in INVOLVEMENT_ORDER (hosted → cohosted → supported → week). */
export function involvementSummaries(entries: ScheduleEntry[]): ({ involvement: Involvement } & LabelSummary)[] {
  const live = liveEntries(entries);
  return INVOLVEMENT_ORDER.map((involvement) => ({
    involvement,
    ...summarize(live.filter((e) => e.involvement === involvement)),
  }));
}

/** Related events (outside the official program). */
export function relatedSummary(entries: ScheduleEntry[]): LabelSummary {
  return summarize(liveEntries(entries).filter((e) => e.related));
}

/** Listings Founders hosts, co-hosts or supports (office hours included). */
export function foundersListingCount(entries: ScheduleEntry[]): number {
  return liveEntries(entries).filter(
    (e) => e.involvement === "hosted" || e.involvement === "cohosted" || e.involvement === "supported",
  ).length;
}

/** "Founders Office Hours", "X" and 6 more → a short sentence fragment with a remainder. */
export function titlesPreview(titles: string[], max = 2): { shown: string[]; more: number } {
  return { shown: titles.slice(0, max), more: Math.max(0, titles.length - max) };
}

/** First names of mentors still scheduling ("Vik", "Ron"), in content order. */
export function schedulingFirstNames(mentors: Pick<Mentor, "firstName" | "availability" | "slots">[]): string[] {
  return mentors.filter((m) => schedulingStatus(m) === "in-progress").map((m) => m.firstName);
}

/** Mentor names for metadata copy, e.g. "Patrick Haddox, Arnav Mishra, … and Ron Lewis". */
export function mentorNamesText(mentors: Pick<Mentor, "name">[]): string {
  const names = mentors.map((m) => m.name);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
