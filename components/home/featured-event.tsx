/**
 * HomeFeaturedEvents — the ranked events after office hours, in priority order, each as a wide
 * editorial row: priority numeral + date stamp · badges, title, summary (and the event's
 * informational callout, if any) · facts and links.
 *   02 Dan Caruso — Fireside Chat (Supported by Founders) — information only.
 *   03 How to Make $10K/Month in College (Co-hosted by Founders) — official "Event information".
 *
 * There is deliberately NO application, interest, waitlist or booking CTA on these rows — the only
 * application on the site is Founders Office Hours. Rows link to the event page, official links
 * (entry.links) and, when the time is confirmed, the event's .ics file.
 *
 * Props
 * - `entries`: featured events in priority order (`homeFeaturedEvents(getScheduleEntries())`).
 * Server component.
 */
import Link from "next/link";
import { EntryBadges } from "@/components/schedule/entry-badges";
import { EntryLinks } from "@/components/schedule/entry-links";
import { EventCallout } from "@/components/schedule/event-detail";
import { CERTAINTY_BORDER } from "@/components/schedule/time-gutter";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon, CalendarIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/primitives";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import {
  entryCertainty,
  entryTimeText,
  locationSummary,
  rankNumeral,
} from "@/lib/schedule/format";
import { eventHref } from "@/lib/schedule/url";
import { dateParts, formatDate } from "@/lib/time";
import { cn } from "@/lib/cn";

export function HomeFeaturedEvents({ entries }: { entries: ScheduleEntry[] }) {
  if (!entries.length) return null;
  const first = entries[0].featuredRank;
  const last = entries[entries.length - 1].featuredRank;
  return (
    <div className="border-b border-line">
      <Container className="pt-12 md:pt-16">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line-strong pb-3">
          <p className="mono-label flex items-center gap-2 text-paper">
            <span aria-hidden className="size-1.5 rotate-45 bg-accent" />
            Also featured this week
          </p>
          <p className="mono-label tabular text-paper-subtle">
            In priority order
            {first !== null && last !== null ? ` · ${rankNumeral(first)}–${rankNumeral(last)}` : null}
          </p>
        </div>
      </Container>
      <ol>
        {entries.map((entry, i) => (
          <li key={entry.id} className={cn(i > 0 && "border-t border-line")}>
            <FeaturedEventRow entry={entry} />
          </li>
        ))}
      </ol>
    </div>
  );
}

export function FeaturedEventRow({ entry }: { entry: ScheduleEntry }) {
  const p = dateParts(entry.date);
  const certainty = entryCertainty(entry);
  const headingId = `featured-${entry.id}`;
  const canCalendar = entry.calendar.available;
  const tbaPlace = entry.location.kind === "tba";

  return (
    <section aria-labelledby={headingId}>
      <Container className="grid gap-x-12 gap-y-7 py-10 md:py-14 lg:grid-cols-12">
        {/* Numeral + date stamp. Line style = certainty of the time. */}
        <div className="flex items-start gap-6 lg:col-span-3 lg:flex-col lg:gap-5">
          {entry.featuredRank !== null ? (
            <p className="font-mono text-[0.6875rem] font-medium uppercase leading-4 tracking-[0.12em] text-accent tabular lg:order-none">
              {rankNumeral(entry.featuredRank)}
              <span aria-hidden className="mx-2 inline-block h-px w-4 translate-y-[-3px] bg-accent/60" />
              Featured
            </p>
          ) : null}
          <p className={cn("order-first border-l-2 border-accent pl-4 lg:order-none", CERTAINTY_BORDER[certainty])}>
            <span className="mono-label block text-paper-muted">{p.weekdayLong}</span>
            <span className="mt-1 block font-wide text-[3.5rem] font-bold leading-[0.85] tracking-[-0.05em] text-paper tabular md:text-[4.5rem]">
              <time dateTime={entry.date}>{p.dayPadded}</time>
            </span>
            <span className="mono-label mt-2 block text-paper-subtle">
              {p.monthLong} {p.year}
            </span>
          </p>
        </div>

        <div className="min-w-0 lg:col-span-6">
          <EntryBadges entry={entry} showPick={false} />
          <h2
            id={headingId}
            className="mt-4 font-wide text-[1.875rem] font-bold leading-[1.02] tracking-[-0.035em] text-paper sm:text-[2.5rem] lg:text-[2.75rem]"
          >
            <Link
              href={eventHref(entry.id)}
              className="rounded-xs decoration-accent decoration-2 underline-offset-[6px] hover:underline"
            >
              {entry.title}
            </Link>
          </h2>
          <p className="mt-4 max-w-[58ch] text-base leading-relaxed text-paper-muted sm:text-lg">{entry.summary}</p>
          {entry.callout ? <EventCallout callout={entry.callout} className="mt-6 max-w-[60ch]" /> : null}
        </div>

        <div className="lg:col-span-3">
          <dl className="divide-y divide-line border-y border-line text-sm">
            <div className="py-3">
              <dt className="mono-label text-paper-subtle">When</dt>
              <dd className="mt-1 text-paper">
                <span className="block">{formatDate(entry.date, "long")}</span>
                <span
                  className={cn(
                    "mt-0.5 block font-mono text-[0.8125rem] tabular",
                    entry.time.kind === "tba" ? "text-paper-muted" : "text-paper",
                  )}
                >
                  {entryTimeText(entry)}
                </span>
              </dd>
            </div>
            <div className="py-3">
              <dt className="mono-label text-paper-subtle">Where</dt>
              <dd className={cn("mt-1", tbaPlace ? "text-paper-muted" : "text-paper")}>
                {locationSummary(entry.location)}
              </dd>
            </div>
            {entry.speakers.length ? (
              <div className="py-3">
                <dt className="mono-label text-paper-subtle">{entry.speakers.length === 1 ? "Speaker" : "Speakers"}</dt>
                <dd className="mt-1 space-y-1">
                  {entry.speakers.map((s) => (
                    <span key={s.name} className="block">
                      <span className="text-paper">{s.name}</span>
                      {s.title ? <span className="block text-[0.8125rem] text-paper-muted">{s.title}</span> : null}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-5 flex flex-col gap-2">
            <EntryLinks links={entry.links} variant="button" />
            <Link
              href={eventHref(entry.id)}
              className={buttonClasses({ variant: entry.links.length ? "ghost" : "secondary", className: "group/more w-full justify-between" })}
            >
              Event details
              <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/more:translate-x-0.5" />
            </Link>
            {canCalendar ? (
              <a
                href={`${eventHref(entry.id)}/calendar.ics`}
                className="inline-flex min-h-11 items-center gap-2 self-start rounded-xs text-[0.8125rem] text-paper-muted underline decoration-line-strong underline-offset-4 transition-colors hover:text-paper hover:decoration-paper/60"
              >
                <CalendarIcon className="size-3.5" />
                Add to calendar (.ics)
              </a>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
