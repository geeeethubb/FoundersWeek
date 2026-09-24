/**
 * AgendaPreview — a compact, hairline-divided list of schedule entries for the home page and the
 * event page's "Also on this day". Each row: (date and) time, title (the row's single link,
 * stretched over the row), place, and labels.
 *
 * Props
 * - `entries`: ScheduleEntry[] to show, in the order given (pass them chronologically; slice
 *   before passing — this component doesn't truncate).
 * - `showDate`: show the weekday/date above the time (default true; turn off for single-day lists).
 * - `headingLevel`: tag for entry titles, "h3" (default) or "h4", to fit the surrounding outline.
 * - `emptyMessage`: text shown when `entries` is empty (default: an honest "nothing yet" line).
 * - `className`: extra classes for the <ol>.
 *
 * Server-friendly (no hooks); safe to render from server or client components. No CTAs — rows
 * link to the event page (office-hours rows reach the application from there).
 */
import Link from "next/link";
import { mentorAffiliation, type ScheduleEntry } from "@/lib/schedule/entries";
import { dayLabels, entryStartText, locationSummary } from "@/lib/schedule/format";
import { sessionCountLabel } from "@/lib/schedule/program";
import { eventHref } from "@/lib/schedule/url";
import { cn } from "@/lib/cn";
import { EntryBadges } from "./entry-badges";

export interface AgendaPreviewProps {
  entries: ScheduleEntry[];
  showDate?: boolean;
  headingLevel?: "h3" | "h4";
  emptyMessage?: string;
  className?: string;
}

export function AgendaPreview({
  entries,
  showDate = true,
  headingLevel: Heading = "h3",
  emptyMessage = "Nothing’s listed yet. Events show up here once they’re confirmed.",
  className,
}: AgendaPreviewProps) {
  if (!entries.length) {
    return <p className={cn("border-y border-line py-6 text-sm text-text-muted", className)}>{emptyMessage}</p>;
  }

  return (
    <ol className={cn("divide-y divide-line border-y border-line", className)}>
      {entries.map((entry) => {
        const day = dayLabels(entry.date);
        const time = entryStartText(entry);
        const canceled = entry.status === "canceled";
        const who = entry.kind === "office-hours" && entry.mentor ? mentorAffiliation(entry.mentor) : null;
        const meta = [
          locationSummary(entry.location),
          entry.sessions.length ? sessionCountLabel(entry.sessions.length) : null,
          who,
        ].filter(Boolean);

        return (
          <li key={entry.id}>
            <article className="group relative isolate grid gap-x-6 gap-y-1.5 py-5 sm:grid-cols-[7rem_minmax(0,1fr)]">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 -inset-x-3 -z-10 rounded-md bg-surface-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
              />
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm tabular sm:flex-col sm:gap-0.5">
                {showDate ? (
                  <time dateTime={entry.date} className="font-medium text-text-subtle">
                    {day.weekday} {day.monthDay}
                  </time>
                ) : null}
                <span className={cn("font-semibold", canceled ? "text-text-muted line-through" : "text-text")}>
                  {time.dateTime ? <time dateTime={`${entry.date}T${time.dateTime}`}>{time.text}</time> : time.text}
                </span>
              </p>

              <div className="min-w-0">
                <Heading
                  className={cn(
                    "text-[1.0625rem] font-semibold leading-snug tracking-tight",
                    canceled ? "text-text-muted" : "text-text",
                  )}
                >
                  <Link
                    href={eventHref(entry.id)}
                    className={cn(
                      "rounded-xs underline-offset-4 after:absolute after:inset-0 after:content-['']",
                      canceled ? "line-through decoration-danger/60" : "decoration-text-subtle group-hover:underline",
                    )}
                  >
                    {entry.title}
                  </Link>
                </Heading>
                <p className="mt-1 text-sm leading-snug text-text-muted">{meta.join(" · ")}</p>
                <EntryBadges entry={entry} showWeek={false} className="mt-2.5" />
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
