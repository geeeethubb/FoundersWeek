import type { Metadata } from "next";
import { getMentors, getScheduleDays, getScheduleEntries, getSite } from "@/content";
import { HomeCalendarPreview } from "@/components/home/calendar-preview";
import { ClosingCta } from "@/components/home/closing-cta";
import { HomeFeaturedEvents } from "@/components/home/featured-event";
import { GuideExplainer } from "@/components/home/guide-explainer";
import { HomeHero } from "@/components/home/home-hero";
import {
  agendaPreviewEntries,
  homeFeaturedEvents,
  liveEntries,
  mentorNamesText,
  weekRange,
} from "@/components/home/home-model";
import { appearancesByMentor } from "@/lib/mentors-view";

/**
 * Home — Office Hours first, in the product owner's priority order:
 *   01 Founders Office Hours (hero: the opportunity, "Apply for Office Hours", every mentor)
 *   02 Dan Caruso — Fireside Chat (Supported by Founders; information only)
 *   03 How to Make $10K/Month in College (Co-hosted by Founders)
 *   04 The rest of the calendar (week strip + a short agenda)
 * then "Founders vs. Founders Week" with the badge legend, and a closing application CTA.
 * Every count and list is computed from /content.
 */

export function generateMetadata(): Metadata {
  const site = getSite();
  const mentors = getMentors();
  const range = weekRange(getScheduleDays());
  const title = `${site.name} — Office Hours & Calendar · UIUC`;
  const who = mentors.length ? `meet ${mentorNamesText(mentors)} one-on-one` : "meet founders and operators one-on-one";
  const description = `Apply for Founders Office Hours: ${who} during ${site.week.name} at UIUC${range ? ` (${range})` : ""}. Plus the full calendar, in order.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_US",
      url: "/",
      title: `Founders Office Hours · ${site.week.name} ${site.week.year}`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `Founders Office Hours · ${site.week.name} ${site.week.year}`,
      description,
    },
  };
}

export default function HomePage() {
  const site = getSite();
  const mentors = getMentors();
  const entries = getScheduleEntries();
  const days = getScheduleDays();
  const appearances = appearancesByMentor(entries, mentors);

  return (
    <>
      <HomeHero
        site={site}
        mentors={mentors}
        appearances={appearances}
        range={weekRange(days)}
        entryCount={liveEntries(entries).length}
        dayCount={days.length}
      />
      <HomeFeaturedEvents entries={homeFeaturedEvents(entries)} />
      <HomeCalendarPreview
        entries={entries}
        days={days}
        preview={agendaPreviewEntries(entries)}
        weekName={site.week.name}
      />
      <GuideExplainer site={site} entries={entries} />
      <ClosingCta mentors={mentors} applicationsOpen={site.applications.open} />
    </>
  );
}
