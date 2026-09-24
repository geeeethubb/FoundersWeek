/**
 * HomeCalendarPreview — the broader Founders Week calendar (priority 4) at a glance: the week strip
 * (every day, with entry counts and which of Founders' priorities fall on it) and a short,
 * chronological agenda of the other events, then a link to the full Calendar (/schedule).
 *
 * Props
 * - `entries`: every public ScheduleEntry (counts come from these).
 * - `days`: calendar days, ascending (`getScheduleDays()`).
 * - `preview`: the agenda rows to show (`agendaPreviewEntries(entries)`).
 * - `weekName`: e.g. "Founders Week".
 * Server component.
 */
import Link from "next/link";
import type { ISODate } from "@/content/types";
import { AgendaPreview } from "@/components/schedule/agenda-preview";
import { WeekStrip } from "@/components/schedule/week-strip";
import { buttonClasses } from "@/components/ui/button";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Container, Eyebrow } from "@/components/ui/primitives";
import type { ScheduleEntry } from "@/lib/schedule/entries";
import { plural } from "@/lib/schedule/format";
import { TZ_NAME } from "@/lib/time";
import { liveEntries, weekRange } from "./home-model";

export function HomeCalendarPreview({
  entries,
  days,
  preview,
  weekName,
}: {
  entries: ScheduleEntry[];
  days: ISODate[];
  preview: ScheduleEntry[];
  weekName: string;
}) {
  const total = liveEntries(entries).length;
  const range = weekRange(days);
  const remaining = total - preview.length;

  return (
    <section aria-labelledby="week-heading" className="border-b border-line">
      <Container className="py-14 md:py-20">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Eyebrow index="04" className="mb-4">
              Calendar{range ? ` · ${range}` : ""}
            </Eyebrow>
            <h2
              id="week-heading"
              className="font-wide text-[2rem] font-bold leading-[1.02] tracking-[-0.03em] text-paper sm:text-[2.75rem]"
            >
              The whole week,{" "}
              <span className="font-serif text-[1.1em] font-normal italic tracking-[-0.01em]">in order.</span>
            </h2>
            <p className="mt-4 text-base leading-relaxed text-paper-muted sm:text-lg">
              {total
                ? `${plural(total, "entry", "entries")} across ${plural(days.length, "day", "days")} — office hours, talks, panels, receptions and more, with Founders’ involvement labeled on each. All times ${TZ_NAME}.`
                : `Events are added here as they’re confirmed. All times ${TZ_NAME}.`}
            </p>
          </div>
          <Link href="/schedule" className={buttonClasses({ variant: "secondary", size: "lg", className: "group/cal shrink-0 self-start md:self-auto" })}>
            Open the Calendar
            <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/cal:translate-x-0.5" />
          </Link>
        </div>

        <WeekStrip entries={entries} days={days} className="mt-10" />

        {preview.length ? (
          <div className="mt-12 grid gap-x-12 gap-y-5 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <h3 className="mono-label text-paper">More from the week</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-paper-muted">
                A few more {weekName} events, in order. Program blocks list their timed sessions in the Calendar.
              </p>
            </div>
            <div className="min-w-0 lg:col-span-9">
              <AgendaPreview entries={preview} headingLevel="h4" />
              {remaining > 0 ? (
                <Link
                  href="/schedule"
                  className="group/all mt-4 inline-flex min-h-11 items-center gap-2 rounded-xs text-sm font-medium text-paper-muted transition-colors hover:text-paper"
                >
                  See all {plural(total, "entry", "entries")} in the Calendar
                  <ArrowRightIcon className="size-4 transition-transform duration-150 group-hover/all:translate-x-0.5" />
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </Container>
    </section>
  );
}
