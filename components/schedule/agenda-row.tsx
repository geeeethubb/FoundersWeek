/**
 * One agenda row: time gutter, badges, title (the row's primary link, stretched over the whole
 * row), meta line, summary, official links, and — for office hours — a mentor byline (portrait,
 * name → profile, verified affiliation) and the "Apply to meet <name>" CTA. Program blocks
 * (entries with `sessions`) add the office-hours mentors on stage and an expandable sub-session
 * timeline.
 *
 * Featured entries (Founders' priorities) keep their chronological position but get an accent
 * treatment: an orange certainty rule with their priority numeral in the gutter, on a raised
 * ink surface (the same surface as the Featured band's office-hours card) that runs flush with the
 * day's hairlines. Only office hours ever get an application
 * CTA — never Dan Caruso's fireside chat or any other event.
 *
 * Expects to sit in an agenda <li> with `pl-4 md:pl-5` (the overlap-bracket lane); the wash
 * extends back over that lane so it aligns with the day header rule.
 *
 * Props
 * - `entry`: the ScheduleEntry.
 * - `overlapsWith`: other entries this one clashes with (rendered as "Overlaps with …").
 * - `headingLevel`: heading tag for the title (default "h3"; day headers are h2).
 * - `programOpen`: whether a program block starts expanded (see `defaultProgramOpen`).
 * - `sessionMatches`: indexes of sub-sessions matching the current search.
 *
 * Keyboard: the title link, the mentor links, external links, the sessions toggle and the
 * optional CTA are the focusable elements; none is nested in another (the title's hit area is a pseudo-element, and
 * everything else sits above it with `relative z-10`).
 */
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { AlertIcon, ArrowRightIcon, MapPinIcon, VideoIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { EVENT_TYPE_LABELS, mentorAffiliation, type ScheduleEntry } from "@/lib/schedule/entries";
import type { OverlapRef } from "@/lib/schedule/filter";
import { locationSummary } from "@/lib/schedule/format";
import { hasProgram, mentorProfileHref } from "@/lib/schedule/program";
import { eventHref } from "@/lib/schedule/url";
import { cn } from "@/lib/cn";
import { EntryBadges } from "./entry-badges";
import { EntryLinks } from "./entry-links";
import { ProgramBlock } from "./program-block";
import { ProgramMentorsStrip } from "./program-sessions";
import { isFeatured, TimeGutter } from "./time-gutter";

export function AgendaRow({
  entry,
  overlapsWith = [],
  headingLevel: Heading = "h3",
  programOpen = false,
  sessionMatches = [],
}: {
  entry: ScheduleEntry;
  overlapsWith?: OverlapRef[];
  headingLevel?: "h2" | "h3" | "h4";
  programOpen?: boolean;
  sessionMatches?: number[];
}) {
  const canceled = entry.status === "canceled";
  const featured = isFeatured(entry);
  const cta = entry.kind === "office-hours" && entry.registration?.internal ? entry.registration : null;
  // Office hours name their mentor in the byline below; events name their organizer (if known).
  const who = entry.kind === "office-hours" ? null : entry.organizer;
  const LocationIcon = entry.location.kind === "virtual" ? VideoIcon : MapPinIcon;

  return (
    <article
      className={cn(
        "group relative isolate grid gap-x-8 gap-y-3 py-6 md:grid-cols-[8.5rem_minmax(0,1fr)] lg:grid-cols-[9rem_minmax(0,1fr)_minmax(0,auto)]",
        // Wash flush with the day's hairlines (it reaches back over the <li>'s bracket lane):
        // a raised ink surface for featured rows, a paper tint on hover/focus for the rest. It sits
        // under the row's content (-z-10 inside the row's own stacking context, `isolate`).
        "before:pointer-events-none before:absolute before:inset-y-0 before:-left-4 before:right-0 before:-z-10 before:transition-[opacity,background-color] before:duration-200 md:before:-left-5",
        featured
          ? "before:bg-ink-850 hover:before:bg-ink-800 focus-within:before:bg-ink-800"
          : "before:bg-paper/[0.025] before:opacity-0 hover:before:opacity-100 focus-within:before:opacity-100",
      )}
    >
      <TimeGutter entry={entry} className="md:row-span-2 md:self-start" />

      <div className="min-w-0">
        <EntryBadges entry={entry} />
        <Heading
          className={cn(
            "mt-3 font-wide text-[1.1875rem] font-semibold leading-snug tracking-[-0.02em] sm:text-[1.3125rem]",
            canceled ? "text-paper-muted" : "text-paper",
          )}
        >
          <Link
            href={eventHref(entry.id)}
            className={cn(
              "rounded-xs decoration-1 underline-offset-[5px] transition-colors duration-150",
              "after:absolute after:inset-0 after:content-['']",
              canceled ? "line-through decoration-danger/60" : "hover:underline group-hover:decoration-paper/40 group-hover:underline",
            )}
          >
            {entry.title}
          </Link>
        </Heading>

        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-paper-muted">
          <span className="mono-label text-paper-subtle">
            {entry.types.map((t) => EVENT_TYPE_LABELS[t]).join(" · ")}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <LocationIcon className="size-3.5 shrink-0 text-paper-subtle" />
            <span>{locationSummary(entry.location)}</span>
          </span>
          {who ? <span>{who}</span> : null}
        </p>

        <p className={cn("mt-3 max-w-[68ch] text-[0.9375rem] leading-relaxed", canceled ? "text-paper-subtle" : "text-paper-muted")}>
          {canceled && entry.statusNote ? `${entry.statusNote} ` : null}
          {entry.summary}
        </p>

        {entry.kind === "office-hours" && entry.mentor ? <MentorByline mentor={entry.mentor} /> : null}

        {entry.links.length && !canceled ? <EntryLinks links={entry.links} className="mt-2" /> : null}

        {overlapsWith.length ? (
          <p className="mt-3 flex items-start gap-2 text-[0.8125rem] leading-snug text-warning">
            <AlertIcon className="mt-px size-3.5 shrink-0" />
            <span>
              Overlaps with{" "}
              {overlapsWith.map((o, i) => (
                <span key={o.id}>
                  {i > 0 ? (i === overlapsWith.length - 1 ? " and " : ", ") : null}
                  <span className="text-paper">{o.title}</span>
                </span>
              ))}
            </span>
          </p>
        ) : null}

        {hasProgram(entry) && !canceled ? (
          <>
            <ProgramMentorsStrip entry={entry} className="mt-4" />
            <ProgramBlock entry={entry} defaultOpen={programOpen} matches={sessionMatches} />
          </>
        ) : null}
      </div>

      {cta ? (
        <div className="relative z-10 md:col-start-2 lg:col-start-3 lg:row-start-1 lg:self-start lg:justify-self-end">
          <ButtonLink href={cta.url} variant="primary" className="w-full sm:w-auto">
            {cta.label}
            <ArrowRightIcon className="size-4" />
          </ButtonLink>
        </div>
      ) : (
        <div aria-hidden className="hidden lg:col-start-3 lg:row-start-1 lg:flex lg:justify-end lg:pt-1">
          <span className="inline-flex size-9 items-center justify-center rounded-sm border border-line text-paper-subtle transition-[color,border-color,transform] duration-200 group-hover:translate-x-0.5 group-hover:border-line-strong group-hover:text-paper">
            <ArrowRightIcon className="size-4" />
          </span>
        </div>
      )}
    </article>
  );
}

/** Portrait + name (→ mentor profile) + verified affiliation, for office-hours rows. */
function MentorByline({ mentor }: { mentor: NonNullable<ScheduleEntry["mentor"]> }) {
  const affiliation = mentorAffiliation(mentor);
  return (
    <Link
      href={mentorProfileHref(mentor.id)}
      className="group/byline relative z-10 mt-4 flex w-fit max-w-full items-center gap-3 rounded-xs pr-1"
    >
      <MentorPortrait id={mentor.id} name={mentor.name} size="sm" />
      <span className="min-w-0 text-sm leading-snug">
        <span className="block font-medium text-paper underline decoration-line-strong underline-offset-4 transition-colors group-hover/byline:decoration-accent">
          {mentor.name}
        </span>
        {affiliation ? <span className="block text-[0.8125rem] text-paper-muted">{affiliation}</span> : null}
        <span className="sr-only"> — mentor profile</span>
      </span>
    </Link>
  );
}
