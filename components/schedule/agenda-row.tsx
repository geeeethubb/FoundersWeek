/**
 * One agenda row: time, title (the row's primary link, stretched over the whole row), place,
 * summary, labels, official links — and for office hours the mentor's photo, name (→ profile) and
 * verified affiliation plus "Apply to meet <name>", which opens the application on the Office Hours
 * page (/office-hours?mentor=…&window=…#apply). Program blocks (entries with `sessions`) add the
 * office-hours mentors on stage and an expandable sub-session list.
 *
 * Only office hours ever get an application CTA — never Dan Caruso's fireside chat or any other
 * event.
 *
 * Props
 * - `entry`: the ScheduleEntry.
 * - `headshots`: mentor photos by id (office-hours byline, mentors on stage). Optional — without it
 *   portraits fall back to initials.
 * - `overlapsWith`: other entries this one clashes with (rendered as "Overlaps with …").
 * - `headingLevel`: heading tag for the title (default "h3"; day headers are h2).
 * - `programOpen`: whether a program block starts expanded (see `defaultProgramOpen`).
 * - `sessionMatches`: indexes of sub-sessions matching the current search.
 *
 * Keyboard: the title link, mentor links, external links, the sessions toggle and the optional CTA
 * are the focusable elements; none is nested in another (the title's hit area is a pseudo-element,
 * and everything else sits above it with `relative z-10`).
 */
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { AlertIcon, ArrowRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { mentorAffiliation, type ScheduleEntry } from "@/lib/schedule/entries";
import type { OverlapRef } from "@/lib/schedule/filter";
import { agendaTime, locationSummary } from "@/lib/schedule/format";
import type { MentorHeadshots } from "@/lib/schedule/headshots";
import { hasProgram, mentorProfileHref } from "@/lib/schedule/program";
import { eventHref } from "@/lib/schedule/url";
import { cn } from "@/lib/cn";
import { EntryBadges } from "./entry-badges";
import { EntryLinks } from "./entry-links";
import { ProgramBlock } from "./program-block";
import { ProgramMentorsStrip } from "./program-sessions";

export function AgendaRow({
  entry,
  headshots = {},
  overlapsWith = [],
  headingLevel: Heading = "h3",
  programOpen = false,
  sessionMatches = [],
}: {
  entry: ScheduleEntry;
  headshots?: MentorHeadshots;
  overlapsWith?: OverlapRef[];
  headingLevel?: "h2" | "h3" | "h4";
  programOpen?: boolean;
  sessionMatches?: number[];
}) {
  const canceled = entry.status === "canceled";
  const cta = entry.kind === "office-hours" && entry.registration?.internal && !canceled ? entry.registration : null;
  const time = agendaTime(entry);
  const place = locationSummary(entry.location);

  return (
    <article className="group relative isolate grid gap-x-8 gap-y-2 py-6 md:grid-cols-[8rem_minmax(0,1fr)] md:py-7 lg:grid-cols-[8rem_minmax(0,1fr)_auto]">
      {/* Hover/focus wash, flush with the day's hairlines and a little wider than the text. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -inset-x-3 -z-10 rounded-md bg-surface-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 md:-inset-x-4"
      />

      <p className="flex flex-wrap items-baseline gap-x-1.5 tabular md:flex-col md:gap-0.5">
        {time.start ? (
          <time
            dateTime={`${entry.date}T${time.start}`}
            className={cn("text-[0.9375rem] font-semibold text-text md:text-base", canceled && "text-text-muted line-through")}
          >
            {time.main}
          </time>
        ) : (
          <span className="text-[0.9375rem] font-semibold text-text md:text-base">{time.main}</span>
        )}
        {time.sub ? <span className={cn("text-sm text-text-subtle", canceled && "line-through")}>{time.sub}</span> : null}
      </p>

      <div className="min-w-0">
        <Heading
          className={cn(
            "text-lg font-semibold leading-snug tracking-tight md:text-xl",
            canceled ? "text-text-muted" : "text-text",
          )}
        >
          <Link
            href={eventHref(entry.id)}
            className={cn(
              "rounded-xs decoration-1 underline-offset-4 transition-colors duration-150",
              "after:absolute after:inset-0 after:content-['']",
              canceled ? "line-through decoration-danger/60" : "decoration-text-subtle group-hover:underline",
            )}
          >
            {entry.title}
          </Link>
        </Heading>

        <p className="mt-1 text-sm text-text-muted">{place}</p>

        {entry.kind === "office-hours" && entry.mentor ? (
          <MentorByline mentor={entry.mentor} headshot={headshots[entry.mentor.id]} />
        ) : (
          <p className={cn("mt-3 max-w-[65ch] text-[0.9375rem] leading-relaxed", canceled ? "text-text-subtle" : "text-text-muted")}>
            {canceled && entry.statusNote ? `${entry.statusNote} ` : null}
            {entry.summary}
          </p>
        )}

        <EntryBadges entry={entry} showWeek={false} className="mt-3" />

        {entry.links.length && !canceled ? <EntryLinks links={entry.links} className="mt-2" /> : null}

        {overlapsWith.length ? (
          <p className="mt-3 flex items-start gap-2 text-sm leading-snug text-warning">
            <AlertIcon className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Overlaps with{" "}
              {overlapsWith.map((o, i) => (
                <span key={o.id}>
                  {i > 0 ? (i === overlapsWith.length - 1 ? " and " : ", ") : null}
                  <span className="font-medium">{o.title}</span>
                </span>
              ))}
            </span>
          </p>
        ) : null}

        {hasProgram(entry) && !canceled ? (
          <>
            <ProgramMentorsStrip entry={entry} headshots={headshots} className="mt-4" />
            <ProgramBlock entry={entry} defaultOpen={programOpen} matches={sessionMatches} />
          </>
        ) : null}
      </div>

      {cta ? (
        <div className="relative z-10 mt-2 md:col-start-2 lg:col-start-3 lg:row-start-1 lg:mt-0 lg:self-start">
          <ButtonLink href={cta.url} variant="secondary" className="w-full min-h-11 sm:w-auto">
            {cta.label}
            <ArrowRightIcon className="size-4" />
          </ButtonLink>
        </div>
      ) : null}
    </article>
  );
}

/** Photo + name (→ mentor profile) + verified affiliation, for office-hours rows. */
function MentorByline({
  mentor,
  headshot,
}: {
  mentor: NonNullable<ScheduleEntry["mentor"]>;
  headshot?: MentorHeadshots[string];
}) {
  const affiliation = mentorAffiliation(mentor);
  return (
    <Link
      href={mentorProfileHref(mentor.id)}
      className="group/byline relative z-10 mt-4 flex w-fit max-w-full items-center gap-3 rounded-sm pr-1"
    >
      <MentorPortrait id={mentor.id} name={mentor.name} headshot={headshot} size="sm" />
      <span className="min-w-0 leading-snug">
        <span className="block font-medium text-text underline decoration-line-strong underline-offset-4 transition-colors group-hover/byline:decoration-accent">
          {mentor.name}
        </span>
        {affiliation ? <span className="block text-sm text-text-muted">{affiliation}</span> : null}
        <span className="sr-only"> (mentor profile)</span>
      </span>
    </Link>
  );
}
