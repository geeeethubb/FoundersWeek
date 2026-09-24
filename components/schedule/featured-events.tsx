/**
 * FeaturedEvents — featured cards for the ranked events after office hours, in priority order:
 * "Dan Caruso — Fireside Chat" (02, Supported by Founders), then "How to Make $10K/Month in
 * College" (03, Co-hosted by Founders). Used at the top of the calendar and on the home page.
 *
 * Each card: priority numeral + date (+ a decorative arrow), badges (involvement, related event,
 * status), title (the card's link to /schedule/<id>, stretched over the card), time and venue with
 * the certainty line style, summary, and official "Event information ↗" links where present.
 *
 * There is deliberately NO application, interest, waitlist or booking CTA on these cards —
 * in particular never for Dan Caruso's fireside chat. The only application on the site is
 * Founders Office Hours.
 *
 * Props
 * - `entries`: ScheduleEntry[] — pass all entries (e.g. `getScheduleEntries()`); the component
 *   picks featured events itself via `featuredEntries()` (office hours are excluded — they have
 *   their own feature).
 * - `layout`: "columns" (side by side from `sm`, hairline dividers; default), "stack" (one above the
 *   other), or "adaptive" (side by side from `sm`, stacked again from `lg` — for a narrow column
 *   next to another feature, as in the calendar's Featured band).
 * - `headingLevel`: tag for card titles, "h3" (default) or "h2"/"h4" to fit the page outline.
 * - `className`: extra classes for the <ol>.
 *
 * Server-friendly (no hooks). Renders nothing when there are no featured events.
 */
import Link from "next/link";
import { ArrowRightIcon, ClockIcon, MapPinIcon } from "@/components/ui/icons";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import { featuredEvents } from "@/lib/schedule/featured";
import { dayLabels, entryCertainty, entryTimeText, locationSummary, rankNumeral } from "@/lib/schedule/format";
import { eventHref } from "@/lib/schedule/url";
import { cn } from "@/lib/cn";
import { EntryBadges } from "./entry-badges";
import { EntryLinks } from "./entry-links";
import { CERTAINTY_BORDER } from "./time-gutter";

export interface FeaturedEventsProps {
  entries: ScheduleEntry[];
  layout?: "columns" | "stack" | "adaptive";
  headingLevel?: "h2" | "h3" | "h4";
  className?: string;
}

const LIST_CLASSES: Record<NonNullable<FeaturedEventsProps["layout"]>, string> = {
  columns: "grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0",
  stack: "divide-y divide-line",
  adaptive: "grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-1 lg:divide-x-0 lg:divide-y",
};

const ITEM_CLASSES: Record<NonNullable<FeaturedEventsProps["layout"]>, string> = {
  columns: "sm:px-6 sm:first:pl-0 sm:last:pr-0",
  stack: "",
  adaptive: "sm:px-6 sm:first:pl-0 sm:last:pr-0 lg:px-0",
};

export function FeaturedEvents({ entries, layout = "columns", headingLevel = "h3", className }: FeaturedEventsProps) {
  const featured = featuredEvents(entries);
  if (!featured.length) return null;
  return (
    <ol className={cn(LIST_CLASSES[layout], className)}>
      {featured.map((entry) => (
        <li key={entry.id} className={cn("flex", ITEM_CLASSES[layout])}>
          <FeaturedEventCard entry={entry} headingLevel={headingLevel} />
        </li>
      ))}
    </ol>
  );
}

export function FeaturedEventCard({
  entry,
  headingLevel: Heading = "h3",
}: {
  entry: ScheduleEntry;
  headingLevel?: "h2" | "h3" | "h4";
}) {
  const day = dayLabels(entry.date);
  const certainty = entryCertainty(entry);
  return (
    <article className="group relative flex w-full flex-col py-6">
      <p className="flex items-center gap-3 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.12em]">
        {entry.featuredRank !== null ? (
          <span className="text-accent tabular">{rankNumeral(entry.featuredRank)}</span>
        ) : null}
        <span aria-hidden className="h-px flex-1 bg-line-strong" />
        <time dateTime={entry.date} className="tabular text-paper-muted">
          {day.mono}
        </time>
        <span
          aria-hidden
          className="ml-1 inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-line text-paper-subtle transition-[color,border-color,transform] duration-200 group-hover:translate-x-0.5 group-hover:border-line-strong group-hover:text-paper"
        >
          <ArrowRightIcon className="size-3.5" />
        </span>
      </p>

      <EntryBadges entry={entry} showPick={false} className="mt-4" />

      <Heading className="mt-3 font-wide text-[1.25rem] font-semibold leading-[1.15] tracking-[-0.02em] text-paper sm:text-[1.375rem]">
        <Link
          href={eventHref(entry.id)}
          className="rounded-xs underline-offset-[5px] decoration-1 after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:decoration-paper/40"
        >
          {entry.title}
        </Link>
      </Heading>

      <dl
        className={cn(
          "mt-4 space-y-1.5 border-l-2 border-accent pl-3 font-mono text-[0.8125rem] tabular",
          CERTAINTY_BORDER[certainty],
        )}
      >
        <div>
          <dt className="sr-only">When</dt>
          <dd className="flex items-start gap-2 text-paper">
            <ClockIcon className="mt-0.5 size-3.5 shrink-0 text-paper-subtle" />
            <span>
              <span className="sr-only">{day.long}, </span>
              {entryTimeText(entry)}
            </span>
          </dd>
        </div>
        <div>
          <dt className="sr-only">Where</dt>
          <dd
            className={cn(
              "flex items-start gap-2",
              entry.location.kind === "tba" ? "text-paper-muted" : "text-paper",
            )}
          >
            <MapPinIcon className="mt-0.5 size-3.5 shrink-0 text-paper-subtle" />
            <span>{locationSummary(entry.location)}</span>
          </dd>
        </div>
      </dl>

      <p className="mt-4 max-w-[52ch] text-[0.9375rem] leading-relaxed text-paper-muted">{entry.summary}</p>

      {entry.links.length ? (
        <div className="mt-auto pt-3">
          <EntryLinks links={entry.links} />
        </div>
      ) : null}
    </article>
  );
}
