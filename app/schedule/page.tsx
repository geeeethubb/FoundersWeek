import type { Metadata } from "next";
import { getMentors, getScheduleDays, getScheduleEntries, getSite, isDemoContentEnabled } from "@/content";
import { OfficeHoursCard } from "@/components/schedule/office-hours-card";
import { ScheduleExplorer } from "@/components/schedule/schedule-explorer";
import { ScheduleHeader } from "@/components/schedule/schedule-header";
import { Container } from "@/components/ui/primitives";
import { dateRangeLabel } from "@/lib/schedule/format";
import { mentorHeadshots } from "@/lib/schedule/headshots";
import { pendingMentors } from "@/lib/schedule/pending-mentors";
import { parseScheduleFilters, scheduleHref } from "@/lib/schedule/url";
import { formatDate } from "@/lib/time";

type SchedulePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The Calendar (nav label "Calendar"; the URL stays /schedule and /calendar redirects here).
 * Title reflects the shareable view: "Thursday, October 1 · Calendar", "Founders picks · Calendar".
 * (The root layout appends the site name.)
 */
export async function generateMetadata({ searchParams }: SchedulePageProps): Promise<Metadata> {
  const site = getSite();
  const days = getScheduleDays();
  const filters = parseScheduleFilters(await searchParams, days);
  const parts: string[] = [];
  if (filters.view === "picks") parts.push("Founders picks");
  if (filters.day) parts.push(formatDate(filters.day, "long"));
  parts.push("Calendar");
  const title = parts.join(" · ");

  const range = days.length ? ` (${dateRangeLabel(days[0], days[days.length - 1])})` : "";
  const scope = filters.day ? ` on ${formatDate(filters.day, "long")}` : range;
  const description =
    filters.view === "picks"
      ? `Founders picks from the ${site.week.name} calendar${scope} at UIUC: the events ${site.org.name} recommends. All times Central Time.`
      : `The ${site.week.name} calendar${scope} at UIUC: Founders Office Hours, talks, panels and receptions in time order, with Founders’ involvement labeled. All times Central Time.`;
  const canonical = scheduleHref({ day: filters.day, view: filters.view });

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_US",
      title: `${title} · ${site.name}`,
      description,
      url: canonical,
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · ${site.name}`,
      description,
      images: ["/twitter-image"],
    },
  };
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  // Reading searchParams renders per request, so shared filter links are correct on first paint
  // (the client explorer reads the same URL via useSearchParams).
  await searchParams;

  const site = getSite();
  const entries = getScheduleEntries();
  const days = getScheduleDays();
  const mentors = getMentors();

  return (
    <div className="pb-20 md:pb-28">
      <ScheduleHeader week={site.week} days={days} showDemoNote={isDemoContentEnabled()} />
      <Container className="pb-10 md:pb-12">
        <OfficeHoursCard mentors={mentors} />
      </Container>
      <ScheduleExplorer
        entries={entries}
        days={days}
        partial={site.week.scheduleCompleteness === "partial"}
        pendingMentors={pendingMentors(mentors)}
        calendarCount={entries.filter((e) => e.calendar.available).length}
        headshots={mentorHeadshots(mentors)}
      />
    </div>
  );
}
