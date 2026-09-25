/**
 * Text models for the generated social images (OpenGraph + Twitter cards). Pure — every string is
 * derived from public content (mentors from `getMentors()`, entries from `getScheduleEntries()`,
 * settings from `getSite()`), so the images never state anything the site doesn't. Rendering
 * lives in ./cards.tsx.
 *
 * - `siteCardModel`: the site default — Founders Office Hours, every mentor, "Apply for Office Hours".
 * - `mentorCardModel`: headshot, name, verified role and company, one availability line.
 * - `eventCardModel`: date, Founders involvement, title, time and place. Events never carry an
 *   application CTA (the Dan Caruso fireside chat in particular); only office-hours entries do.
 */
import {
  longDate,
  namesText,
  officialDates,
  placeText,
  previewAvailability,
  timeText,
} from "@/components/home/home-model";
import { initialsOf } from "@/components/ui/portrait";
import type { Involvement, Mentor, SiteSettings } from "@/content/types";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";
import { INVOLVEMENT_LABELS, mentorAffiliation, STATUS_LABELS, type ScheduleEntry } from "@/lib/schedule/entries";
import { dateParts } from "@/lib/time";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** Headline shared with the home page. */
export const OG_HEADLINE = "Meet the people building what’s next.";

export interface OgPerson {
  id: string;
  name: string;
  initials: string;
  /** Path under /public of the approved headshot, or null (initials are drawn instead). */
  headshot: string | null;
}

function person(mentor: Pick<Mentor, "id" | "name" | "headshot">): OgPerson {
  return {
    id: mentor.id,
    name: mentor.name,
    initials: initialsOf(mentor.name),
    headshot: mentor.headshot?.src ?? null,
  };
}

/** "Founders Week 2026" — the small label next to the logo. */
export function weekLabel(site: Pick<SiteSettings, "week">): string {
  return `${site.week.name} ${site.week.year}`;
}

// ---------------------------------------------------------------------------
// Site default
// ---------------------------------------------------------------------------

export interface SiteCardModel {
  label: string;
  kicker: string;
  headline: string;
  /** "Sept 30 – Oct 3 · University of Illinois Urbana-Champaign" */
  sub: string;
  people: OgPerson[];
  /** "Patrick, Arnav, Vik, Elliott, Ron and Rishab" */
  peopleLine: string;
  /** "Apply for Office Hours" while the application is open, else null. */
  cta: string | null;
  alt: string;
}

export function siteCardModel(site: SiteSettings, mentors: Mentor[]): SiteCardModel {
  const dates = officialDates(site);
  const cta = site.applications.open ? PRIMARY_CTA_LABEL : null;
  const where = `${site.week.name}${dates ? ` (${dates})` : ""} at UIUC`;
  return {
    label: weekLabel(site),
    kicker: "Founders Office Hours",
    headline: OG_HEADLINE,
    sub: [dates, site.university].filter(Boolean).join(" · "),
    people: mentors.map(person),
    peopleLine: namesText(mentors.map((m) => m.firstName)),
    cta,
    alt: mentors.length
      ? `Founders Office Hours during ${where}: meet ${namesText(mentors.map((m) => m.name))}.${cta ? ` ${cta}.` : ""}`
      : `Founders Office Hours during ${where}.${cta ? ` ${cta}.` : ""}`,
  };
}

// ---------------------------------------------------------------------------
// Mentor
// ---------------------------------------------------------------------------

export interface MentorCardModel {
  label: string;
  person: OgPerson;
  name: string;
  /** Verified role and company (either may be missing). */
  role: string | null;
  company: string | null;
  /** "Thu, Oct 1 · 10:00–11:30 AM CT" (a window, never a booking; "+ 2 more" when there are more) or "Scheduling in progress". */
  availability: { known: boolean; text: string };
  /** "Apply for Office Hours" while the application is open and the mentor is selectable. */
  cta: string | null;
  alt: string;
}

export function mentorCardModel(mentor: Mentor, site: SiteSettings): MentorCardModel {
  const a = previewAvailability(mentor);
  // Like the home preview: the first window, then how many more ("+ 2 more").
  const more = a.known && a.more > 0 ? a.more : 0;
  const text = a.known ? `${a.date} · ${a.time}${more ? ` + ${more} more` : ""}` : a.label;
  const affiliation = mentorAffiliation(mentor);
  const cta = site.applications.open && mentor.acceptingApplications ? PRIMARY_CTA_LABEL : null;
  return {
    label: `${weekLabel(site)} · Office Hours`,
    person: person(mentor),
    name: mentor.name,
    role: mentor.role,
    company: mentor.company,
    availability: { known: a.known, text },
    cta,
    alt: `Founders Office Hours with ${mentor.name}${affiliation ? `, ${affiliation}` : ""}. ${
      a.known ? `Available ${a.date}, ${a.time}${more ? `, and ${more} more ${more === 1 ? "time" : "times"}` : ""}.` : `${a.label}.`
    }`,
  };
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

export type OgInvolvementTone = "solid" | "soft" | "neutral";

export interface EventCardModel {
  label: string;
  /** "Monday" */
  weekday: string;
  /** "28" */
  day: string;
  /** "September" */
  month: string;
  involvement: { label: string; tone: OgInvolvementTone } | null;
  /** "Canceled", "Planned"… for events that aren't confirmed; null otherwise. */
  status: string | null;
  title: string;
  /** Up to two verified speakers (name and stated title); empty when none are listed. */
  people: { name: string; title: string | null }[];
  /** Verified speakers beyond the two shown. */
  morePeople: number;
  /** "4:00 PM CT" · "Time to be announced" */
  when: string;
  /** "Beckman Institute, Auditorium (Room 1025)" · "Location to be announced" */
  where: string;
  /** Only office-hours entries point to the application. */
  cta: string | null;
  alt: string;
}

const INVOLVEMENT_TONE: Record<Involvement, OgInvolvementTone> = {
  hosted: "solid",
  cohosted: "soft",
  supported: "soft",
  week: "neutral",
};

export function eventCardModel(entry: ScheduleEntry, site: SiteSettings): EventCardModel {
  const p = dateParts(entry.date);
  const isOfficeHours = entry.kind === "office-hours";
  const when = timeText(entry.time);
  const where = placeText(entry.location);
  const people = entry.speakers.slice(0, 2).map((s) => ({ name: s.name, title: s.title ?? null }));
  const status = !isOfficeHours && entry.status !== "confirmed" ? STATUS_LABELS[entry.status] : null;
  const cta = isOfficeHours && site.applications.open ? PRIMARY_CTA_LABEL : null;

  return {
    label: `${weekLabel(site)} · Calendar`,
    weekday: p.weekdayLong,
    day: String(p.day),
    month: p.monthLong,
    involvement: entry.involvement
      ? { label: INVOLVEMENT_LABELS[entry.involvement], tone: INVOLVEMENT_TONE[entry.involvement] }
      : null,
    status,
    title: entry.title,
    people,
    morePeople: Math.max(0, entry.speakers.length - 2),
    when,
    where,
    cta,
    alt: `${entry.title}${status ? ` (${status.toLowerCase()})` : ""}: ${longDate(entry.date)}, ${when}, ${where}. ${site.name}.`,
  };
}

/** Title size steps so long titles still fit in three lines. */
export function titleFontSize(title: string): number {
  if (title.length <= 28) return 72;
  if (title.length <= 44) return 62;
  if (title.length <= 64) return 52;
  return 44;
}
