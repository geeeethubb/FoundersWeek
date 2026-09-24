/**
 * /schedule page header — "Calendar": title + lede on the left, a compact "about this calendar"
 * sheet on the right (coverage, last reviewed, time zone, legend).
 *
 * Props
 * - `week`: site.week (name, year, scheduleCompleteness, lastReviewed, officialUrl).
 * - `days`: dates on the calendar, ascending (first/last give the date range and CDT/CST label).
 * - `showDemoLegend`: include the Demo badge in the legend.
 */
import type { ISODate, SiteSettings } from "@/content/types";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { dateRangeLabel, timeZoneShort } from "@/lib/schedule/format";
import { formatDate } from "@/lib/time";
import { ScheduleLegend } from "./schedule-legend";

export function ScheduleHeader({
  week,
  days,
  showDemoLegend,
}: {
  week: SiteSettings["week"];
  days: ISODate[];
  showDemoLegend: boolean;
}) {
  const partial = week.scheduleCompleteness === "partial";
  const reviewed = formatDate(week.lastReviewed, "month-day");
  const reviewedYear = week.lastReviewed.slice(0, 4);
  const first = days[0] ?? null;
  const last = days[days.length - 1] ?? null;
  // "CDT · UTC−5" as in effect on the first day of the calendar.
  const zone = first ? timeZoneShort(first) : "Central";
  const range = first && last ? dateRangeLabel(first, last) : null;

  return (
    <header className="relative isolate overflow-hidden border-b border-line">
      <div aria-hidden className="bg-blueprint pointer-events-none absolute inset-0 -z-10" />
      <Container className="grid gap-8 pb-8 pt-10 md:grid-cols-12 md:gap-8 md:pb-10 md:pt-14">
        <div className="md:col-span-7">
          <Eyebrow>
            {week.name} {week.year}
            {range ? ` · ${range}` : null}
          </Eyebrow>
          <h1 className="mt-5 font-wide text-5xl font-bold leading-[0.92] tracking-[-0.04em] text-paper sm:text-6xl md:text-7xl">
            Calendar
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-paper-muted">
            Every {week.name} event{" "}
            <span className="font-serif text-[1.15em] italic leading-none text-paper">in order</span> — with Founders
            Office Hours and the events Founders hosts, co-hosts or supports marked along the way. All times are
            Central Time.
          </p>
        </div>

        <aside
          aria-label="About this calendar"
          className="self-end border-t border-line pt-5 md:col-span-5 md:col-start-8 md:border-l md:border-t-0 md:pl-8 md:pt-0 xl:col-span-4 xl:col-start-9"
        >
          <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm max-sm:justify-between max-sm:gap-x-4">
            <div>
              <dt className="mono-label text-paper-subtle">Coverage</dt>
              <dd className="mt-1.5 whitespace-nowrap font-mono text-[0.8125rem] text-paper">
                {partial ? "Partial" : "Full program"}
              </dd>
            </div>
            <div>
              <dt className="mono-label text-paper-subtle">Reviewed</dt>
              <dd className="mt-1.5 whitespace-nowrap font-mono text-[0.8125rem] tabular text-paper">
                <time dateTime={week.lastReviewed}>
                  {reviewed}, {reviewedYear}
                </time>
              </dd>
            </div>
            <div>
              <dt className="mono-label text-paper-subtle">Time zone</dt>
              <dd className="mt-1.5 whitespace-nowrap font-mono text-[0.8125rem] text-paper">{zone}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-paper-muted">
            {partial
              ? `Events are added as they’re confirmed. The official ${week.name} schedule hasn’t been added yet.`
              : `Covers the official ${week.name} agenda plus related events Founders is part of.`}
            {week.officialUrl ? (
              <>
                {" "}
                <a
                  href={week.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-paper underline decoration-line-strong underline-offset-4 hover:decoration-paper"
                >
                  Official page
                  <ArrowUpRightIcon className="size-3.5" />
                  <span className="sr-only">(opens in new tab)</span>
                </a>
              </>
            ) : null}
          </p>
          <ScheduleLegend showDemo={showDemoLegend} className="mt-4 border-t border-line pt-1" />
        </aside>
      </Container>
    </header>
  );
}
