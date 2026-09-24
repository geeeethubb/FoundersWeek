import type { Metadata } from "next";
import { getMentors, getScheduleEntries, getSite } from "@/content";
import { FeaturedEvents } from "@/components/home/featured-events";
import { HomeHero } from "@/components/home/home-hero";
import {
  calendarNote,
  featuredEventView,
  homeFeaturedEvents,
  mentorPreviews,
  namesText,
  officialDates,
} from "@/components/home/home-model";
import { MentorPreviews } from "@/components/home/mentor-previews";

/**
 * Home — calm and short, in this order:
 *   1. Hero: "Meet the people building what’s next.", one sentence on Founders Week office hours,
 *      and "Apply for Office Hours".
 *   2. Every mentor, compact (headshot, name, role and company, one availability line).
 *   3. Featured events: Dan Caruso's fireside chat, the Sept 29 panel, the Sept 30 happy hour and
 *      Founder Failure Lab (hosted by Founders, on a light-orange card).
 *   4. The link to the full calendar with the official dates.
 * Everything is computed from /content.
 */

export function generateMetadata(): Metadata {
  const site = getSite();
  const mentors = getMentors();
  const dates = officialDates(site);
  const title = `${site.name} · Office Hours & Calendar at UIUC`;
  const who = mentors.length
    ? ` The mentors are startup founders and investors: ${namesText(mentors.map((m) => m.name))}.`
    : " Meet startup founders and investors.";
  const description = `Apply for Founders Office Hours during ${site.week.name} at UIUC${dates ? ` (${dates})` : ""}.${who} One application covers every mentor.`;
  const socialTitle = `Founders Office Hours · ${site.week.name} ${site.week.year}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_US",
      url: "/",
      title: socialTitle,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
    },
  };
}

export default function HomePage() {
  const site = getSite();
  const entries = getScheduleEntries();

  return (
    <>
      <HomeHero site={site} />
      <MentorPreviews mentors={mentorPreviews(getMentors())} />
      <FeaturedEvents
        events={homeFeaturedEvents(entries).map(featuredEventView)}
        calendarNote={calendarNote(entries, site)}
      />
    </>
  );
}
