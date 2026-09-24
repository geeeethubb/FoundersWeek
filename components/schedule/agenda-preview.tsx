/**
 * AgendaPreview — a compact, hairline-divided list of schedule entries for the home page and
 * "also on this day" lists. Each row: date/time, title (the row's single link, stretched over the
 * row), badges and a one-line meta ("Panel · 100 MSEB · …", "11 sessions" for program blocks).
 * Featured entries (Founders' priorities) get the orange certainty rule, as in the calendar.
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
import { ArrowRightIcon } from "@/components/ui/icons";
import { EVENT_TYPE_LABELS, mentorAffiliation, type ScheduleEntry } from "@/lib/schedule/entries";
import { dayLabels, entryCertainty, entryStartText, locationSummary } from "@/lib/schedule/format";
import { sessionCountLabel } from "@/lib/schedule/program";
import { eventHref } from "@/lib/schedule/url";
import { cn } from "@/lib/cn";
import { EntryBadges } from "./entry-badges";
import { CERTAINTY_BORDER, isFeatured } from "./time-gutter";

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
  emptyMessage = "Nothing is listed yet — events appear here as they’re confirmed.",
  className,
}: AgendaPreviewProps) {
  if (!entries.length) {
    return (
      <p className={cn("border-y border-dotted border-line-strong py-6 text-sm text-paper-muted", className)}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol className={cn("divide-y divide-line border-y border-line", className)}>
      {entries.map((entry) => {
        const day = dayLabels(entry.date);
        const time = entryStartText(entry);
        const canceled = entry.status === "canceled";
        const featured = isFeatured(entry);
        const who = entry.kind === "office-hours" ? (entry.mentor ? mentorAffiliation(entry.mentor) : null) : entry.organizer;
        const meta = [
          entry.types.map((t) => EVENT_TYPE_LABELS[t]).join(" · "),
          locationSummary(entry.location),
          entry.sessions.length ? sessionCountLabel(entry.sessions.length) : null,
          who,
        ].filter(Boolean);

        return (
          <li key={entry.id}>
            <article
              className={cn(
                "group relative grid gap-x-6 gap-y-2 py-5 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]",
                "before:pointer-events-none before:absolute before:inset-y-0 before:-left-3 before:-right-3 before:rounded-sm before:bg-paper/[0.025] before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100 focus-within:before:opacity-100",
              )}
            >
              <div
                className={cn(
                  "flex flex-wrap items-baseline gap-x-2 gap-y-1 border-l-2 pl-3 font-mono tabular sm:flex-col sm:gap-1",
                  CERTAINTY_BORDER[entryCertainty(entry)],
                  canceled ? "border-danger/55" : featured ? "border-accent" : "border-paper/35",
                )}
              >
                {showDate ? (
                  <span className="mono-label text-paper-subtle">
                    <time dateTime={entry.date}>
                      {day.weekday} {day.monthDay}
                    </time>
                  </span>
                ) : null}
                <span
                  className={cn(
                    "text-[0.9375rem] font-medium",
                    canceled ? "text-paper-muted line-through" : "text-paper",
                    !time.dateTime && "text-[0.8125rem] uppercase leading-snug tracking-[0.02em]",
                  )}
                >
                  {time.dateTime ? <time dateTime={`${entry.date}T${time.dateTime}`}>{time.text}</time> : time.text}
                </span>
              </div>

              <div className="min-w-0">
                <Heading
                  className={cn(
                    "font-wide text-[1.0625rem] font-semibold leading-snug tracking-[-0.015em]",
                    canceled ? "text-paper-muted" : "text-paper",
                  )}
                >
                  <Link
                    href={eventHref(entry.id)}
                    className={cn(
                      "rounded-xs underline-offset-4 after:absolute after:inset-0 after:content-['']",
                      canceled ? "line-through decoration-danger/60" : "group-hover:underline group-hover:decoration-paper/40",
                    )}
                  >
                    {entry.title}
                  </Link>
                </Heading>
                <EntryBadges entry={entry} className="mt-2.5" />
                <p className="mt-2 text-sm leading-snug text-paper-muted">{meta.join(" · ")}</p>
              </div>

              <span
                aria-hidden
                className="hidden size-8 items-center justify-center self-center rounded-sm border border-line text-paper-subtle transition-[color,border-color,transform] duration-200 group-hover:translate-x-0.5 group-hover:border-line-strong group-hover:text-paper sm:inline-flex"
              >
                <ArrowRightIcon className="size-3.5" />
              </span>
            </article>
          </li>
        );
      })}
    </ol>
  );
}
