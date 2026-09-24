/**
 * The calendar's "Featured" band — Founders' priorities in order, above the chronological agenda:
 *   01  Founders Office Hours — all four mentors (including those still scheduling), each with
 *       their portrait, verified affiliation and published availability, plus the primary
 *       "Apply for Office Hours" CTA (→ /office-hours#apply) and a link to /office-hours
 *   02  Dan Caruso — Fireside Chat (Supported by Founders; information only — no CTA)
 *   03  How to Make $10K/Month in College (Co-hosted by Founders; official "Event information")
 * Every item also appears in its chronological place in the agenda below, with the same numeral.
 *
 * Layout: from `lg`, office hours take 7/12 and the two events stack in the remaining 5/12; below
 * `lg` office hours span the width and the events sit side by side (from `sm`) or stack (mobile).
 *
 * Props
 * - `entries`: all public ScheduleEntry[] (featured events are picked with `featuredEntries()`).
 * - `mentors`: `officeHoursMentorSummaries(getMentors())` — every public mentor, in order.
 * - `className`: extra classes for the <section>.
 *
 * Server component (no hooks).
 */
import Link from "next/link";
import { DemoBadge, InvolvementBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { MentorPortrait } from "@/components/ui/portrait";
import { Container } from "@/components/ui/primitives";
import { AVAILABILITY_BORDER_CLASSES, AVAILABILITY_KIND_LABELS } from "@/components/ui/status";
import { APPLICATION_COPY } from "@/lib/applications/constants";
import { PRIMARY_CTA_LABEL } from "@/lib/mentors";
import { applyHref, OFFICE_HOURS_FEATURED_RANK, type ScheduleEntry } from "@/lib/schedule/entries";
import { schedulingMentorNames, type OfficeHoursMentorSummary } from "@/lib/schedule/featured";
import { listText, rankNumeral } from "@/lib/schedule/format";
import { cn } from "@/lib/cn";
import { FeaturedEvents } from "./featured-events";

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six"];

export function FeaturedBand({
  entries,
  mentors,
  className,
}: {
  entries: ScheduleEntry[];
  mentors: OfficeHoursMentorSummary[];
  className?: string;
}) {
  return (
    <section aria-labelledby="featured-heading" className={cn("border-b border-line", className)}>
      <Container className="pb-4 pt-8 md:pb-8 md:pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="featured-heading" className="mono-label flex items-center gap-2 text-paper">
            <span aria-hidden className="size-1.5 rotate-45 bg-accent" />
            Featured
          </h2>
          <p className="mono-label text-paper-subtle">In priority order · also listed by date below</p>
        </div>

        <div className="mt-4 grid border-t border-line-strong lg:grid-cols-12">
          <OfficeHoursFeature mentors={mentors} className="lg:col-span-7" />
          <FeaturedEvents entries={entries} layout="adaptive" className="lg:col-span-5 lg:pl-8" />
        </div>
      </Container>
    </section>
  );
}

function OfficeHoursFeature({ mentors, className }: { mentors: OfficeHoursMentorSummary[]; className?: string }) {
  const scheduling = schedulingMentorNames(mentors);
  const count = COUNT_WORDS[mentors.length] ?? String(mentors.length);
  return (
    <article
      aria-labelledby="featured-office-hours"
      className={cn(
        "relative -mx-5 border-b border-line bg-ink-850 px-5 py-6 sm:mx-0 sm:px-7 sm:py-7 lg:border-b-0 lg:border-r",
        className,
      )}
    >
      {/* Registration ticks — the portrait frame language, scaled up. */}
      <span aria-hidden className="absolute left-1.5 top-1.5 size-2.5 border-l border-t border-accent/70" />
      <span aria-hidden className="absolute bottom-1.5 right-1.5 size-2.5 border-b border-r border-accent/70" />

      <p className="flex items-center gap-3 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.12em]">
        <span className="text-accent tabular">{rankNumeral(OFFICE_HOURS_FEATURED_RANK)}</span>
        <span aria-hidden className="h-px w-6 bg-line-strong" />
        <InvolvementBadge involvement="hosted" />
      </p>

      <h3
        id="featured-office-hours"
        className="mt-4 font-wide text-[1.75rem] font-bold leading-none tracking-[-0.03em] text-paper sm:text-[2.125rem]"
      >
        <Link href="/office-hours" className="underline-offset-[6px] decoration-1 hover:underline hover:decoration-paper/40">
          Founders Office Hours
        </Link>
      </h3>
      <p className="mt-3 max-w-[56ch] text-[0.9375rem] leading-relaxed text-paper-muted">
        One-on-one time with this week’s {count} {mentors.length === 1 ? "mentor" : "mentors"}. By application —
        appointments are limited.
        {scheduling.length
          ? ` ${listText(scheduling)} ${scheduling.length === 1 ? "is" : "are"} still scheduling; you can express interest in the same application.`
          : null}
      </p>

      <ul className="mt-5 grid gap-x-7 border-t border-line sm:grid-cols-2">
        {mentors.map((m) => (
          <li key={m.id} className="flex items-start gap-4 border-b border-line py-4">
            <MentorPortrait id={m.id} name={m.name} headshot={m.headshot} size="md" />
            <div className="min-w-0 flex-1">
              <p>
                <Link
                  href={m.profileHref}
                  className="text-[0.9375rem] font-semibold leading-snug text-paper underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-accent"
                >
                  {m.name}
                </Link>
              </p>
              {m.affiliation ? (
                <p className="mt-0.5 text-[0.8125rem] leading-snug text-paper-muted">{m.affiliation}</p>
              ) : null}
              {m.demo ? <DemoBadge className="mt-1.5" /> : null}
              <div
                className={cn(
                  "mt-2 border-l-2 pl-2.5 font-mono text-[0.75rem] leading-[1.35] tabular",
                  AVAILABILITY_BORDER_CLASSES[m.availability],
                )}
              >
                {m.whenDay && m.whenTime ? (
                  <>
                    <p className="uppercase tracking-[0.06em] text-paper-muted">{m.whenDay}</p>
                    <p className="text-paper">
                      {m.whenTime}
                      {m.more ? <span className="text-paper-muted"> · +{m.more} more</span> : null}
                    </p>
                  </>
                ) : (
                  <p className="text-paper-muted">{AVAILABILITY_KIND_LABELS["in-progress"]}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <ButtonLink href={applyHref()} size="lg" className="w-full sm:w-auto">
          {PRIMARY_CTA_LABEL}
          <ArrowRightIcon className="size-4" />
        </ButtonLink>
        <Link
          href="/office-hours"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-paper-muted transition-colors hover:text-paper"
        >
          Meet the mentors
          <ArrowRightIcon className="size-4" />
        </Link>
      </div>
      <p className="mt-3 text-[0.8125rem] text-paper-subtle">{APPLICATION_COPY.noReservation}</p>
    </article>
  );
}
