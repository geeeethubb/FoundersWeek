/**
 * Text models for the generated social images (OpenGraph + Twitter cards). Pure — every string is
 * derived from public content (mentors from `getMentors()`, entries from `getScheduleEntries()`),
 * so the images never state anything the site doesn't. Rendering lives in ./cards.tsx.
 *
 * - `siteCardModel`: the site default — Founders Office Hours first.
 * - `mentorCardModel`: name, verified role · organization, availability state, CTA wording.
 * - `eventCardModel`: date, priority numeral, involvement/status badges, title, time and place.
 *   Events never carry an application CTA (the Dan Caruso fireside chat in particular); only
 *   office-hours entries point to the application.
 */
import type { AvailabilityKind } from "@/components/ui/status";
import { initialsOf } from "@/components/ui/portrait";
import type { ISODate, Mentor, SiteSettings } from "@/content/types";
import { INTEREST_COPY, PRIMARY_CTA_LABEL, schedulingStatus } from "@/lib/mentors";
import { availabilityHeadline, mentorAffiliation, mentorCta, mentorIndexCaption } from "@/lib/mentors-view";
import {
  EVENT_TYPE_LABELS,
  INVOLVEMENT_LABELS,
  RELATED_EVENT_LABEL,
  STATUS_LABELS,
  type ScheduleEntry,
} from "@/lib/schedule/entries";
import { dateRangeLabel, entryTimeText, locationSummary, rankNumeral } from "@/lib/schedule/format";
import { sessionCountLabel } from "@/lib/schedule/program";
import { dateParts, formatDate } from "@/lib/time";

export const OG_SIZE = { width: 1200, height: 630 } as const;

export type OgTone = "accent-solid" | "accent" | "muted" | "warning";
export type OgLine = "solid" | "dashed" | "dotted";
export interface OgBadge {
  label: string;
  tone: OgTone;
  line: OgLine;
}

export interface OgPortrait {
  id: string;
  name: string;
  initials: string;
  /** "01 / 04" */
  caption: string;
}

