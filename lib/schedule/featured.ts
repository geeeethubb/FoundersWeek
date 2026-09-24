/**
 * Featured placement for promotional sections (top of the calendar, home page).
 *
 * Priority order comes from `featuredEntries()` (lib/schedule/entries.ts):
 *   1. Founders Office Hours (all generated office-hours entries share rank 1)
 *   2. Dan Caruso — Fireside Chat
 *   3. How to Make $10K/Month in College
 * The agenda itself always stays chronological; this only drives the featured band.
 *
 * Office hours are presented as ONE feature listing every public mentor — including mentors whose
 * scheduling is still in progress (they have no schedule entries yet, but must stay visible).
 */
import type { AvailabilityKind } from "@/components/ui/status";
import type { ISODate, Mentor } from "@/content/types";
import { mentorApplyHref, mentorCtaLabel, schedulingStatus, type SchedulingStatus } from "@/lib/mentors";
import { describeTime, formatDate, formatTimeRange, TZ_LABEL } from "@/lib/time";
import { featuredEntries, mentorAffiliation, type ScheduleEntry } from "./entries";
import { mentorProfileHref } from "./program";
import { eventHref } from "./url";

export interface FeaturedBand {
  /** Generated office-hours entries (rank 1), chronological. */
  officeHours: ScheduleEntry[];
  /** Featured events (rank 2+), in priority order. */
  events: ScheduleEntry[];
}

/** Split featured entries into the office-hours feature and the ranked events after it. */
export function featuredBand(entries: ScheduleEntry[]): FeaturedBand {
  const featured = featuredEntries(entries);
  return {
    officeHours: featured.filter((e) => e.kind === "office-hours"),
    events: featured.filter((e) => e.kind === "event"),
  };
}

/** Featured events (Dan Caruso, the Sep 29 panel…) in priority order. */
export function featuredEvents(entries: ScheduleEntry[]): ScheduleEntry[] {
  return featuredBand(entries).events;
}

export interface OfficeHoursMentorSummary {
  id: string;
  name: string;
  firstName: string;
  /** Verified role/company only, e.g. "CEO & Co-Founder, Samara Aerospace" or "Stakehouse". */
  affiliation: string | null;
  headshot: Mentor["headshot"];
  status: SchedulingStatus;
  /** How firm the published time is (drives line style); "in-progress" while scheduling. */
  availability: AvailabilityKind;
  /** "Thu, Oct 1 · 10:00–11:30 AM CT"; null while scheduling is in progress. */
  when: string | null;
  /** The same, split for two-line layouts: day "Thu, Oct 1" and time "10:00–11:30 AM CT". */
  whenDay: string | null;
  whenTime: string | null;
  /** Additional windows/slots beyond the one in `when`. */
  more: number;
  profileHref: string;
  /** Application link with this mentor preselected. */
  applyHref: string;
  /** "Apply to meet Patrick" or "Express interest". */
  ctaLabel: string;
  demo: boolean;
}

/** Every public mentor, in content order, with a one-line availability summary. Expects public mentors. */
export function officeHoursMentorSummaries(mentors: Mentor[]): OfficeHoursMentorSummary[] {
  return mentors.map((m) => {
    const status = schedulingStatus(m);
    const confirmed = m.slots.filter((s) => s.status === "confirmed");
    const slots = confirmed.length ? confirmed : m.slots;
    let availability: AvailabilityKind = "in-progress";
    let whenDay: string | null = null;
    let whenTime: string | null = null;
    let more = 0;
    if (slots.length) {
      const s = slots[0];
      availability = confirmed.length ? "confirmed" : "proposed";
      whenDay = formatDate(s.date, "short");
      whenTime = `${formatTimeRange(s.start, s.end)} ${TZ_LABEL}`;
      more = slots.length - 1;
    } else if (m.availability.length) {
      const w = m.availability[0];
      availability = w.time.kind === "exact" ? "window" : "window-approx";
      whenDay = formatDate(w.date, "short");
      whenTime = describeTime(w.time).label;
      more = m.availability.length - 1;
    }
    const when = whenDay && whenTime ? `${whenDay} · ${whenTime}` : null;
    return {
      id: m.id,
      name: m.name,
      firstName: m.firstName,
      affiliation: mentorAffiliation(m),
      headshot: m.headshot,
      status,
      availability,
      when,
      whenDay,
      whenTime,
      more,
      profileHref: mentorProfileHref(m.id),
      applyHref: mentorApplyHref(m.id),
      ctaLabel: mentorCtaLabel(m),
      demo: Boolean(m.demo),
    };
  });
}

/** First names of mentors whose scheduling is still in progress, in content order ("Vik", "Ron"). */
export function schedulingMentorNames(mentors: Pick<OfficeHoursMentorSummary, "firstName" | "status">[]): string[] {
  return mentors.filter((m) => m.status === "in-progress").map((m) => m.firstName);
}

export interface FeaturedDayMark {
  rank: number;
  /** "Office hours" for generated office-hours entries, otherwise the event title. */
  label: string;
  /** The Office Hours page for office hours; the event page otherwise. */
  href: string;
}

/**
 * Featured items on `date`, one per priority rank, in priority order — for day summaries like the
 * week strip ("01 Office hours" on Thursday, "02 Dan Caruso — Fireside Chat" on Monday).
 */
export function featuredDayMarks(entries: ScheduleEntry[], date: ISODate): FeaturedDayMark[] {
  const seen = new Set<number>();
  const out: FeaturedDayMark[] = [];
  for (const e of featuredEntries(entries)) {
    const rank = e.featuredRank!;
    if (e.date !== date || seen.has(rank)) continue;
    seen.add(rank);
    out.push({
      rank,
      label: e.kind === "office-hours" ? "Office hours" : e.title,
      href: e.kind === "office-hours" ? "/office-hours" : eventHref(e.id),
    });
  }
  return out;
}
