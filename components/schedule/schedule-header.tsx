/**
 * /schedule page header: "Calendar" and one line on dates and time zone —
 * "Founders Week runs Sept 30 – Oct 3, and related events begin Sept 28. All times Central Time."
 *
 * Props
 * - `week`: site.week (name and official dates).
 * - `days`: dates on the calendar, ascending (the first one says when related events begin).
 * - `showDemoNote`: say that fictional demo items are visible (preview deployments only).
 */
import type { ISODate, SiteSettings } from "@/content/types";
import { Container } from "@/components/ui/primitives";
import { calendarIntro } from "@/lib/schedule/format";

export function ScheduleHeader({
  week,
  days,
  showDemoNote = false,
}: {
  week: SiteSettings["week"];
  days: ISODate[];
  showDemoNote?: boolean;
}) {
  return (
    <Container as="header" className="pb-8 pt-12 md:pb-10 md:pt-16">
      <h1 className="text-4xl font-bold tracking-tight text-text md:text-5xl">Calendar</h1>
      <p className="mt-3 max-w-3xl text-lg leading-relaxed text-text-muted">
        {calendarIntro(week.name, week.dates, days[0] ?? null)}
      </p>
      {showDemoNote ? (
        <p className="mt-2 text-sm text-info">Preview: fictional demo items are included and labeled “Demo”.</p>
      ) : null}
    </Container>
  );
}