/** Top-right mono stamp shared by the cards: "Founders Week 2026 · UIUC · Mon Sep 28 – Sat Oct 3". */
export function weekStamp(site: SiteSettings, days: ISODate[]): string {
  const range = days.length ? dateRangeLabel(days[0], days[days.length - 1]) : null;
  return [`${site.week.name} ${site.week.year}`, "UIUC", range].filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
// Site default
// ---------------------------------------------------------------------------

export interface SiteCardModel {
  stamp: string;
  kicker: string;
  /** Headline in two parts: wide sans, then the serif-italic accent. */
  headline: string;
  headlineAccent: string;
  sub: string;
  portraits: OgPortrait[];
  meta: string;
  cta: string;
  alt: string;
}

function namesText(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export function siteCardModel(site: SiteSettings, mentors: Mentor[], days: ISODate[]): SiteCardModel {
  const count = mentors.length;
  const firstNames = namesText(mentors.map((m) => m.firstName));
  const range = days.length ? dateRangeLabel(days[0], days[days.length - 1]) : null;
  return {
    stamp: weekStamp(site, days),
    kicker: "Founders Office Hours",
    headline: "Office hours with founders",
    headlineAccent: "& operators.",
    sub: count
      ? `Meet ${firstNames} one-on-one during ${site.week.name}. One application covers every mentor.`
      : `One-on-one office hours during ${site.week.name}.`,
    portraits: mentors.map((m, i) => ({
      id: m.id,
      name: m.name,
      initials: initialsOf(m.name),
      caption: mentorIndexCaption(i, count),
    })),
    meta: [count ? `${count} ${count === 1 ? "mentor" : "mentors"}` : null, "One application", range]
      .filter(Boolean)
      .join(" · "),
    cta: PRIMARY_CTA_LABEL,
    alt: count
      ? `Founders Office Hours at ${site.week.name} (UIUC): meet ${namesText(mentors.map((m) => m.name))} one-on-one. ${PRIMARY_CTA_LABEL}.`
      : `Founders Office Hours at ${site.week.name} (UIUC). ${PRIMARY_CTA_LABEL}.`,
  };
}

// ---------------------------------------------------------------------------
// Mentor
// ---------------------------------------------------------------------------

export interface MentorCardModel {
  stamp: string;
  portrait: OgPortrait;
  name: string;
  /** Verified "Role · Organization" (either part may be missing), or null. */
  roleLine: string | null;
  availability: { kind: AvailabilityKind; label: string; value: string };
  cta: string;
  alt: string;
}

export function mentorCardModel(
  mentor: Mentor,
  index: number,
  total: number,
  options: { applicationsOpen: boolean } = { applicationsOpen: true },
): MentorCardModel {
  const h = availabilityHeadline(mentor);
  const inProgress = schedulingStatus(mentor) === "in-progress";
  const cta = mentorCta(mentor, options);
  const roleLine = [mentor.role, mentor.company].filter(Boolean).join(" · ") || null;
  const value = inProgress ? INTEREST_COPY.followUp : h.date ? `${h.date} · ${h.time}` : h.time;
  const affiliation = mentorAffiliation(mentor);
  return {
    stamp: `Founders Office Hours${index >= 0 ? ` · ${mentorIndexCaption(index, total)}` : ""}`,
    portrait: {
      id: mentor.id,
      name: mentor.name,
      initials: initialsOf(mentor.name),
      caption: index >= 0 ? mentorIndexCaption(index, total) : "",
    },
    name: mentor.name,
    roleLine,
    availability: { kind: h.kind, label: h.label, value },
    cta: cta.href ? cta.label : "Founders Office Hours",
    alt: `Founders Office Hours with ${mentor.name}${affiliation ? `, ${affiliation}` : ""}. ${h.label}${
      h.date ? `: ${h.date}, ${h.time}` : ""
    }.`,
  };
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export interface EventCardModel {
  stamp: string;
  weekday: string;
  day: string;
  month: string;
  /** "02 — Featured" for Founders' priorities, else null. */
  rank: string | null;
  badges: OgBadge[];
  title: string;
  /** "6:00–8:00 PM CT" · "Time forthcoming" */
  when: string;
  where: string;
  /** Line style for the date rule: solid confirmed, dashed planned/window, dotted forthcoming. */
  certainty: OgLine;
  /** Verified speakers, e.g. "Dan Caruso · Founder, Caruso Ventures"; null when none are listed. */
  people: string | null;
  /** e.g. "Panel · 3 sessions"; null when there's nothing useful to add. */
  detail: string | null;
  /** Only office-hours entries point to the application. */
  cta: string | null;
  alt: string;
}

const INVOLVEMENT_TONE = { hosted: "accent-solid", cohosted: "accent", supported: "accent", week: "muted" } as const;

export function eventCardModel(entry: ScheduleEntry, site: SiteSettings): EventCardModel {
  const p = dateParts(entry.date);
  const isOfficeHours = entry.kind === "office-hours";
  const badges: OgBadge[] = [];
  if (entry.involvement) {
    badges.push({ label: INVOLVEMENT_LABELS[entry.involvement], tone: INVOLVEMENT_TONE[entry.involvement], line: "solid" });
  }
  if (entry.related) badges.push({ label: RELATED_EVENT_LABEL, tone: "muted", line: "dashed" });
  if (!isOfficeHours && entry.status !== "confirmed") {
    badges.push({
      label: STATUS_LABELS[entry.status],
      tone: entry.status === "canceled" ? "muted" : "warning",
      line: entry.status === "tentative" ? "dotted" : entry.status === "canceled" ? "solid" : "dashed",
    });
  }

  const certainty: OgLine =
    entry.time.kind !== "exact" ? "dotted" : entry.status === "confirmed" || entry.status === "canceled" ? "solid" : "dashed";
  const when = entryTimeText(entry);
  const where = locationSummary(entry.location);
  const types = entry.types.map((t) => EVENT_TYPE_LABELS[t]).join(" · ");
  const detail = isOfficeHours
    ? "By application · Appointments are limited"
    : [types || null, entry.sessions.length ? sessionCountLabel(entry.sessions.length) : null].filter(Boolean).join(" · ") ||
      null;

  const people = entry.speakers.length
    ? entry.speakers
        .slice(0, 2)
        .map((sp) => (sp.title ? `${sp.name} · ${sp.title}` : sp.name))
        .join("  /  ") + (entry.speakers.length > 2 ? ` +${entry.speakers.length - 2}` : "")
    : null;

  return {
    stamp: `${site.week.name} ${site.week.year} · Calendar`,
    weekday: p.weekdayShort,
    day: p.dayPadded,
    month: p.monthShort,
    rank: entry.featuredRank !== null && entry.status !== "canceled" ? `${rankNumeral(entry.featuredRank)} — Featured` : null,
    badges,
    title: entry.title,
    when,
    where,
    certainty,
    people,
    detail,
    cta: isOfficeHours ? PRIMARY_CTA_LABEL : null,
    alt: `${entry.title} — ${formatDate(entry.date, "long")} · ${when} · ${where}. ${site.name}.`,
  };
}

/** Title size steps so long titles still fit in three lines. */
export function titleFontSize(title: string): number {
  if (title.length <= 28) return 76;
  if (title.length <= 44) return 64;
  if (title.length <= 64) return 54;
  return 46;
}
